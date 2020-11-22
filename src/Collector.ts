import * as _ from 'lodash';
import * as typescript from 'typescript';

import * as types from './types';
import * as util from './util';

const SyntaxKind = typescript.SyntaxKind;
const TypeFlags = typescript.TypeFlags;

/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
export default class Collector {
  types: types.TypeMap = {
    Date: { type: 'alias', target: { type: 'string' } },
  };
  private checker: typescript.TypeChecker;
  private nodeMap: Map<typescript.Node, types.Node> = new Map();

  constructor(program: typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node: typescript.InterfaceDeclaration): void {
    this._walkNode(node);
    const simpleNode = <types.InterfaceNode>this.types[this._nameForSymbol(this._symbolForNode(node.name))];
    simpleNode.concrete = true;
  }

  mergeOverrides(node: typescript.InterfaceDeclaration, name: types.SymbolName): void {
    const existing = <types.InterfaceNode>this.types[name];
    if (!existing) {
      throw new Error(`Cannot override "${name}" - it was never included`);
    }
    const overrides = <types.NamedNode[]>node.members.map(this._walkNode);
    const overriddenNames = new Set(overrides.map(o => (<any>o).name));
    existing.members = _(existing.members)
      .filter(m => !overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  // Node Walking

  _walkNode = (node: typescript.Node): types.Node => {
    // Reentrant node walking.
    if (this.nodeMap.has(node)) {
      return this.nodeMap.get(node) as types.Node;
    }
    const nodeReference: types.Node = <types.Node>{};
    this.nodeMap.set(node, nodeReference);

    let result: types.Node | null = null;
    if (node.kind === SyntaxKind.InterfaceDeclaration) {
      result = this._walkInterfaceDeclaration(<typescript.InterfaceDeclaration>node);
    } else if (node.kind === SyntaxKind.MethodSignature) {
      result = this._walkMethodSignature(<typescript.MethodSignature>node);
    } else if (node.kind === SyntaxKind.PropertySignature) {
      result = this._walkPropertySignature(<typescript.PropertySignature>node);
    } else if (node.kind === SyntaxKind.TypeReference) {
      result = this._walkTypeReferenceNode(<typescript.TypeReferenceNode>node);
    } else if (node.kind === SyntaxKind.TypeAliasDeclaration) {
      result = this._walkTypeAliasDeclaration(<typescript.TypeAliasDeclaration>node);
    } else if (node.kind === SyntaxKind.EnumDeclaration) {
      result = this._walkEnumDeclaration(<typescript.EnumDeclaration>node);
    } else if (node.kind === SyntaxKind.TypeLiteral) {
      result = this._walkTypeLiteralNode(<typescript.TypeLiteralNode>node);
    } else if (node.kind === SyntaxKind.ArrayType) {
      result = this._walkArrayTypeNode(<typescript.ArrayTypeNode>node);
    } else if (node.kind === SyntaxKind.UnionType) {
      result = this._walkUnionTypeNode(<typescript.UnionTypeNode>node);
    } else if (node.kind === SyntaxKind.LiteralType) {
      result = {
        type: 'string literal',
        value: _.trim((<typescript.LiteralTypeNode>node).literal.getText(), "'\""),
      };
    } else if (node.kind === SyntaxKind.StringKeyword) {
      result = { type: 'string' };
    } else if (node.kind === SyntaxKind.NumberKeyword) {
      result = { type: 'number' };
    } else if (node.kind === SyntaxKind.BooleanKeyword) {
      result = { type: 'boolean' };
    } else if (node.kind === SyntaxKind.AnyKeyword) {
      result = { type: 'any' };
    } else if (node.kind === SyntaxKind.ModuleDeclaration) {
      // Nada.
    } else if (node.kind === SyntaxKind.VariableDeclaration) {
      // Nada.
    } else if (node.kind === SyntaxKind.TypeParameter) {
      // Nada. Included in handling interfaces
    } else if (node.kind === SyntaxKind.ExpressionWithTypeArguments) {
      result = this._walkExpressionWithTypeArguments(<typescript.ExpressionWithTypeArguments>node);
    } else {
      console.error(node);
      console.error(node.getSourceFile().fileName);
      throw new Error(`Don't know how to handle ${SyntaxKind[node.kind]} nodes`);
    }

    if (result) {
      Object.assign(nodeReference, result);
    }
    return nodeReference;
  }

  _walkSymbol = (symbol: typescript.Symbol): types.Node[] => {
    return _.map(symbol.getDeclarations(), d => this._walkNode(d));
  }

  _walkExpressionWithTypeArguments(node: typescript.ExpressionWithTypeArguments): types.Node {

    const referenceNodes = [];
    if (node.typeArguments) {
      for (const typeArg of node.typeArguments) {
        referenceNodes.push(this._walkNode(typeArg) as types.ReferenceNode);
      }
    }

    return {
      type: 'expressionWithTypeNode',
      name: node.expression.getText(),
      referenceNodes,
    }
  }

  _walkInterfaceDeclaration(node: typescript.InterfaceDeclaration): types.Node {
    // TODO: How can we determine for sure that this is the global date?
    if (node.name.text === 'Date') {
      return { type: 'reference', target: 'Date', referenceNodes: [] };
    }

    return this._addType(node, () => {
      const inherits = [];
      const typeParameters: string[] = [];
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            const symbol = this._symbolForNode(type.expression);
            this._walkSymbol(symbol);
            const typeRef = this._walkNode(type);

            if (typeRef.type === 'expressionWithTypeNode' && typeRef.referenceNodes.some(r => r.type === 'reference' && r.referenceNodes.length > 0)) {
              console.error(type);
              console.error(type.getSourceFile().fileName);
              throw new Error(`Generic inheritance cannot have another generic. Try using a named type instead. ${node.getText()}`);
            }
            // get the symbol + typeref. if it's
            inherits.push(typeRef as types.ExpressionWithTypeNode);
          }
        }
      }

      if (node.typeParameters) {
        for (const clause of node.typeParameters) {
          const type = this.checker.getTypeAtLocation(clause);
          const symbol = type.getSymbol();
          if (symbol) {
            typeParameters.push(symbol!.name);
          }
        }
      }

      return {
        type: 'interface',
        members: <types.NamedNode[]>node.members.map(m => {
          // members cannot be generic. they need to be named
          const propertySignature = m as typescript.PropertySignature;
          const type = propertySignature.type;
          if (type && typescript.isTypeReferenceNode(type)) {
            if (type.typeArguments && type.typeArguments.length > 0) {
              console.error(type);
              console.error(type.getSourceFile().fileName);
              throw new Error(`Property cannot be generic for ${node.getText()}`);
            }
          }
          if (typeParameters.find(t => t === (propertySignature.type && propertySignature.type!.getText()))) {
            return {
              type: 'genericPropertyNode',
              name: propertySignature.name!.getText(),
              signature: propertySignature.type!.getText(),
            }
          } else {
            return this._walkNode(m);
          }
        }),
        inherits,
        typeParameters
      };
    });
  }

  _walkMethodSignature(node: typescript.MethodSignature): types.Node {
    const signature = this.checker.getSignatureFromDeclaration(node);
    const parameters: types.TypeMap = {};
    for (const parameter of signature!.getParameters()) {
      const parameterNode = <typescript.ParameterDeclaration>parameter.valueDeclaration;
      parameters[parameter.getName()] = this._walkNode(parameterNode.type!);
    }

    return {
      type: 'method',
      name: node.name.getText(),
      documentation: util.documentationForNode(node),
      parameters,
      returns: this._walkNode(node.type!),
    };
  }

  _walkPropertySignature(node: typescript.PropertySignature): types.Node {
    return {
      type: 'property',
      name: node.name.getText(),
      documentation: util.documentationForNode(node),
      signature: this._walkNode(node.type!),
    };
  }

  _walkTypeReferenceNode(node: typescript.TypeReferenceNode): types.Node {
    return this._referenceForSymbol(this._symbolForNode(node.typeName), node);
  }

  _walkTypeAliasDeclaration(node: typescript.TypeAliasDeclaration): types.Node {
    return this._addType(node, () => ({
      type: 'alias',
      target: this._walkNode(node.type),
    }));
  }

  _walkEnumDeclaration(node: typescript.EnumDeclaration): types.Node {
    return this._addType(node, () => {
      const values = node.members.map(m => {
        // If the user provides an initializer, use the value of the initializer
        // as the GQL enum value _unless_ the initializer is a numeric literal.
        if (m.initializer && m.initializer.kind !== SyntaxKind.NumericLiteral) {
          /**
           *  Enums with initializers can look like:
           *
           *    export enum Type {
           *      CREATED  = <any>'CREATED',
           *      ACCEPTED = <any>'ACCEPTED',
           *    }
           *
           *    export enum Type {
           *      CREATED  = 'CREATED',
           *      ACCEPTED = 'ACCEPTED',
           *    }
           *
           *    export enum Type {
           *      CREATED  = "CREATED",
           *      ACCEPTED = "ACCEPTED",
           *    }
           */
          const target = _.last(m.initializer.getChildren()) || m.initializer;
          return _.trim(target.getText(), "'\"");
        } else {
          /**
           *  For Enums without initializers (or with numeric literal initializers), emit the
           *  EnumMember name as the value. Example:
           *    export enum Type {
           *      CREATED,
           *      ACCEPTED,
           *    }
           */
          return _.trim(m.name.getText(), "'\"");
        }
      });
      return {
        type: 'enum',
        values,
      };
    });
  }

  _walkTypeLiteralNode(node: typescript.TypeLiteralNode): types.Node {
    return {
      type: 'literal object',
      members: node.members.map(this._walkNode),
    };
  }

  _walkArrayTypeNode(node: typescript.ArrayTypeNode): types.Node {
    return {
      type: 'array',
      elements: [this._walkNode(node.elementType)],
    };
  }

  _walkUnionTypeNode(node: typescript.UnionTypeNode): types.Node {
    return {
      type: 'union',
      types: node.types.map(this._walkNode),
    };
  }

  // Type Walking

  _walkType = (type: typescript.Type): types.Node => {
    if ((type.flags & TypeFlags.Object)) {
      return this._walkTypeReference(<typescript.TypeReference>type);
    } else if (type.flags & TypeFlags.BooleanLike) {
      return this._walkInterfaceType(<typescript.InterfaceType>type);
    } else if (type.flags & TypeFlags.Index) {
      return this._walkNode(type.getSymbol()!.declarations![0]);
    } else if (type.flags & TypeFlags.String) {
      return { type: 'string' };
    } else if (type.flags & TypeFlags.Number) {
      return { type: 'number' };
    } else if (type.flags & TypeFlags.Boolean) {
      return { type: 'boolean' };
    } else {
      console.error(type);
      console.error(type.getSymbol()!.declarations![0].getSourceFile().fileName);
      throw new Error(`Don't know how to handle type with flags: ${type.flags}`);
    }
  }

  _walkTypeReference(type: typescript.TypeReference): types.Node {
    if (type.target && type.target.getSymbol()!.name === 'Array') {
      return {
        type: 'array',
        elements: type.typeArguments!.map(this._walkType),
      };
    } else {
      throw new Error('Non-array type references not yet implemented');
    }
  }

  _walkInterfaceType(type: typescript.InterfaceType): types.Node {
    return this._referenceForSymbol(this._expandSymbol(type.getSymbol()!));
  }

  // Utility

  _addType(
    node: typescript.InterfaceDeclaration | typescript.TypeAliasDeclaration | typescript.EnumDeclaration,
    typeBuilder: () => types.Node,
  ): types.Node {
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    if (this.types[name]) return this.types[name];
    const type = typeBuilder();
    (<types.ComplexNode>type).documentation = util.documentationForNode(node);
    this.types[name] = type;
    return type;
  }

  _symbolForNode(node: typescript.Node): typescript.Symbol {
    return this._expandSymbol(this.checker.getSymbolAtLocation(node)!);
  }

  _nameForSymbol(symbol: typescript.Symbol): types.SymbolName {
    symbol = this._expandSymbol(symbol);
    const parts = [];
    while (symbol) {
      parts.unshift(this.checker.symbolToString(symbol));
      symbol = symbol['parent'];
      // Don't include raw module names.
      if (symbol && symbol.flags === typescript.SymbolFlags.ValueModule) break;
    }

    return parts.join('.');
  }

  _expandSymbol(symbol: typescript.Symbol): typescript.Symbol {
    while (symbol.flags & typescript.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    return symbol;
  }

  _referenceForSymbol(symbol: typescript.Symbol, node: typescript.TypeReferenceNode): types.ReferenceNode {
    this._walkSymbol(symbol); //getTypeReferenceName
    const referenced = this.types[this._nameForSymbol(symbol)];
    if (referenced && referenced.type === 'interface') {
      referenced.concrete = true;
    }
    const referenceNodes = [];
    if (node.typeArguments) {
      for (const typeArgument of node.typeArguments) {
        if (typeArgument) {
          const typeArg = <typescript.TypeReferenceNode>typeArgument;
          referenceNodes.push(this._walkNode(typeArg))
        }
      }
    }

    return {
      type: 'reference',
      target: this._nameForSymbol(symbol),
      referenceNodes,
    };
  }

}
