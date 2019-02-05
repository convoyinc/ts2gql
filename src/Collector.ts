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
    const collectedRoot = this._walkDeclaration(node);
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
        // TODO : Verify this is working
        console.error(node);
        console.error(`On file ${node.getSourceFile().fileName}`);
        console.error(`Line ${node.getSourceFile().getStart()}`);
        throw new Error(`Don't know how to handle ${node.getText()} as ${SyntaxKind[node.kind]} node`);
    }

    if (result) {
      Object.assign(typeDefinition, result);
    }
    return typeDefinition;
  }

  _walkInherited(node:typescript.InterfaceDeclaration):types.SymbolName[] {
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

  _walkType(node:typescript.Node):types.TypeNode {
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
        // TODO
        result = this._walkTypeReferenceNode(node as typescript.TypeReferenceNode);
        break;
      case SyntaxKind.UnionType:
        // TODO
        result = this._walkUnionTypeNode(node as typescript.UnionTypeNode);
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
      return definition.kind === types.GQLNodeKind.INPUT_OBJECT_DEFINITION;
    }
    : (definition:types.TypeDefinitionNode):definition is types.ObjectTypeDefinitionNode |
    types.InterfaceTypeDefinitionNode => {
      return definition.kind === types.GQLNodeKind.OBJECT_DEFINITION
      || definition.kind === types.GQLNodeKind.INTERFACE_DEFINITION;
    };

    const ownFields = node.members.map(member => {
      if (isInput) {
        return this._collectFieldDefinition(member, types.GQLTypeCategory.INPUT);
      }
      return this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT);
    });

    const inheritedFields = _.flatten(inherits.map((inheritedName:string) => {
      const inheritedDefinition = this.types[inheritedName];
      if (!inheritedDefinitionChecker(inheritedDefinition)) {
          const expectedType = isInput ? types.GQLNodeKind.INPUT_OBJECT_DEFINITION
          : `${types.GQLNodeKind.OBJECT_DEFINITION} or ${types.GQLNodeKind.INTERFACE_DEFINITION}`;
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

    const collected = {
      documentation,
      name,
      fields: mergedFields,
    } as types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition;
    collected.kind = isInput ? types.GQLNodeKind.INPUT_OBJECT_DEFINITION : types.GQLNodeKind.INTERFACE_DEFINITION;
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
      args = this._collectArgumentsDefinition(signature.parameters);
    } else if (field.kind === SyntaxKind.PropertySignature) {
      signature = field as typescript.PropertySignature;
    } else {
      throw new Error(`TypeScript ${field.kind} doesn't have a valid Field Signature.`);
    }
    const name = signature.name.getText();

    const type = this._walkType(signature.type!);
    if (!util.isOutputType(type)) {
      const acceptedOutputs = 'Scalars, Objects, Interfaces, Unions and Enums';
      const kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
      const msg = `Argument lists accept only GraphQL ${acceptedOutputs}. Got ${kind}.`;
      throw new Error(`At property ${name}\n${msg}`);
    }
    if (field.kind === SyntaxKind.PropertySignature && field.questionToken) {
        type.nullable = false;
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
      kind: types.GQLNodeKind.FIELD_DEFINITION,
      category,
      type,
      arguments: args,
      directives,
    };
  }

  _collectArgumentsDefinition(params:typescript.NodeArray<typescript.ParameterDeclaration>)
  :types.ArgumentsDefinitionNode {
    return {
      kind: types.GQLNodeKind.ARGUMENTS_DEFINITION,
      args: params.map(this._collectInputValueDefinition),
    };
  }

  _collectInputValueDefinition(param:typescript.ParameterDeclaration):types.InputValueDefinitionNode {
    const name = param.name.getText();
    const collected = this._walkType(param.type!);
    if (!util.isInputType(collected)) {
      const kind = util.isWrappingType(collected) ? collected.wrapped.kind : collected.kind;
      const msg = `Argument lists accept only GraphQL Scalars, Enums and Input Object types. Got ${kind}.`;
      throw new Error(`At parameter ${name}\n${msg}`);
    }
    if (param.questionToken) {
      collected.nullable = true;
  }
    return {
      name,
      kind: types.GQLNodeKind.INPUT_VALUE_DEFINITION,
      value: collected,
    };
  }

  _collectReferenceForSymbol(symbol:typescript.Symbol):types.ReferenceTypeNode {
    this._walkSymbolDeclaration(symbol);
    const name = this._nameForSymbol(symbol);
    const reference = this.types[name];
    if (!reference) {
      throw new Error(`Symbol '${name}' was not declared.`);
    } else if (reference.kind === types.GQLNodeKind.INTERFACE_DEFINITION) {
      this.types[name] = this._concrete(reference);
    }

    return {
      definitionTarget: name,
      nullable: reference.kind === types.GQLNodeKind.UNION_DEFINITION ? reference.nullable : false,
      kind: types.DefinitionFromType[reference.kind],
    };
  }

  _collectList(node:typescript.ArrayTypeNode):types.ListTypeNode {
    return {
      kind: types.GQLNodeKind.LIST_TYPE,
      nullable: false,
      wrapped: this._walkType(node.elementType),
    };
  }

  _collectBuiltInScalar(kind:typescript.SyntaxKind):types.BuiltInScalarTypeNode {
    switch (kind) {
      case SyntaxKind.StringKeyword:
        return {
          nullable: false,
          kind: types.GQLNodeKind.STRING_TYPE,
        };
      case SyntaxKind.BooleanKeyword:
        return {
          nullable: false,
          kind: types.GQLNodeKind.BOOLEAN_TYPE,
        };
      case SyntaxKind.NumberKeyword:
        return {
          nullable: false,
          kind: types.GQLNodeKind.FLOAT_TYPE,
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

  _collectTypeAliasDeclaration(node:typescript.TypeAliasDeclaration):types.Node {
    // TODO : Deal with JSDoc
    return this._addTypeDefinition(node, () => ({
      type: types.GQLNodeKind.ALIAS,
      target: this._walkDeclaration(node.type),
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

  _walkUnionTypeNode(node:typescript.UnionTypeNode):types.UnionNode | types.NotNullNode {
    const unionMembers = node.types.map(this._walkDeclaration);
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
        if (referenced.kind === types.GQLNodeKind.ALIAS && util.isBuiltInScalar(referenced.target) && withoutNull.length > 1) {
          throw new Error(`GraphQL does not support Scalar as an union member.`);
        }
        if (referenced.kind === types.GQLNodeKind.UNION_DEFINITION) {
          throw new Error(`GraphQL does not support UnionType as an union member.`);
        }
        if (referenced.kind === types.GQLNodeKind.INTERFACE_DEFINITION && !referenced.concrete) {
          throw new Error(`GraphQL does not support InterfaceType as an union member.`);
        }
      } else if (util.isBuiltInScalar(member) && withoutNull.length > 1) {
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
      type: types.GQLNodeKind.NON_NULL_TYPE,
      node: collectedUnion,
    };
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
}