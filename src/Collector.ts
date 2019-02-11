import * as doctrine from 'doctrine';
import * as _ from 'lodash';
import * as typescript from 'typescript';

import * as types from './types';
import * as util from './util';
import { MethodParamsParser } from './Parser';

const SyntaxKind = typescript.SyntaxKind;

export interface CollectorType {
  types:types.TypeDefinitionMap;
  root?:types.SchemaDefinitionNode;
}

/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
export class Collector implements CollectorType {
  types:types.TypeDefinitionMap = new Map();
  root?:types.SchemaDefinitionNode;
  private checker:typescript.TypeChecker;
  private ts2GqlMap:Map<typescript.Node, types.TypeDefinitionNode> = new Map();
  private gql2TsMap:Map<types.SymbolName, typescript.Node> = new Map();

  constructor(program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node:typescript.InterfaceDeclaration):void {
    const collectedRoot = this._walkDeclaration(node);
    if (collectedRoot.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
      this.types.set(collectedRoot.name, this._concrete(collectedRoot));
    } else if (collectedRoot.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION) {
      throw new Error(`Expected root definition ${node.name.getText()} as GraphQL Object definition.`
      + `Got ${collectedRoot.kind}.`);
    }

    // Update root node
    const queryField = collectedRoot.fields.find(field => field.name === 'query');
    if (!queryField) {
      console.error(node);
      console.error(`On file ${node.getSourceFile().fileName}`);
      throw new Error(`Schema definition without query field.`);
    } else if (queryField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
      throw new Error(`Query root definition must be a GraphQL Object.`);
    }

    this.root = {
      query: queryField.type.target,
    };

    const mutationField = collectedRoot.fields.find(field => field.name === 'mutation');
    if (mutationField) {
      if (mutationField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
        throw new Error(`Mutation root definition must be a GraphQL Object.`);
      }
      this.root = {
        ...this.root,
        mutation: mutationField.type.target,
      };
    }

    // Remove Root Object from type list
    this.types.delete(collectedRoot.name);
  }

  mergeOverrides(node:typescript.InterfaceDeclaration, name:types.SymbolName):void {
    const existing = this.types.get(name);
    if (!existing) {
      throw new Error(`Cannot override '${name}' - it was never included`);
    } else if (existing.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION
      && existing.kind !== types.GQLDefinitionKind.INTERFACE_DEFINITION) {
        throw new Error(`Cannot override '${name}' - it is not a GraphQL Type or Interface`);
    }
    const overrides = node.members.map(member => this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT));
    const overriddenNames = new Set(overrides.map(prop => prop.name));
    existing.fields = _(existing.fields)
      .filter(m => !overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  //
  // TypeScript Node Walking
  //

  _walkDeclaration(node:typescript.Node):types.TypeDefinitionNode {
    if (this.ts2GqlMap.has(node)) {
      return this.ts2GqlMap.get(node)!;
    }
    const typeDefinition = {} as types.TypeDefinitionNode;
    this.ts2GqlMap.set(node, typeDefinition);
    // console.log(`Cached ${node.getText()}`)
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
        // TODO : Verify this is working
        console.error(node);
        console.error(`On file ${node.getSourceFile().fileName}`);
        console.error(`Line ${node.getSourceFile().getStart()}`);
        throw new Error(`Don't know how to handle ${node.getText()} as ${SyntaxKind[node.kind]} node`);
    }

    Object.assign(typeDefinition, result);
    return typeDefinition;
  }

  _walkInherited(node:typescript.InterfaceDeclaration):types.ReferenceNode[] {
    const inherits:types.ReferenceNode[] = [];
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const symbol = this._symbolForNode(type.expression);
          const inheritedDeclaration = this._walkSymbolDeclaration(symbol);
          inherits.push({
            nullable: false,
            target: inheritedDeclaration.name,
          });
        }
      }
    }
    return inherits;
  }

  _walkSymbolDeclaration = (symbol:typescript.Symbol):types.TypeDefinitionNode => {
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) {
      throw new Error(`Could not find TypeScript declarations for symbol ${symbol.name}.`);
    } else if (declarations.length > 1) {
      throw new Error(`Conflicting declarations for symbol ${symbol.name}.`);
    }
    return this._walkDeclaration(declarations[0]);
  }

  _walkTypeReferenceNode(node:typescript.TypeReferenceNode):types.ReferenceTypeNode {
    return this._collectReferenceForSymbol(this._symbolForNode(node.typeName));
  }

  _walkType = (node:typescript.Node):types.TypeNode => {
    let result:types.TypeNode;
    switch (node.kind) {
      case SyntaxKind.ParenthesizedType:
        const parenthesizedNode = node as typescript.ParenthesizedTypeNode;
        result = this._walkType(parenthesizedNode.type);
        break;
      case SyntaxKind.ArrayType:
        result = this._collectList(node as typescript.ArrayTypeNode);
        break;
      case SyntaxKind.TypeReference:
        result = this._walkTypeReferenceNode(node as typescript.TypeReferenceNode);
        break;
      case SyntaxKind.UnionType:
        result = this._walkUnion(node as typescript.UnionTypeNode);
        break;
      case SyntaxKind.StringKeyword:
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.BooleanKeyword:
        result = this._collectBuiltInScalar(node.kind);
        break;
      default:
        console.error(node);
        console.error(node.getSourceFile().fileName);
        console.error(`Line ${node.getSourceFile().getStart()}`);
        throw new Error(`Unsupported TypeScript type ${SyntaxKind[node.kind]}.`);
    }
    return result;
  }

  _walkUnion(node:typescript.UnionTypeNode):types.TypeNode;
  _walkUnion(node:typescript.UnionTypeNode, name:types.SymbolName):types.UnionTypeDefinitionNode |
  types.DefinitionAliasNode;
  _walkUnion(node:typescript.UnionTypeNode, name?:types.SymbolName):types.UnionTypeDefinitionNode |
  types.DefinitionAliasNode | types.TypeNode {
    return name ? this._collectUnionDefinition(node, name) : this._collectUnionExpression(node);
  }

  //
  // GraphQL Node Collecting
  //

  _collectInterfaceDeclaration(node:typescript.InterfaceDeclaration)
  :types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition {
    const documentation = util.documentationForNode(node);
    const name = this._nameForSymbol(this._symbolForNode(node.name));
    const inherits = this._walkInherited(node);

    const isInput = !!documentation && !!_.find(documentation.tags, (tag:doctrine.Tag) => {
      return tag.title === 'graphql' && /^[Ii]nput$/.test(tag.description);
    });

    const inheritedDefinitionChecker = isInput ?
    (definition:types.TypeDefinitionNode):definition is types.InputObjectTypeDefinition => {
      return definition.kind === types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION;
    }
    : (definition:types.TypeDefinitionNode):definition is types.ObjectTypeDefinitionNode |
    types.InterfaceTypeDefinitionNode => {
      return definition.kind === types.GQLDefinitionKind.OBJECT_DEFINITION
      || definition.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION;
    };

    let ownFields;
    try {
      ownFields = node.members.map(member => {
        if (isInput) {
          return this._collectFieldDefinition(member, types.GQLTypeCategory.INPUT);
        }
        return this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT);
      });
    } catch (e) {
      e.message = `At interface '${name}'\n${e.message}`;
      throw e;
    }

    const inheritedFields = _.flatten(inherits.map((inherited:types.ReferenceNode) => {
      const inheritedName = inherited.target;
      const inheritedDefinition = this.types.get(inheritedName);
      if (!inheritedDefinition) {
        throw new Error(`Could not find declaration for '${inheritedName}'.`);
      } else if (!inheritedDefinitionChecker(inheritedDefinition)) {
          const expectedType = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
          : `${types.GQLDefinitionKind.OBJECT_DEFINITION} or ${types.GQLDefinitionKind.INTERFACE_DEFINITION}`;
          const msg = `Incompatible inheritance of '${inheritedDefinition.name}'.`
          + ` Expected type '${expectedType}', got '${inheritedDefinition.kind}'.`;
          throw new Error(`At interface '${name}'\n${msg}`);
      }
      return inheritedDefinition.fields as types.FieldDefinitionNode[];
    }));

    const inheritedPropNames = inheritedFields.map(field => field.name);
    if (_.uniq(inheritedPropNames).length !== inheritedPropNames.length) {
      const msg = `There are conflicting properties between inherited TypeScript interfaces.`;
      throw new Error(`At interface '${name}'\n${msg}`);
    }

    const ownFieldNames = new Set(ownFields.map(field => field.name));
    const mergedFields = _.concat(ownFields, inheritedFields.filter((inheritedField) => {
      return !ownFieldNames.has(inheritedField.name);
    }));

    if (mergedFields.length === 0) {
      const msg = `GraphQL does not allow Objects and Interfaces without fields.`;
      throw new Error(`At interface '${name}'\n${msg}`);
    }

    const collected = {
      documentation,
      name,
      implements: inherits,
      fields: mergedFields,
    } as types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition;
    collected.kind = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
    : types.GQLDefinitionKind.INTERFACE_DEFINITION;
    return this._addTypeDefinition(collected);
  }

  _collectFieldDefinition(field:typescript.TypeElement, category:types.GQLTypeCategory.INPUT)
  :types.InputFieldDefinitionNode;
  _collectFieldDefinition(field:typescript.TypeElement, category:types.GQLTypeCategory.OUTPUT)
  :types.OutputFieldDefinitionNode;
  _collectFieldDefinition(field:typescript.TypeElement, category:types.GQLTypeCategory):types.FieldDefinitionNode {
    let signature:typescript.MethodSignature|typescript.PropertySignature;
    let args;
    if (field.kind === SyntaxKind.MethodSignature || (field.kind === SyntaxKind.PropertySignature &&
    typescript.isFunctionTypeNode((field as typescript.PropertySignature).type!))) {
      signature = field as typescript.MethodSignature;
      if (category === types.GQLTypeCategory.INPUT) {
        const msg = `GraphQL Input Objects Fields must not have argument lists.`;
        throw new Error(`At property '${signature.name.getText()}'\n${msg}`);
      }
      try {
        args = this._collectArgumentsDefinition(signature.parameters);
      } catch (e) {
        e.message = `At function property ${signature.name.getText()}\n${e.message}`;
      }
    } else if (field.kind === SyntaxKind.PropertySignature) {
      signature = field as typescript.PropertySignature;
    } else {
      throw new Error(`TypeScript ${field.kind} doesn't have a valid Field Signature.`);
    }
    const name = signature.name.getText();

    let type;
    try {
      type = this._walkType(signature.type!);
    } catch (e) {
      e.message = `At property ${name}\n${e.message}`;
      throw e;
    }

    if (!util.isOutputType(type)) {
      const acceptedOutputs = 'Scalars, Objects, Interfaces, Unions and Enums';
      const kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
      const msg = `Argument lists accept only GraphQL ${acceptedOutputs}. Got ${kind}.`;
      throw new Error(`At property ${name}\n${msg}`);
    }
    if (field.kind === SyntaxKind.PropertySignature && field.questionToken) {
        type.nullable = true;
    }

    const documentation = util.documentationForNode(field);
    let directives;
    if (category === types.GQLTypeCategory.OUTPUT) {
      try {
        directives = documentation ? this._collectDirectives(documentation) : [];
      } catch (e) {
        e.message = `At property '${name}'\n${e.message}`;
        throw e;
      }
    }

    return {
      documentation,
      name,
      kind: types.GQLDefinitionKind.FIELD_DEFINITION,
      category,
      type,
      arguments: args,
      directives,
    };
  }

  _collectArgumentsDefinition(params:typescript.NodeArray<typescript.ParameterDeclaration>)
  :types.InputValueDefinitionNode[] {
    return params.map(this._collectInputValueDefinition);
  }

  _collectInputValueDefinition = (param:typescript.ParameterDeclaration):types.InputValueDefinitionNode => {
    const name = param.name.getText();
    const collected = this._walkType(param.type!);
    if (!util.isInputType(collected)) {
      const kind = util.isWrappingType(collected) ? collected.wrapped.kind : collected.kind;
      const msg = `Argument lists accept only GraphQL Scalars, Enums and Input Object types. Got ${kind}.`;
      throw new Error(`At parameter '${name}'\n${msg}`);
    }
    if (param.questionToken) {
      collected.nullable = true;
  }
    return {
      name,
      kind: types.GQLDefinitionKind.INPUT_VALUE_DEFINITION,
      value: collected,
    };
  }

  _collectReferenceForSymbol(symbol:typescript.Symbol):types.ReferenceTypeNode {
    let referenced = this._walkSymbolDeclaration(symbol);
    const name = this._nameForSymbol(symbol);

    if (!referenced) {
      throw new Error(`Could not find declaration for symbol '${name}'.`);
    } else if (referenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
      const concreteReference = this._concrete(referenced);
      this.ts2GqlMap.set(this.gql2TsMap.get(referenced.name)!, concreteReference);
      this.types.set(name, concreteReference);
      referenced = concreteReference;
    }

    let nullable = false;
    // Inherit nullable property from definition if available
    if (referenced.kind === types.GQLDefinitionKind.UNION_DEFINITION
    || referenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
      nullable = referenced.nullable;
    }

    let kind = types.DefinitionFromType[referenced.kind];
    // Scalar definitions may mean Int or ID TypeScript definition
    if (referenced.kind === types.GQLDefinitionKind.SCALAR_DEFINITION && referenced.builtIn) {
      kind = referenced.builtIn;
    }

    return {
      target: name,
      nullable,
      kind,
    };
  }

  _collectList(node:typescript.ArrayTypeNode):types.ListTypeNode {
    return {
      kind: types.GQLTypeKind.LIST_TYPE,
      nullable: false,
      wrapped: this._walkType(node.elementType),
    };
  }

  _collectBuiltInScalar(kind:typescript.SyntaxKind):types.BuiltInScalarTypeNode {
    switch (kind) {
      case SyntaxKind.StringKeyword:
        return {
          nullable: false,
          kind: types.GQLTypeKind.STRING_TYPE,
        };
      case SyntaxKind.BooleanKeyword:
        return {
          nullable: false,
          kind: types.GQLTypeKind.BOOLEAN_TYPE,
        };
      case SyntaxKind.NumberKeyword:
        return {
          nullable: false,
          kind: types.GQLTypeKind.FLOAT_TYPE,
        };
      default:
        throw new Error(`TypeScript '${kind}' is not a GraphQL BuiltIn Scalar`);
    }
  }

  _collectDirectives(jsDoc:doctrine.ParseResult):types.DirectiveDefinitionNode[] {
    const directivesStart = _.findIndex(jsDoc.tags, (tag) => {
      return tag.title === 'graphql' && /^[Dd]irectives$/.test(tag.description);
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

  _collectTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.ScalarTypeDefinitionNode |
  types.UnionTypeDefinitionNode | types.EnumTypeDefinitionNode | types.DefinitionAliasNode {
    const name = node.name.getText();
    let definition:types.ScalarTypeDefinitionNode | types.UnionTypeDefinitionNode | types.EnumTypeDefinitionNode |
    types.DefinitionAliasNode;
    if (node.type!.kind === SyntaxKind.UnionType) {
      return this._walkUnion(node.type! as typescript.UnionTypeNode, name);
    } else {
      const aliasType = this._walkType(node.type);
      const doc = util.documentationForNode(node.type);

      if (util.isBuiltInScalar(aliasType)) {
        definition = {
          name,
          kind: types.GQLDefinitionKind.SCALAR_DEFINITION,
        };
        if (util.extractTagDescription(doc, /^[Ii]nt$/)) {
          if (aliasType.kind !== types.GQLTypeKind.FLOAT_TYPE) {
            const msg = `GraphQL Int is incompatible with type ${aliasType.kind}`;
            throw new Error(`At TypeScript Alias ${name}\n${msg}`);
          }
          definition.builtIn = types.GQLTypeKind.INT_TYPE;
        } else if (util.extractTagDescription(doc, /^(ID)|(Id)|(id)$/)) {
          if (aliasType.kind !== types.GQLTypeKind.STRING_TYPE && aliasType.kind !== types.GQLTypeKind.FLOAT_TYPE) {
            const msg = `GraphQL ID is incompatible with type ${aliasType.kind}`;
            throw new Error(`At TypeScript Alias '${name}'\n${msg}`);
          }
          definition.builtIn = types.GQLTypeKind.ID_TYPE;
        }
      } else if (util.isReferenceType(aliasType)) {
        definition = {
          name,
          kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
          nullable: aliasType.nullable,
          target: aliasType.target,
        };
      } else {
        console.error(node);
        console.error(`On file ${node.getSourceFile().fileName}`);
        console.error(`Line ${node.getSourceFile().getStart()}`);
        const msg = `Unsupported alias for GraphQL type ${aliasType.kind}`;
        throw new Error(`At TypeScript Alias '${name}'\n${msg}`);
      }
    }
    return this._addTypeDefinition(definition);
  }

  _collectUnionExpression = (node:typescript.UnionTypeNode):types.TypeNode => {
    const unionMembers = this._filterNullUndefined(node.types).map(this._walkType);
    if (unionMembers.length < 1) {
      throw new Error(`Empty union expression.`);
    } else if (unionMembers.length > 1) {
      throw new Error(`Union expressions are only allowed to have a single type reference.`
      + ` For multiple type references, please use create an appropriate GraphQL Union.`);
    }

    const member = unionMembers[0];
    if (unionMembers.length !== node.types.length) {
      member.nullable = true;
    }

    return member;
  }

  _collectUnionDefinition(node:typescript.UnionTypeNode, name:types.SymbolName):types.UnionTypeDefinitionNode |
  types.DefinitionAliasNode {
    const unionMembers = this._filterNullUndefined(node.types).map(this._walkType);
    const nullable = unionMembers.length < node.types.length || unionMembers.every(member => member.nullable);

    // GraphQL only allow unions of GraphQL Objects
    const collectedUnion = unionMembers.map((member) => {
      if (member.kind !== types.GQLTypeKind.OBJECT_TYPE) {
        throw new Error(`GraphQL does not support ${member.kind} as an union member.`);
      }
      return member;
    });

    // Only one member: create alias
    if (collectedUnion.length === 1 ) {
      return {
        kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
        name,
        nullable,
        target: collectedUnion[0].target,
      };
    }

    return this._addTypeDefinition({
      kind: types.GQLDefinitionKind.UNION_DEFINITION,
      name,
      nullable,
      members: collectedUnion,
    });
  }

  _collectEnumDeclaration(node:typescript.EnumDeclaration):types.EnumTypeDefinitionNode {
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
    return this._addTypeDefinition({
      name: node.name.getText(),
      kind: types.GQLDefinitionKind.ENUM_DEFINITION,
      values,
    });
  }

  // Utility

  _addTypeDefinition<T extends types.TypeDefinitionNode>(typeDefinition:T):T {
    const name = typeDefinition.name;
    const defined = this.types.get(name);
    if (defined) {
      throw new Error(`Conflicting references for symbol ${name}.`
      + `Defined as ${defined.kind} and ${typeDefinition.kind}.`);
    }
    this.types.set(name, typeDefinition);
    return typeDefinition;
  }

  _symbolForNode(node:typescript.Node):typescript.Symbol {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`Could not find symbol for\n${node.getText()}`);
    }
    return this._expandSymbol(symbol);
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

  _concrete(node:types.InterfaceTypeDefinitionNode):types.ObjectTypeDefinitionNode {
    return {
      documentation: node.documentation,
      originalLine: node.originalLine,
      originalColumn: node.originalColumn,
      kind: types.GQLDefinitionKind.OBJECT_DEFINITION,
      name: node.name,
      implements: node.implements,
      fields: node.fields,
    };
  }

  _directiveFromDocTag(jsDocTag:doctrine.Tag):types.DirectiveDefinitionNode {
    let directiveParams = [] as types.DirectiveInputValueNode[];
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
      kind: types.GQLDefinitionKind.DIRECTIVE,
      name: jsDocTag.title,
      args: directiveParams,
    };
  }

  _filterNullUndefined(nodes:typescript.NodeArray<typescript.Node>):typescript.Node[] {
    return nodes.filter((node) => {
      return node.kind !== SyntaxKind.NullKeyword && node.kind !== SyntaxKind.UndefinedKeyword;
    });
  }
}
