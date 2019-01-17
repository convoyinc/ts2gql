import * as doctrine from 'doctrine';
import * as _ from 'lodash';
import * as typescript from 'typescript';

import * as types from './types';
import * as util from './util';
import { MethodParamsParser } from './Parser';

const SyntaxKind = typescript.SyntaxKind;
const TypeFlags = typescript.TypeFlags;

/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
export default class Collector {
  types:types.TypeMap = {};
  private checker:typescript.TypeChecker;
  private nodeMap:Map<typescript.Node, types.Node> = new Map();

  constructor(program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node:typescript.InterfaceDeclaration):void {
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
      .filter(m => !overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  // Node Walking

  _walkNode = (node:typescript.Node):types.Node => {
    // Reentrant node walking.
    if (this.nodeMap.has(node)) {
      return this.nodeMap.get(node) as types.Node;
    }
    const nodeReference:types.Node = <types.Node>{};
    this.nodeMap.set(node, nodeReference);

    let result:types.Node|null = null;
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
    } else if (node.kind === SyntaxKind.ParenthesizedType) {
      const parenthesizedNode = node as typescript.ParenthesizedTypeNode;
      result = this._walkNode(parenthesizedNode.type);
    } else if (node.kind === SyntaxKind.ArrayType) {
      result = this._walkArrayTypeNode(<typescript.ArrayTypeNode>node);
    } else if (node.kind === SyntaxKind.UnionType) {
      result = this._walkUnionTypeNode(<typescript.UnionTypeNode>node);
    } else if (node.kind === SyntaxKind.LiteralType) {
      result = {
        type: types.NodeType.STRING_LITERAL,
        value: _.trim((<typescript.LiteralTypeNode>node).literal.getText(), "'\""),
      };
    } else if (node.kind === SyntaxKind.StringKeyword) {
      result = {type: types.NodeType.NOT_NULL, node: {type: types.NodeType.STRING}};
    } else if (node.kind === SyntaxKind.NumberKeyword) {
      result = {type: types.NodeType.NOT_NULL, node: {type: types.NodeType.NUMBER}};
    } else if (node.kind === SyntaxKind.BooleanKeyword) {
      result = {type: types.NodeType.NOT_NULL, node: {type: types.NodeType.BOOLEAN}};
    } else if (node.kind === SyntaxKind.AnyKeyword) {
      result = { type: types.NodeType.ANY};
    } else if (node.kind === SyntaxKind.NullKeyword) {
      result = {type: types.NodeType.NULL};
    } else if (node.kind === SyntaxKind.UndefinedKeyword) {
      result = {type: types.NodeType.UNDEFINED};
    } else if (node.kind === SyntaxKind.ModuleDeclaration) {
      // Nada.
    } else if (node.kind === SyntaxKind.VariableDeclaration) {
      // Nada.
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

  _walkSymbol = (symbol:typescript.Symbol):types.Node[] => {
    return _.map(symbol.getDeclarations(), d => this._walkNode(d));
  }

  _walkInterfaceDeclaration(node:typescript.InterfaceDeclaration):types.Node {
    // TODO: How can we determine for sure that this is the global date?
    if (node.name.text === 'Date') {
      return {type: types.NodeType.REFERENCE, target: 'Date'};
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
        type: types.NodeType.INTERFACE,
        members: <types.NamedNode[]>node.members.map(this._walkNode),
        inherits,
      };
    });
  }

  _walkMethodSignature(node:typescript.MethodSignature):types.Node {
    try {
      const signature = this.checker.getSignatureFromDeclaration(node);
      const parameters:types.MethodParamsNode = this._walkMethodParams(signature!.getParameters());
      const methodDoc = util.documentationForNode(node);
      const directiveList = methodDoc ? this._retrieveDirectives(methodDoc) : [];
      return {
        type: types.NodeType.METHOD,
        name: node.name.getText(),
        parameters,
        returns: this._walkNode(node.type!),
        directives: directiveList,
      };
    } catch (e) {
      e.message = `At method "${node.name.getText()}":\n${e.message}`;
      throw e;
    }
  }

  _retrieveDirectives(jsDoc:doctrine.ParseResult):types.DirectiveNode[] {
    const directivesStart = _.findIndex(jsDoc.tags, (tag) => {
      return tag.title === 'graphql' && tag.description === 'Directives';
    });

    if (directivesStart === -1) {
      return [];
    }
    return _.map(jsDoc.tags.slice(directivesStart + 1), this._directiveFromDocTag);
  }

  _walkMethodParams(params:typescript.Symbol[]):types.MethodParamsNode {
    const argNodes:types.TypeMap = {};
    for (const parameter of params) {
      const parameterNode = <typescript.ParameterDeclaration>parameter.valueDeclaration;
      argNodes[parameter.getName()] = this._walkNode(parameterNode.type!);
    }
    return {
      type: types.NodeType.METHOD_PARAMS,
      args: argNodes,
    };
  }

  _walkPropertySignature(node:typescript.PropertySignature):types.Node {
    const signature = this._walkNode(node.type!);
    return {
      type: types.NodeType.PROPERTY,
      name: node.name.getText(),
      signature: (node.questionToken && signature.type === types.NodeType.NOT_NULL ) ? signature.node : signature,
    };
  }

  _walkTypeReferenceNode(node:typescript.TypeReferenceNode):types.Node {
    return { type: types.NodeType.NOT_NULL, node: this._referenceForSymbol(this._symbolForNode(node.typeName)) };
  }

  _walkTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    return this._addType(node, () => ({
      type: types.NodeType.ALIAS,
      target: this._walkNode(node.type),
    }));
  }

  _walkEnumDeclaration(node:typescript.EnumDeclaration):types.Node {
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
        type: types.NodeType.ENUM,
        values,
      };
    });
  }

  _walkTypeLiteralNode(node:typescript.TypeLiteralNode):types.Node {
    return {
      type: types.NodeType.LITERAL_OBJECT,
      members: node.members.map(this._walkNode),
    };
  }

  _walkArrayTypeNode(node:typescript.ArrayTypeNode):types.Node {
    return {
      type: types.NodeType.NOT_NULL,
      node: {
        type: types.NodeType.ARRAY,
        elements: [this._walkNode(node.elementType)],
      },
    };
  }

  _walkUnionTypeNode(node:typescript.UnionTypeNode):types.Node {
    return {
      type: types.NodeType.UNION,
      types: node.types.map(this._walkNode),
    };
  }

  // Type Walking

  _walkType = (type:typescript.Type):types.Node => {
    if (type.flags & TypeFlags.Object) {
      return this._walkTypeReference(<typescript.TypeReference>type);
    } else if (type.flags & TypeFlags.BooleanLike) {
      return this._walkInterfaceType(<typescript.InterfaceType>type);
    } else if (type.flags & TypeFlags.Index) {
      return this._walkNode(type.getSymbol()!.declarations![0]);
    } else if (type.flags & TypeFlags.String) {
      return {type: types.NodeType.STRING};
    } else if (type.flags & TypeFlags.Number) {
      return {type: types.NodeType.NUMBER};
    } else if (type.flags & TypeFlags.Boolean) {
      return {type: types.NodeType.BOOLEAN};
    } else {
      console.error(type);
      console.error(type.getSymbol()!.declarations![0].getSourceFile().fileName);
      throw new Error(`Don't know how to handle type with flags: ${type.flags}`);
    }
  }

  _walkTypeReference(type:typescript.TypeReference):types.Node {
    if (type.target && type.target.getSymbol()!.name === 'Array') {
      return {
        type: types.NodeType.ARRAY,
        elements: type.typeArguments!.map(this._walkType),
      };
    } else {
      throw new Error('Non-array type references not yet implemented');
    }
  }

  _walkInterfaceType(type:typescript.InterfaceType):types.Node {
    return this._referenceForSymbol(this._expandSymbol(type.getSymbol()!));
  }

  // Utility

  _addType(
    node:typescript.InterfaceDeclaration|typescript.TypeAliasDeclaration|typescript.EnumDeclaration,
    typeBuilder:() => types.Node,
  ):types.Node {
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    if (this.types[name]) return this.types[name];
    const type = typeBuilder();
    (<types.ComplexNode>type).documentation = util.documentationForNode(node);
    this.types[name] = type;
    return type;
  }

  _symbolForNode(node:typescript.Node):typescript.Symbol {
    return this._expandSymbol(this.checker.getSymbolAtLocation(node)!);
  }

  _nameForSymbol(symbol:typescript.Symbol):types.SymbolName {
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

  _expandSymbol(symbol:typescript.Symbol):typescript.Symbol {
    while (symbol.flags & typescript.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }
    return symbol;
  }

  _referenceForSymbol(symbol:typescript.Symbol):types.ReferenceNode {
    this._walkSymbol(symbol);
    const referenced = this.types[this._nameForSymbol(symbol)];
    if (referenced && referenced.type === types.NodeType.INTERFACE) {
      referenced.concrete = true;
    }

    return {
      type: types.NodeType.REFERENCE,
      target: this._nameForSymbol(symbol),
    };
  }

  _directiveFromDocTag(jsDocTag:doctrine.Tag):types.DirectiveNode {
    // This regex properly catches the parameters substring
    const paramsContentRegex = /\s*\(\s*((?:.|\s)*)\s*\)\s*/g;
    let directiveParams = {
      type: types.NodeType.METHOD_PARAMS,
      args: {},
    } as types.MethodParamsNode;
    if (jsDocTag.description) {
      const paramsContent = jsDocTag.description.match(paramsContentRegex);
      if (!paramsContent) {
        throw new Error(`Invalid parameter description ${jsDocTag.description} at directive ${jsDocTag.title}.`);
      }
      const parser = new MethodParamsParser();
      try {
        directiveParams = parser.parse(paramsContent[0]);
      } catch (e) {
        const parsingMsg = e.message;
        throw new Error(`Failed to parse parameter list of \"${jsDocTag.title}\" directive.\n${parsingMsg}`);
      }
    }
    return {
      type: types.NodeType.DIRECTIVE,
      name: jsDocTag.title,
      params: directiveParams,
    };
  }

}
