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
  types:types.TypeDefinitionMap = {};
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
      throw new Error(`Cannot override '${name}' - it was never included`);
    }
    const overrides = <types.FieldNode[]>node.members.map(this._walkNode);
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
    const doc =  util.documentationForNode(node);

    let result:types.Node|null = null;
    if (node.kind === SyntaxKind.InterfaceDeclaration) {
      result = this._walkInterfaceDeclaration(<typescript.InterfaceDeclaration>node);
    } else if (node.kind === SyntaxKind.MethodSignature) {
      result = this._walkMethodSignature(<typescript.MethodSignature>node, doc);
    } else if (node.kind === SyntaxKind.PropertySignature) {
      result = this._walkPropertySignature(<typescript.PropertySignature>node, doc);
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
        type: types.GQLNodeKind.STRING_LITERAL,
        value: _.trim((<typescript.LiteralTypeNode>node).literal.getText(), "'\""),
      };
    } else if (node.kind === SyntaxKind.StringKeyword) {
      result = {type: types.GQLNodeKind.NON_NULL, node: {type: types.GQLNodeKind.STRING_TYPE}};
    } else if (node.kind === SyntaxKind.NumberKeyword) {
      result = {type: types.GQLNodeKind.NON_NULL, node: {type: types.GQLNodeKind.NUMBER}};
    } else if (node.kind === SyntaxKind.BooleanKeyword) {
      result = {type: types.GQLNodeKind.NON_NULL, node: {type: types.GQLNodeKind.BOOLEAN_TYPE}};
    } else if (node.kind === SyntaxKind.AnyKeyword) {
      result = { type: types.GQLNodeKind.ANY};
    } else if (node.kind === SyntaxKind.NullKeyword) {
      result = {type: types.GQLNodeKind.NULL};
    } else if (node.kind === SyntaxKind.UndefinedKeyword) {
      result = {type: types.GQLNodeKind.UNDEFINED};
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
      return {type: types.GQLNodeKind.REFERENCE, target: 'Date'};
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
        type: types.GQLNodeKind.INTERFACE_DEFINITION,
        members: <types.FieldNode[]>node.members.map(this._walkNode),
        inherits,
      };
    });
  }

  _walkMethodSignature(node:typescript.MethodSignature, doc:doctrine.ParseResult | undefined):types.Node {
    try {
      const parameters:types.DirectiveArguments = this._walkMethodParams(node.parameters);
      const collectedReturn = this._walkNode(node.type!);
      const directiveList = doc ? this._retrieveDirectives(doc) : [];
      return {
        type: types.GQLNodeKind.FIELD_DEFINITION,
        name: node.name.getText(),
        parameters,
        returns: this._isNullable(collectedReturn) ? collectedReturn : util.wrapNotNull(collectedReturn),
        directives: directiveList,
      };
    } catch (e) {
      e.message = `At function '${node.name.getText()}':\n${e.message}`;
      throw e;
    }
  }

  _retrieveDirectives(jsDoc:doctrine.ParseResult):types.DirectiveDefinitionNode[] {
    const directivesStart = _.findIndex(jsDoc.tags, (tag) => {
      return tag.title === 'graphql' && tag.description === 'Directives';
    });

    if (directivesStart === -1) {
      return [];
    }
    const processedTags = {};
    return _.map(jsDoc.tags.slice(directivesStart + 1), (tag) => {
      if (processedTags[tag.title])
        throw new Error(`Multiple declarations of directive ${tag.title}.`);
      processedTags[tag.title] = true;
      return this._directiveFromDocTag(tag);
    });
  }

  _walkMethodParams(paramNodes:typescript.NodeArray<typescript.ParameterDeclaration>):types.DirectiveArguments {
    const argNodes:types.TypeDefinitionMap = {};
    for (const paramNode of paramNodes) {
      const collectedNode = this._walkNode(paramNode.type!);
      argNodes[paramNode.name.getText()] = (paramNode.questionToken || this._isNullable(collectedNode)) ?
      util.unwrapNotNull(collectedNode) : util.wrapNotNull(collectedNode);
    }
    return {
      kind: types.GQLNodeKind.ARGUMENTS_DEFINITION,
      args: argNodes,
    };
  }

  _walkPropertySignature(node:typescript.PropertySignature, doc:doctrine.ParseResult | undefined):types.Node {
    const nodeType = node.type!;
    if (typescript.isFunctionTypeNode(nodeType)) {
      return this._walkMethodSignature(typescript.createMethodSignature(
        nodeType.typeParameters,
        nodeType.parameters,
        nodeType.type,
        node.name,
        node.questionToken,
      ), doc);
    }
    const signature = this._walkNode(nodeType);
    return {
      type: types.GQLNodeKind.PROPERTY,
      name: node.name.getText(),
      signature: (node.questionToken || this._isNullable(signature)) ?
      util.unwrapNotNull(signature) : util.wrapNotNull(signature),
    };
  }

  _walkTypeReferenceNode(node:typescript.TypeReferenceNode):types.Node {
    return this._referenceForSymbol(this._symbolForNode(node.typeName));
  }

  _walkTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    return this._addType(node, () => ({
      type: types.GQLNodeKind.ALIAS,
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
        type: types.GQLNodeKind.ENUM_DEFINITION,
        values,
      };
    });
  }

  _walkTypeLiteralNode(node:typescript.TypeLiteralNode):types.Node {
    return {
      type: types.GQLNodeKind.LITERAL_OBJECT,
      members: node.members.map(this._walkNode),
    };
  }

  _walkArrayTypeNode(node:typescript.ArrayTypeNode):types.NotNullWrapper<types.ListNode> {
    return {
      type: types.GQLNodeKind.NON_NULL,
      node: {
        type: types.GQLNodeKind.ARRAY,
        elements: [this._walkNode(node.elementType)],
      },
    };
  }

  _walkUnionTypeNode(node:typescript.UnionTypeNode):types.UnionNode | types.NotNullNode {
    const unionMembers = node.types.map(this._walkNode);
    const withoutNull = unionMembers.filter((member:types.Node):boolean => {
      return member.type !== types.GQLNodeKind.NULL && member.type !== types.GQLNodeKind.UNDEFINED;
    });
    const nullable = withoutNull.length !== unionMembers.length;

    // GraphQL does not allow unions with GraphQL Scalars, Unions or Scalars
    // Interpret TypeScript Union of one only primitive as a scalar
    withoutNull.map((member:types.Node) => {
      const memberNode = util.unwrapNotNull(member);
      if (memberNode.type === types.GQLNodeKind.REFERENCE) {
        const referenced = this.types[memberNode.target];
        if (referenced.kind === types.GQLNodeKind.ALIAS && util.isPrimitive(referenced.target) && withoutNull.length > 1) {
          throw new Error(`GraphQL does not support Scalar as an union member.`);
        }
        if (referenced.kind === types.GQLNodeKind.UNION_DEFINITION) {
          throw new Error(`GraphQL does not support UnionType as an union member.`);
        }
        if (referenced.kind === types.GQLNodeKind.INTERFACE_DEFINITION && !referenced.concrete) {
          throw new Error(`GraphQL does not support InterfaceType as an union member.`);
        }
      } else if (util.isPrimitive(member) && withoutNull.length > 1) {
        throw new Error(`GraphQL does not support Scalar as an union member.`);
      }
    });

    const collectedUnion = {
      type: types.GQLNodeKind.UNION_DEFINITION,
      types: withoutNull,
    } as types.UnionNode;

    if (nullable) {
      // If the union is nullable, remove the non-null property of all members
      collectedUnion.types = collectedUnion.types.map(util.unwrapNotNull);
      return collectedUnion;
    }
    return {
      type: types.GQLNodeKind.NON_NULL,
      node: collectedUnion,
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
      return {type: types.GQLNodeKind.STRING_TYPE};
    } else if (type.flags & TypeFlags.Number) {
      return {type: types.GQLNodeKind.NUMBER};
    } else if (type.flags & TypeFlags.Boolean) {
      return {type: types.GQLNodeKind.BOOLEAN_TYPE};
    } else {
      console.error(type);
      console.error(type.getSymbol()!.declarations![0].getSourceFile().fileName);
      throw new Error(`Don't know how to handle type with flags: ${type.flags}`);
    }
  }

  _walkTypeReference(type:typescript.TypeReference):types.Node {
    if (type.target && type.target.getSymbol()!.name === 'Array') {
      return {
        type: types.GQLNodeKind.ARRAY,
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
    (<types.GraphQLNode>type).documentation = util.documentationForNode(node);
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
    if (referenced && referenced.kind === types.GQLNodeKind.INTERFACE_DEFINITION) {
      referenced.concrete = true;
    }

    return {
      type: types.GQLNodeKind.REFERENCE,
      target: this._nameForSymbol(symbol),
    };
  }

  _directiveFromDocTag(jsDocTag:doctrine.Tag):types.DirectiveDefinitionNode {
    let directiveParams = {
      kind: types.GQLNodeKind.ARGUMENTS_DEFINITION,
      args: {},
    } as types.DirectiveArguments;
    if (jsDocTag.description) {
      const parser = new MethodParamsParser();
      try {
        directiveParams = parser.parse(jsDocTag.description);
      } catch (e) {
        const parsingMsg = e.message;
        throw new Error(`Failed to parse parameter list of \"${jsDocTag.title}\" directive.\n${parsingMsg}`);
      }
    }
    return {
      kind: types.GQLNodeKind.DIRECTIVE,
      name: jsDocTag.title,
      arguments?: directiveParams,
    };
  }

  _isNullable(node:types.Node):boolean {
    if (node.type === types.GQLNodeKind.REFERENCE) {
      const referenced = this.types[node.target];
      if (!referenced) {
        return false;
      }
      return this._isNullable(referenced);
    } else if (node.type === types.GQLNodeKind.ALIAS) {
      return this._isNullable(node.target);
    }
    return node.type !== types.GQLNodeKind.NON_NULL;
  }
}
