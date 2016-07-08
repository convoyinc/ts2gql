import * as _ from 'lodash';
import * as typescript from 'typescript';

import * as types from './types';

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

  constructor(private program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addQueryNode(node:typescript.Declaration):void {
    const simpleNode = <types.InterfaceNode>this._walkNode(node);
    simpleNode.query = true;
  }

  // Node Walking

  _walkNode = (node:typescript.Node):types.Node => {
    switch (node.kind) {
      case SyntaxKind.InterfaceDeclaration:
        return this._walkInterfaceDeclaration(<typescript.InterfaceDeclaration>node);
      case SyntaxKind.MethodSignature:
        return this._walkMethodSignature(<typescript.MethodSignature>node);
      case SyntaxKind.PropertySignature:
        return this._walkPropertySignature(<typescript.PropertySignature>node);
      case SyntaxKind.TypeReference:
        return this._walkTypeReferenceNode(<typescript.TypeReferenceNode>node);
      case SyntaxKind.TypeAliasDeclaration:
        return this._walkTypeAliasDeclaration(<typescript.TypeAliasDeclaration>node);
      case SyntaxKind.EnumDeclaration:
        return this._walkEnumDeclaration(<typescript.EnumDeclaration>node);
      case SyntaxKind.TypeLiteral:
        return this._walkTypeLiteralNode(<typescript.TypeLiteralNode>node);
      case SyntaxKind.ArrayType:
        return this._walkArrayTypeNode(<typescript.ArrayTypeNode>node);
      case SyntaxKind.StringKeyword:
        return {type: 'string'};
      case SyntaxKind.NumberKeyword:
        return {type: 'number'};
      case SyntaxKind.BooleanKeyword:
        return {type: 'boolean'};
      case SyntaxKind.ModuleDeclaration:
        return null;
      case SyntaxKind.VariableDeclaration:
        return null;
      default:
        console.log(node);
        console.log(node.getSourceFile().fileName);
        throw new Error(`Don't know how to handle ${SyntaxKind[node.kind]} nodes`);
    }
  }

  _walkInterfaceDeclaration(node:typescript.InterfaceDeclaration):types.Node {
    // TODO: How can we determine for sure that this is the global date?
    if (node.name.text === 'Date') {
      return {type: 'reference', target: 'Date'};
    }
    return this._addType(node, () => ({
      type: 'interface',
      members: _.keyBy(node.members.map(this._walkNode), 'name'),
    }));
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
      documentation: signature.getDocumentationComment().map(c => c.text).join('').trim(),
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
    const symbol = this._symbolForNode(node.typeName);
    symbol.getDeclarations().forEach(this._walkNode);

    return {
      type: 'reference',
      target: this._nameForSymbol(symbol),
    }
  }

  _walkTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    return this._addType(node, () => ({
      type: 'alias',
      target: this._walkNode(node.type),
    }));
  }

  _walkEnumDeclaration(node:typescript.EnumDeclaration):types.Node {
    return this._addType(node, () => ({
      type: 'enum',
      values: node.members.map(m => m.name.getText()),
    }));
  }

  _walkTypeLiteralNode(node:typescript.TypeLiteralNode):types.Node {
    return {
      type: 'literal object',
      members: _.keyBy(node.members.map(this._walkNode), 'name'),
    }
  }

  _walkArrayTypeNode(node:typescript.ArrayTypeNode):types.Node {
    return {
      type: 'array',
      elements: [this._walkNode(node.elementType)],
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
    const symbol = this._expandSymbol(type.getSymbol());
    symbol.getDeclarations().forEach(this._walkNode);

    return {
      type: 'reference',
      target: this._nameForSymbol(symbol),
    };
  }

  // Utility

  _addType(node:typescript.Declaration, typeBuilder:() => types.Node):types.Node {
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    if (this.types[name]) return this.types[name];
    const type = typeBuilder();
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

}
