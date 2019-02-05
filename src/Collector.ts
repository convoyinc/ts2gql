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
  private nodeMap:Map<typescript.Node, types.TypeDefinitionNode> = new Map();

  constructor(program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node:typescript.InterfaceDeclaration):void {
    const collectedRoot = this._walkTypeDefinition(node);
    if (collectedRoot.kind === types.GQLNodeKind.INTERFACE_DEFINITION) {
      this.types[this._nameForSymbol(this._symbolForNode(node))] = this._concrete(collectedRoot);
    } else if (collectedRoot.kind !== types.GQLNodeKind.OBJECT_DEFINITION) {
      throw new Error(`Expected root definition ${node.name.getText()} as GraphQL Object definition.`
      + `Got ${collectedRoot.kind}. `);
    }
  }

  mergeOverrides(node:typescript.InterfaceDeclaration, name:types.SymbolName):void {
    const existing = this.types[name];
    if (!existing) {
      throw new Error(`Cannot override '${name}' - it was never included`);
    } else if (existing.kind !== types.GQLNodeKind.OBJECT_DEFINITION
      && existing.kind !== types.GQLNodeKind.INTERFACE_DEFINITION) {
        throw new Error(`Cannot override '${name}' - it is not a GraphQL Type or Interface`);
    }
    const overrides = node.members.map(member => this._collectFieldDefinition<types.OutputFieldDefinitionNode>(member));
    const overriddenNames = new Set(overrides.map(prop => prop.name));
    existing.fields = _(existing.fields)
      .filter(m => !overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  // Node Walking

  _walkTypeDefinition = (node:typescript.Node):types.TypeDefinitionNode => {
    if (this.nodeMap.has(node)) {
      return this.nodeMap.get(node)!;
    }
    const typeDefinition = {} as types.TypeDefinitionNode;
    this.nodeMap.set(node, typeDefinition);
    let result = null as types.TypeDefinitionNode | null;

    switch (node.kind) {
      case SyntaxKind.InterfaceDeclaration:
        result = this._collectInterfaceDeclaration(node as typescript.InterfaceDeclaration);
        break;
      case SyntaxKind.TypeAliasDeclaration:
        result = this._collectTypeAliasDeclaration(node as typescript.TypeAliasDeclaration);
        break;
      case SyntaxKind.EnumDeclaration:
        result = this._collectEnumDeclaration(node as typescript.EnumDeclaration);
        break;
      default:
        // TODO : Verify this
        console.error(node);
        console.error(`On file ${node.getSourceFile().fileName}`);
        console.error(`On line ${node.getSourceFile().getStart()}`);
        throw new Error(`Don't know how to handle Type Definition from TypeScript ${SyntaxKind[node.kind]} nodes`);
    }

    if (result) {
      Object.assign(typeDefinition, result);
    }
    return typeDefinition;
  }

  _walkSymbolDeclaration = (symbol:typescript.Symbol):types.TypeDefinitionNode[] => {
    return _.map(symbol.getDeclarations(), d => this._walkTypeDefinition(d));
  }

  _collectInterfaceDeclaration(node:typescript.InterfaceDeclaration)
  :types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition {
    const documentation = util.documentationForNode(node);
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    const inherits = this._collectInherited(node);

    const isInput = !!documentation && !!_.find(documentation.tags, (tag:doctrine.Tag) => {
      return tag.title === 'graphql' && /^[Ii]nput$/.test(tag.description);
    });

    const inheritedDefinitionChecker = isInput ?
    (definition:types.TypeDefinitionNode):definition is types.InputObjectTypeDefinition => {
      return definition.kind === types.GQLNodeKind.INPUT_OBJECT_DEFINITION;
    }
    : (definition:types.TypeDefinitionNode):definition is types.ObjectTypeDefinitionNode |
    types.InterfaceTypeDefinitionNode => {
      return definition.kind === types.GQLNodeKind.OBJECT_DEFINITION
      || definition.kind === types.GQLNodeKind.INTERFACE_DEFINITION;
    };

    const ownFields:types.FieldDefinitionNode[] = isInput ?
    node.members.map(member => this._collectFieldDefinition<types.InputFieldDefinitionNode>(member))
    : node.members.map(member => this._collectFieldDefinition<types.OutputFieldDefinitionNode>(member));

    const inheritedFields = _.flatten(inherits.map((inheritedName:string) => {
      const inheritedDefinition = this.types[inheritedName];
      if (!inheritedDefinitionChecker(inheritedDefinition)) {
          const expectedType = isInput ? types.GQLNodeKind.INPUT_OBJECT_DEFINITION
          : `${types.GQLNodeKind.OBJECT_DEFINITION} or ${types.GQLNodeKind.INTERFACE_DEFINITION}` ;
          throw new Error(`Incompatible inheritance between '${name}' and '${inheritedDefinition.name}'.`
          + ` Expected type '${expectedType}', got '${inheritedDefinition.kind}'.`);
      }
      return inheritedDefinition.fields as types.FieldDefinitionNode[];
    }));

    const inheritedPropNames = inheritedFields.map(field => field.name);
    if (_.uniq(inheritedPropNames).length !== inheritedPropNames.length) {
      throw new Error(`There are conflicting properties between TypeScript interfaces inherited by '${name}'.`);
    }

    const ownFieldNames = new Set(ownFields.map(field => field.name));
    const mergedFields = _.concat(ownFields, inheritedFields.filter((inheritedField) => {
      return !ownFieldNames.has(inheritedField.name);
    }));

    const collected = {
      documentation,
      name,
      fields: mergedFields,
    } as types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition;
    collected.kind = isInput ? types.GQLNodeKind.INPUT_OBJECT_DEFINITION : types.GQLNodeKind.INTERFACE_DEFINITION;
    return this._addTypeDefinition(collected);
  }

  _collectInherited(node:typescript.InterfaceDeclaration):string[] {
    const inherits:string[] = [];
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const symbol = this._symbolForNode(type.expression);
          this._walkSymbolDeclaration(symbol);
          inherits.push(this._nameForSymbol(symbol));
        }
      }
    }
    return inherits;
  }

  _collectFieldDefinition<T extends types.FieldDefinitionNode>(field:typescript.TypeElement):T {
    if (field.kind === SyntaxKind.MethodSignature) {

    } else if (field.kind === SyntaxKind.PropertySignature) {

    } else {
      throw new Error(`TypeScript ${field.kind} doesn't have a valid Field Signature.`);
    }
  }

  _walkTypeDefinition = (node:typescript.Node):types.Node => {
    // Reentrant node walking.
    if (this.nodeMap.has(node)) {
      return this.nodeMap.get(node) as types.Node;
    }
    const nodeReference:types.Node = <types.Node>{};
    this.nodeMap.set(node, nodeReference);
    const doc =  util.documentationForNode(node);

    let result:types.Node|null = null;
    if (node.kind === SyntaxKind.MethodSignature) {
      result = this._walkMethodSignature(<typescript.MethodSignature>node, doc);
    } else if (node.kind === SyntaxKind.PropertySignature) {
      result = this._walkPropertySignature(<typescript.PropertySignature>node, doc);
    } else if (node.kind === SyntaxKind.TypeReference) {
      result = this._walkTypeReferenceNode(<typescript.TypeReferenceNode>node);
    } else if (node.kind === SyntaxKind.TypeLiteral) {
      result = this._walkTypeLiteralNode(<typescript.TypeLiteralNode>node);
    } else if (node.kind === SyntaxKind.ParenthesizedType) {
      const parenthesizedNode = node as typescript.ParenthesizedTypeNode;
      result = this._walkTypeDefinition(parenthesizedNode.type);
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

  _walkMethodSignature(node:typescript.MethodSignature, doc:doctrine.ParseResult | undefined):types.Node {
    try {
      const parameters:types.DirectiveArguments = this._walkMethodParams(node.parameters);
      const collectedReturn = this._walkTypeDefinition(node.type!);
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
      const collectedNode = this._walkTypeDefinition(paramNode.type!);
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
    const signature = this._walkTypeDefinition(nodeType);
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

  _collectTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    // TODO : Deal with JSDoc
    return this._addTypeDefinition(node, () => ({
      type: types.GQLNodeKind.ALIAS,
      target: this._walkTypeDefinition(node.type),
    }));
  }

  _collectEnumDeclaration(node:typescript.EnumDeclaration):types.Node {
    // TODO : Deal with JSDoc
    return this._addTypeDefinition(node, () => {
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
      members: node.members.map(this._walkTypeDefinition),
    };
  }

  _walkArrayTypeNode(node:typescript.ArrayTypeNode):types.NotNullWrapper<types.ListNode> {
    return {
      type: types.GQLNodeKind.NON_NULL,
      node: {
        type: types.GQLNodeKind.ARRAY,
        elements: [this._walkTypeDefinition(node.elementType)],
      },
    };
  }

  _walkUnionTypeNode(node:typescript.UnionTypeNode):types.UnionNode | types.NotNullNode {
    const unionMembers = node.types.map(this._walkTypeDefinition);
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
      return this._walkTypeDefinition(type.getSymbol()!.declarations![0]);
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

  _addTypeDefinition<T extends types.TypeDefinitionNode>(typeDefinition:T):T {
    const name = typeDefinition.name;
    const defined = this.types[name];
    if (defined) {
      throw new Error(`Conflicting references for symbol ${name}.`
      + `Defined as ${defined.kind} and ${typeDefinition.kind}.`);
    }
    return this.types[name] = typeDefinition;
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
    this._walkSymbolDeclaration(symbol);
    const referenced = this.types[this._nameForSymbol(symbol)];
    if (referenced && referenced.kind === types.GQLNodeKind.INTERFACE_DEFINITION) {
      referenced.concrete = true;
    }

    return {
      type: types.GQLNodeKind.REFERENCE,
      target: this._nameForSymbol(symbol),
    };
  }

  _concrete(node:types.InterfaceTypeDefinitionNode):types.ObjectTypeDefinitionNode {
    return {
      documentation: node.documentation,
      originalLine: node.originalLine,
      originalColumn: node.originalColumn,
      kind: types.GQLNodeKind.OBJECT_DEFINITION,
      name: node.name,
      fields: node.fields,
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