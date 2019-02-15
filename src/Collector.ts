import * as doctrine from 'doctrine';
import * as _ from 'lodash';
import * as typescript from 'typescript';

import * as types from './types';
import * as util from './util';
import * as excpt from './Exceptions';
import { MethodParamsParser } from './Parser';

const SyntaxKind = typescript.SyntaxKind;

export interface CollectorType {
  resolved:types.TypeDefinitionMap;
  root?:types.SchemaDefinitionNode;
}

/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
export class Collector implements CollectorType {
  resolved:types.TypeDefinitionMap = new Map();
  root?:types.SchemaDefinitionNode;
  private checker:typescript.TypeChecker;
  private unresolved:Map<typescript.Node, types.TypeDefinitionNode> = new Map();
  private unresolvedCircular:Map<string, typescript.TypeAliasDeclaration|typescript.InterfaceDeclaration> = new Map();
  private circularlyExtending:Set<string> = new Set();
  constructor(program:typescript.Program) {
    this.checker = program.getTypeChecker();
  }

  addRootNode(node:typescript.InterfaceDeclaration):void {
    const collectedRoot = this._walkDeclaration(node);
    if (collectedRoot.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
      this.resolved.set(collectedRoot.name, this._concrete(collectedRoot));
    } else if (collectedRoot.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION) {
      throw new excpt.InterfaceError(node,
        `Expected root definition ${node.name.getText()} as GraphQL Object definition. Got ${collectedRoot.kind}.`);
    }

    if (collectedRoot.fields.some(field => field.name !== 'query' && field.name !== 'mutation')) {
      throw new excpt.InterfaceError(node, `Schema definition may only have query or mutation fields.`);
    }

    // Update root node
    const queryField = collectedRoot.fields.find(field => field.name === 'query');
    if (!queryField) {
      throw new excpt.InterfaceError(node, `Schema definition without query field.`);
    } else if (queryField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
      throw new excpt.InterfaceError(node, `Query root definition must be a GraphQL Object.`);
    }

    this.root = {
      query: queryField.type.target,
    };

    const mutationField = collectedRoot.fields.find(field => field.name === 'mutation');
    if (mutationField) {
      if (mutationField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
        throw new excpt.InterfaceError(node, `Mutation root definition must be a GraphQL Object.`);
      }
      this.root = {
        ...this.root,
        mutation: mutationField.type.target,
      };
    }

    // Remove Root Object from type list
    this.resolved.delete(collectedRoot.name);
  }

  mergeOverrides(node:typescript.InterfaceDeclaration, name:types.SymbolName):void {
    const existing = this.resolved.get(name);
    if (!existing) {
      throw new excpt.InterfaceError(node, `Cannot override '${name}' - it was never included`);
    } else if (existing.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION
      && existing.kind !== types.GQLDefinitionKind.INTERFACE_DEFINITION) {
        throw new excpt.InterfaceError(node, `Cannot override '${name}' - it is not a GraphQL Type or Interface`);
    }
    const overrides = node.members.map(member => this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT));
    const overriddenNames = new Set(overrides.map(prop => prop.name));
    existing.fields = _(existing.fields as any)
      .filter((m:any) => !overriddenNames.has(m.name))
      .concat(overrides)
      .value();
  }

  //
  // TypeScript Node Walking
  //

  _walkDeclaration(node:typescript.Node):types.TypeDefinitionNode {
    if (this.unresolved.has(node)) {
      return this.unresolved.get(node)!;
    }
    const typeDefinition = {} as types.TypeDefinitionNode;
    this.unresolved.set(node, typeDefinition);
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
        throw new excpt.TranspilationError(node,
          `Don't know how to handle ${node.getText()} as ${SyntaxKind[node.kind]} node`);
    }

    Object.assign(typeDefinition, result);
    const pending = this.unresolvedCircular.get(typeDefinition.name);
    if (pending) {
      const pendingName = pending.name.getText();
      this.unresolved.delete(pending);
      this.resolved.delete(pendingName);
      this.unresolvedCircular.delete(typeDefinition.name);
      this.circularlyExtending.delete(pendingName);
      this._walkDeclaration(pending);
    }
    return typeDefinition;
  }

  _walkInherited(node:typescript.InterfaceDeclaration):types.ReferenceNode[] {
    const inherits:types.ReferenceNode[] = [];
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const symbol = this._symbolForNode(type.expression);
          inherits.push({
            nullable: false,
            target: this._nameForSymbol(symbol),
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

  _walkTypeReferenceNode(node:typescript.TypeReferenceNode):types.ReferenceTypeNode | types.IntTypeNode
  | types.IDTypeNode {
    if (!node.typeName.getText()) {
      throw new Error(`Missing reference name.`);
    }
    return this._collectReferenceForSymbol(this._symbolForNode(node.typeName));
  }

  _walkType = (node:typescript.Node):types.TypeNode => {
    let result;
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
        throw new Error(`Unsupported TypeScript type ${SyntaxKind[node.kind]}.`);
    }
    return result;
  }

  _walkUnion(node:typescript.UnionTypeNode):types.TypeNode;
  _walkUnion(node:typescript.UnionTypeNode, name:types.SymbolName,
  doc?:doctrine.ParseResult):types.UnionTypeDefinitionNode | types.ScalarTypeDefinitionNode | types.DefinitionAliasNode
  | types.EnumTypeDefinitionNode;
  _walkUnion(node:typescript.UnionTypeNode, name?:types.SymbolName,
  doc?:doctrine.ParseResult):types.TypeNode | types.UnionTypeDefinitionNode | types.ScalarTypeDefinitionNode
  | types.EnumTypeDefinitionNode | types.DefinitionAliasNode {
    return name ? this._collectUnionDefinition(node, name, doc) : this._collectUnionExpression(node);
  }

  _walkUnionMembersFlat(unionTypes:typescript.Node[]):types.TypeNode[] {
    const collectedMembers = unionTypes.map((type) => {
      const collected = this._walkType(type);
      if (collected.kind !== types.GQLTypeKind.UNION_TYPE) {
        return collected;
      }
      const referenced = this.resolved.get(collected.target)! as types.UnionTypeDefinitionNode;
      return referenced.members;
    });
    return _.flatten<types.TypeNode>(collectedMembers);
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
      throw new excpt.InterfaceError(node, e.message);
    }

    if (ownFields.length !== _.uniqBy(ownFields, field => field.name).length) {
      throw new excpt.InterfaceError(node, `Conflicting field names.`);
    }

    const inheritedFields = _.flatten(inherits.map((inherited:types.ReferenceNode) => {
      const inheritedName = inherited.target;
      const inheritedDefinition = this._unwrapAlias(this.resolved.get(inheritedName)!);

      if (!inheritedDefinition) {
        // Circularly extending a TypeScript interface. Ignore and schedule revisiting
        this.unresolvedCircular.set(inherited.target, node);
        this.circularlyExtending.add(name);
        return [];
      } else if (!inheritedDefinitionChecker(inheritedDefinition)) {
          const expectedType = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
          : `${types.GQLDefinitionKind.OBJECT_DEFINITION} or ${types.GQLDefinitionKind.INTERFACE_DEFINITION}`;
          const msg = `Incompatible inheritance of '${inheritedDefinition.name}'.`
          + ` Expected type '${expectedType}', got '${inheritedDefinition.kind}'.`;
          throw new excpt.InterfaceError(node, msg);
      }
      if (this.circularlyExtending.has(inheritedName)) {
        // If extending interface found a circular reference, this interface may need to update its fields later on
        this.unresolvedCircular.set(inheritedName, node);
      }
      return inheritedDefinition.fields as types.FieldDefinitionNode[];
    }));
    const inheritedPropNames = inheritedFields.map(field => field.name);
    if (_.uniq(inheritedPropNames).length !== inheritedPropNames.length) {
      throw new excpt.InterfaceError(node, `There are conflicting properties between inherited TypeScript interfaces.`);
    }

    const ownFieldNames = new Set(ownFields.map(field => field.name));
    const mergedFields = _.concat(ownFields, inheritedFields.filter((inheritedField) => {
      return !ownFieldNames.has(inheritedField.name);
    }));

    if (mergedFields.length === 0) {
      throw new excpt.InterfaceError(node, `GraphQL does not allow Objects and Interfaces without fields.`);
    }

    const collected = {
      documentation,
      description: this._collectDescription(documentation),
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
    let signature;
    let signatureType;
    let name;
    let args;
    if (typescript.isMethodSignature(field)) {
      signature = field;
      signatureType = signature.type!;
      name = signature.name.getText();
      if (category === types.GQLTypeCategory.INPUT) {
        const msg = `GraphQL Input Objects Fields must not have argument lists.`;
        throw new Error(`At property '${name}'\n${msg}`);
      }
      args = this._collectArgumentsDefinition(signature.parameters);
    } else if (typescript.isPropertySignature(field)) {
      signature = field;
      signatureType = signature.type!;
      name = signature.name.getText();
      if (typescript.isFunctionTypeNode(signatureType)) {
        if (category === types.GQLTypeCategory.INPUT) {
          const msg = `GraphQL Input Objects Fields must not have argument lists.`;
          throw new Error(`At property '${name}'\n${msg}`);
        }
        args = this._collectArgumentsDefinition(signatureType.parameters);
      }
    } else {
      throw new excpt.PropertyError(field, `TypeScript ${field.kind} doesn't have a valid Field Signature.`);
    }

    let type:types.TypeNode;
    try {
      type = this._walkType(typescript.isFunctionTypeNode(signatureType) ? signatureType.type! : signatureType);
    } catch (e) {
      throw new excpt.PropertyError(field, e.message);
    }

    const unwrappedType = util.isWrappingType(type) ? type.wrapped : type;
    // When circularly referencing:
    if (unwrappedType.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
      const circularlyReferenced = this.resolved.get(unwrappedType.target);
      if (circularlyReferenced && circularlyReferenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
        // Aliases are not reliable and demand to recollect the current node
        this.unresolvedCircular.set(unwrappedType.target, field.parent! as typescript.InterfaceDeclaration);
      }
      if (category === types.GQLTypeCategory.INPUT) {
        // If field of future GraphQL Input, expect TypeScript interface/type to be reference to GraphQL Input
        type = {
          nullable: type.nullable,
          target: unwrappedType.target,
          kind: types.GQLTypeKind.INPUT_OBJECT_TYPE,
        };
      } else {
        // If field of future GraphQL Object/Interface, expect TypeScript interface/type to be GraphQL Object
        type = {
          nullable: type.nullable,
          target: unwrappedType.target,
          kind: types.GQLTypeKind.OBJECT_TYPE,
        };
      }
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
        throw new excpt.PropertyError(field, e.message);
      }
    }

    if (category === types.GQLTypeCategory.OUTPUT) {
      if (!util.isOutputType(type)) {
        const acceptedOutputs = 'Scalars, Input Objects and Enums';
        const kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
        const msg = `Input Object field types accept only GraphQL ${acceptedOutputs}. Got ${kind}.`;
        throw new excpt.PropertyError(field, msg);
      }
    } else if (category === types.GQLTypeCategory.INPUT) {
      if (!util.isInputType(type)) {
        const acceptedOutputs = 'Scalars, Objects, Interfaces, Unions and Enums';
        const kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
        const msg = `Object field types accept only GraphQL ${acceptedOutputs}. Got ${kind}.`;
        throw new excpt.PropertyError(field, msg);
      }
    } else {
      throw new excpt.PropertyError(field, `Invalid Field Kind ${type.kind}`);
    }

    return {
      documentation,
      description: this._collectDescription(documentation),
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
    const inputValues = params.map(this._collectInputValueDefinition);
    if (inputValues.length !== _.uniqBy(inputValues, input => input.name).length) {
      throw new Error(`Conflicting parameters in argument list.`);
    }
    return inputValues;
  }

  _collectInputValueDefinition = (param:typescript.ParameterDeclaration):types.InputValueDefinitionNode => {
    const name = param.name.getText();
    const collected = this._walkType(param.type!);
    if (!util.isInputType(collected)) {
      const kind = util.isWrappingType(collected) ? collected.wrapped.kind : collected.kind;
      const msg = `Argument lists accept only GraphQL Scalars, Enums and Input Object types. Got ${kind}.`;
      throw new excpt.InputValueError(param, msg);
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

  _collectReferenceForSymbol(symbol:typescript.Symbol):types.ReferenceTypeNode | types.IntTypeNode | types.IDTypeNode {
    const referenced = this._walkSymbolDeclaration(symbol);
    const name = this._nameForSymbol(symbol);
    if (!referenced) {
      throw new Error(`Could not find declaration for symbol '${name}'.`);
    } else if (!this.resolved.get(name)) {
      return {
        nullable: false,
        target: name,
        kind: types.GQLTypeKind.CIRCULAR_TYPE,
      };
    }

    let nullable = false;
    // Inherit nullable property from definition if available
    if (util.isNullableDefinition(referenced)) {
      nullable = referenced.nullable;
    }
    const reference  = {
      target: name,
      nullable,
    } as types.ReferenceTypeNode | types.IntTypeNode | types.IDTypeNode;

    let unwrappedReferenced = referenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS ?
    this._unwrapAlias(referenced) : referenced;
    if (!unwrappedReferenced) {
      return {
        ...reference,
        kind: types.GQLTypeKind.CIRCULAR_TYPE,
        target: referenced.name,
      };
    } else if (unwrappedReferenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
      const concreteReference = this._concrete(unwrappedReferenced);
      this.resolved.set(name, concreteReference);
      unwrappedReferenced = concreteReference;
    }

    let kind:types.ReferenceTypeNode['kind'] | types.GQLTypeKind.INT_TYPE | types.GQLTypeKind.ID_TYPE | undefined;
    kind = types.DefinitionFromType.get(unwrappedReferenced.kind);
    // Scalar definitions may mean Int or ID TypeScript definition
    if (referenced.kind === types.GQLDefinitionKind.SCALAR_DEFINITION && referenced.builtIn) {
      kind = referenced.builtIn;
    }

    if (!kind) {
      throw new Error(`Invalid DefinitionKind ${referenced.name}`);
    }

    reference.kind = kind;

    return reference;
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
    const doc = util.documentationForNode(node);
    let definition:types.ScalarTypeDefinitionNode | types.UnionTypeDefinitionNode | types.EnumTypeDefinitionNode |
    types.DefinitionAliasNode;
    try {
      if (typescript.isUnionTypeNode(node.type)) {
        definition = this._walkUnion(node.type, name, doc);
      } else {
        const aliasType = this._walkType(node.type);
        if (util.isBuiltInScalar(aliasType)) {
          definition = {
            documentation: doc,
            description: this._collectDescription(doc),
            name,
            nullable: aliasType.nullable,
            kind: types.GQLDefinitionKind.SCALAR_DEFINITION,
          };
          definition.builtIn = this._collectIntOrIDKind(aliasType, doc);
        } else if (util.isReferenceType(aliasType)) {
          if (aliasType.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
            if (aliasType.target === name) {
              throw new Error(`An alias can not alias itself.`);
            }
            // Enqueue this alias resolution
            this.unresolvedCircular.set(aliasType.target, node);
          }
          definition = {
            documentation: doc,
            description: this._collectDescription(doc),
            name,
            kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
            nullable: aliasType.nullable,
            target: aliasType.target,
          };
        } else {
          throw new Error(`Unsupported alias for GraphQL type ${aliasType.kind}`);
        }
      }
    } catch (e) {
      throw new excpt.TypeAliasError(node, e.message);
    }
    return this._addTypeDefinition(definition);
  }

  _collectIntOrIDKind(type:types.TypeNode, doc:doctrine.ParseResult|undefined):types.GQLTypeKind.INT_TYPE |
  types.GQLTypeKind.ID_TYPE | undefined {
    if (util.extractTagDescription(doc, /^[Ii]nt$/)) {
      if (type.kind !== types.GQLTypeKind.FLOAT_TYPE) {
        throw new Error(`GraphQL Int is incompatible with type ${type.kind}`);
      }
      return types.GQLTypeKind.INT_TYPE;
    } else if (util.extractTagDescription(doc, /^(ID)|(Id)|(id)$/)) {
      if (type.kind !== types.GQLTypeKind.STRING_TYPE && type.kind !== types.GQLTypeKind.FLOAT_TYPE) {
        throw new Error(`GraphQL ID is incompatible with type ${type.kind}`);
      }
      return types.GQLTypeKind.ID_TYPE;
    }

    return undefined;
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

  _collectUnionDefinition(node:typescript.UnionTypeNode, name:types.SymbolName,
  doc?:doctrine.ParseResult):types.UnionTypeDefinitionNode | types.ScalarTypeDefinitionNode
  | types.EnumTypeDefinitionNode | types.DefinitionAliasNode {
    const description = this._collectDescription(doc);
    const unionMembers = this._walkUnionMembersFlat(this._filterNullUndefined(node.types));
    const nullable = unionMembers.length < node.types.length || unionMembers.every(member => member.nullable);

    // Only one member: create alias nullable by default
    if (unionMembers.length === 1 ) {
      const nonNullMember = unionMembers[0];
      if (util.isWrappingType(nonNullMember)) {
        throw new Error(`Cannot create alias for GraphQL Wrapping Types.`);
      }
      if (util.isBuiltInScalar(nonNullMember)) {
        const intOrID = this._collectIntOrIDKind(nonNullMember, doc);
        if (intOrID) {
          throw new Error(`Can not define ${name} as ${intOrID}.`
          + ` GraphQL BuiltIn Primitives can not be nullable by default.`);
        }
        return {
          name,
          nullable,
          kind: types.GQLDefinitionKind.SCALAR_DEFINITION,
        };
      }
      if (nonNullMember.target === name) {
        throw new Error(`An alias can not alias itself`);
      }
      return {
        documentation: doc,
        description,
        name,
        nullable,
        kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
        target: nonNullMember.target,
      };
    }

    // If all elements are enums, build a merged single enum
    if (unionMembers.every(member => member.kind === types.GQLTypeKind.ENUM_TYPE)) {
      const enumReferences = unionMembers as types.EnumTypeNode[];
      const enums = enumReferences.map(member => this.resolved.get(member.target)) as types.EnumTypeDefinitionNode[];
      return {
        documentation: doc,
        description,
        kind: types.GQLDefinitionKind.ENUM_DEFINITION,
        name,
        nullable,
        fields: _.uniqBy(_.flatten(enums.map(enumDef => enumDef.fields)), enumField => enumField.name),
      };
    }

    // GraphQL Union only allow GraphQL Objects as members
    const collectedUnion = unionMembers.map((member) => {
      if (member.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
        // Circular reference: assume it's an unresolved object type but schedule revisiting
        this.unresolvedCircular.set(member.target, node.parent! as typescript.TypeAliasDeclaration);
        return {
          kind: types.GQLTypeKind.OBJECT_TYPE,
          nullable: member.nullable,
          target: member.target,
        } as types.ObjectTypeNode;
      }
      if (member.kind !== types.GQLTypeKind.OBJECT_TYPE) {
        throw new Error(`GraphQL does not support ${member.kind} as an union member.`);
      }
      return member;
   });

    return {
      documentation: doc,
      description,
      kind: types.GQLDefinitionKind.UNION_DEFINITION,
      name,
      nullable,
      members: _.uniqBy(collectedUnion, member => member.target),
    };
  }

  _collectEnumDeclaration(node:typescript.EnumDeclaration):types.EnumTypeDefinitionNode {
    // If the user provides an initializer, ignore and use the initializer itself.
    // The initializer regards server functioning and should not interfere in protocol description.
    const fields = _.uniqBy(node.members.map<types.EnumFieldDefinitionNode>((member) => {
      const fieldDoc = util.documentationForNode(member);
      const fieldDesc = this._collectDescription(fieldDoc);
      const value = _.trim(member.name.getText(), "'\"");
      return {
        documentation: fieldDoc,
        description: fieldDesc,
        kind:types.GQLDefinitionKind.ENUM_FIELD_DEFINITION,
        name: value,
      };
    }).filter(field => field.name), field => field.name);
    if (fields.length === 0) {
      throw new excpt.EnumError(node, `GraphQL Enums must have at least one or more unique enum values.`);
    }
    const documentation = util.documentationForNode(node);
    const description = this._collectDescription(documentation);
    return this._addTypeDefinition({
      documentation,
      description,
      name: node.name.getText(),
      nullable: false,
      kind: types.GQLDefinitionKind.ENUM_DEFINITION,
      fields,
    });
  }

  _collectDescription(doc:doctrine.ParseResult|undefined):string|undefined {
    const tagPattern = /^[Dd]escription\s+((?:.|\s)+)$/;
    const description = util.extractTagDescription(doc, tagPattern);
    if (!description) {
      return undefined;
    }
    const extracted = description.match(tagPattern);
    return extracted ? extracted[1] : '';
  }

  // Utility

  _addTypeDefinition<T extends types.TypeDefinitionNode>(typeDefinition:T):T {
    const name = typeDefinition.name;
    const defined = this.resolved.get(name);
    if (defined) {
      throw new Error(`Conflicting references for symbol ${name}.`
      + `Defined as ${defined.kind} and ${typeDefinition.kind}.`);
    }
    this.resolved.set(name, typeDefinition);
    return typeDefinition;
  }

  _symbolForNode(node:typescript.Node):typescript.Symbol {
    const symbol = this.checker.getSymbolAtLocation(node);
    if (!symbol) {
      throw new Error(`Could not find declaration for symbol ${node.getText()}`);
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
    const concrete = {} as types.ObjectTypeDefinitionNode;
    Object.assign(concrete, node);
    concrete.kind = types.GQLDefinitionKind.OBJECT_DEFINITION;
    return concrete;
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

  _unwrapAlias(referenced:types.TypeDefinitionNode):types.TypeDefinitionNode|undefined {
    let aliasedRef:types.DefinitionAliasNode|types.TypeDefinitionNode = referenced;
      while (aliasedRef.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
        const aliasedTarget = this.resolved.get(aliasedRef.target);
        if (!aliasedTarget) {
          return undefined;
        }
        aliasedRef = aliasedTarget;
      }
      return aliasedRef;
  }
}
