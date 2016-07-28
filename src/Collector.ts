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
  types:types.TypeMap = {
    Date: {type: 'alias', target: {type: 'string'}},
  };
  private checker:typescript.TypeChecker;
  private nodeMap:Map<typescript.Node, types.Node> = new Map;

  constructor(private program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node:typescript.Declaration):void {
    this._walkNode(node);
    const simpleNode = <types.InterfaceNode>this.types[this._nameForSymbol(this._symbolForNode(node.name))];
    simpleNode.concrete = true;
  }

  mergeOverrides(node:typescript.InterfaceDeclaration, name:types.SymbolName):void {
    const existing = <types.InterfaceNode>this.types[name];
    if (!existing) {
      throw new Error(`Cannot override "${name}" - it was never included`);
    }
    const overrides = <types.NamedNode[]>node.members.map(this._walkNode);
    const overriddenNames = new Set(overrides.map(o => (<any>o).name));
    existing.members = _(existing.members)
      .filter(m => overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  // Node Walking

  _walkNode = (node:typescript.Node):types.Node => {
    // Reentrant node walking.
    if (this.nodeMap.has(node)) {
      return this.nodeMap.get(node);
    }
    const nodeReference:types.Node = <types.Node>{};
    this.nodeMap.set(node, nodeReference);

    let result:types.Node;
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
    } else if (node.kind === SyntaxKind.StringKeyword) {
      result = {type: 'string'};
    } else if (node.kind === SyntaxKind.NumberKeyword) {
      result = {type: 'number'};
    } else if (node.kind === SyntaxKind.BooleanKeyword) {
      result = {type: 'boolean'};
    } else if (node.kind === SyntaxKind.ModuleDeclaration) {
      // Nada.
    } else if (node.kind === SyntaxKind.VariableDeclaration) {
      // Nada.
    } else {
      console.log(node);
      console.log(node.getSourceFile().fileName);
      throw new Error(`Don't know how to handle ${SyntaxKind[node.kind]} nodes`);
    }

    if (result) {
      Object.assign(nodeReference, result);
    }
    return nodeReference;
  }

  _walkSymbol = (symbol:typescript.Symbol):types.Node[] => {
    return symbol.getDeclarations().map(d => this._walkNode(d));
  }

  _walkInterfaceDeclaration(node:typescript.InterfaceDeclaration):types.Node {
    // TODO: How can we determine for sure that this is the global date?
    if (node.name.text === 'Date') {
      return {type: 'reference', target: 'Date'};
    }

    return this._addType(node, () => {
      const inherits = [];
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          for (const type of clause.types) {
            const symbol = this._symbolForNode(type.expression);
            this._walkSymbol(symbol);
            inherits.push(this._nameForSymbol(symbol));
          }
        }
      }

      return {
        type: 'interface',
        members: <types.NamedNode[]>node.members.map(this._walkNode),
        inherits,
      };
    });
  }

  _walkMethodSignature(node:typescript.MethodSignature):types.Node {
    const signature = this.checker.getSignatureFromDeclaration(node);
    const parameters:types.TypeMap = {};
    for (const parameter of signature.getParameters()) {
      const parameterNode = <typescript.ParameterDeclaration>parameter.valueDeclaration;
      parameters[parameter.getName()] = this._walkNode(parameterNode.type);
    }

    return {
      type: 'method',
      name: node.name.getText(),
      parameters,
      returns: this._walkType(signature.getReturnType()),
    };
  }

  _walkPropertySignature(node:typescript.PropertySignature):types.Node {
    return {
      type: 'property',
      name: node.name.getText(),
      signature: this._walkNode(node.type),
    };
  }

  _walkTypeReferenceNode(node:typescript.TypeReferenceNode):types.Node {
    return this._referenceForSymbol(this._symbolForNode(node.typeName));
  }

  _walkTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    return this._addType(node, () => ({
      type: 'alias',
      target: this._walkNode(node.type),
    }));
  }

  _walkEnumDeclaration(node:typescript.EnumDeclaration):types.Node {
    return this._addType(node, () => {
      const values = node.members.map(m => {
        if (!m.initializer) {
          /**
           *  Enum's should look like this:
           *    export enum Type {
           *      CREATED        = <any>'CREATED',
           *      ACCEPTED       = <any>'ACCEPTED',
           *    }
           */
          throw new Error(`enum ${node.name.getText()} must have string values`);
        }
        return _.trim(_.last(m.initializer.getChildren()).getText(), "'");
      });
      return {
        type: 'enum',
        values,
      };
    });
  }

  _walkTypeLiteralNode(node:typescript.TypeLiteralNode):types.Node {
    return {
      type: 'literal object',
      members: node.members.map(this._walkNode),
    };
  }

  _walkArrayTypeNode(node:typescript.ArrayTypeNode):types.Node {
    return {
      type: 'array',
      elements: [this._walkNode(node.elementType)],
    };
  }

  _walkUnionTypeNode(node:typescript.UnionTypeNode):types.Node {
    return {
      type: 'union',
      types: node.types.map(this._walkNode),
    };
  }

  // Type Walking

  _walkType = (type:typescript.Type):types.Node => {
    if (type.flags & TypeFlags.Reference) {
      return this._walkTypeReference(<typescript.TypeReference>type);
    } else if (type.flags & TypeFlags.Interface) {
      return this._walkInterfaceType(<typescript.InterfaceType>type);
    } else if (type.flags & TypeFlags.Anonymous) {
      return this._walkNode(type.getSymbol().declarations[0]);
    } else if (type.flags & TypeFlags.String) {
      return {type: 'string'};
    } else if (type.flags & TypeFlags.Number) {
      return {type: 'number'};
    } else if (type.flags & TypeFlags.Boolean) {
      return {type: 'boolean'};
    } else {
      console.log(type);
      console.log(type.getSymbol().declarations[0].getSourceFile().fileName);
      throw new Error(`Don't know how to handle type with flags: ${type.flags}`);
    }
  }

  _walkTypeReference(type:typescript.TypeReference):types.Node {
    if (type.target && type.target.getSymbol().name === 'Array') {
      return {
        type: 'array',
        elements: type.typeArguments.map(this._walkType),
      };
    } else {
      throw new Error('Non-array type references not yet implemented');
    }
  }

  _walkInterfaceType(type:typescript.InterfaceType):types.Node {
    return this._referenceForSymbol(this._expandSymbol(type.getSymbol()));
  }

  // Utility

  _addType(node:typescript.Declaration, typeBuilder:() => types.Node):types.Node {
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    if (this.types[name]) return this.types[name];
    const type = typeBuilder();
    (<types.ComplexNode>type).documentation = util.documentationForNode(node);
    this.types[name] = type;
    return type;
  }

  _symbolForNode(node:typescript.Node):typescript.Symbol {
    return this._expandSymbol(this.checker.getSymbolAtLocation(node));
  }

  _nameForSymbol(symbol:typescript.Symbol):types.SymbolName {
    symbol = this._expandSymbol(symbol);
    let parts = [];
    while (symbol) {
      parts.unshift(this.checker.symbolToString(symbol));
      symbol = symbol['parent'];
      // Don't include raw module names.
      if (symbol && symbol.flags === typescript.SymbolFlags.ValueModule) break;
    }

    return parts.join('.');
  }

  _expandSymbol(symbol:typescript.Symbol):typescript.Symbol {
    while (symbol.flags & typescript.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    return symbol;
  }

  _referenceForSymbol(symbol:typescript.Symbol):types.ReferenceNode {
    this._walkSymbol(symbol);
    const referenced = this.types[this._nameForSymbol(symbol)];
    if (referenced && referenced.type === 'interface') {
      referenced.concrete = true;
    }

    return {
      type: 'reference',
      target: this._nameForSymbol(symbol),
    };
  }

}
