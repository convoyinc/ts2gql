import { ReferenceTypeNode } from './types';
import * as doctrine from 'doctrine';

export type SymbolName = string;

// GraphQL language description:
// https://facebook.github.io/graphql/June2018

export interface TranspiledNode {
  documentation?:doctrine.ParseResult;
  description?:string;
  originalLine?:number;
  originalColumn?:number;
}

export enum GQLDefinitionKind {
  // Definitions
  OBJECT_DEFINITION = 'object definition',
  INTERFACE_DEFINITION = 'interface definition',
  ENUM_DEFINITION = 'enum definition',
  INPUT_OBJECT_DEFINITION = 'input object definition',
  UNION_DEFINITION = 'union definition',
  SCALAR_DEFINITION = 'scalar definition',
  FIELD_DEFINITION = 'field definition',
  INPUT_VALUE_DEFINITION = 'input value definition',
  ENUM_FIELD_DEFINITION = 'enum field definition',
  DEFINITION_ALIAS = 'definition alias',
  // Directives
  DIRECTIVE = 'directive',
  DIRECTIVE_INPUT_VALUE_DEFINITION = 'directive input value definition',
}

export enum GQLTypeKind {
  // Wrapping Types
  LIST_TYPE = 'list',
  // Types
  REFERENCE = 'reference',
  OBJECT_TYPE = 'object type',
  INTERFACE_TYPE = 'interface type',
  ENUM_TYPE = 'enum type',
  INPUT_OBJECT_TYPE = 'input object type',
  UNION_TYPE = 'union type',
  CIRCULAR_TYPE = 'circular type',
  CUSTOM_SCALAR_TYPE = 'custom scalar',
  STRING_TYPE = 'string',
  INT_TYPE = 'int',
  FLOAT_TYPE = 'float',
  BOOLEAN_TYPE = 'boolean',
  ID_TYPE = 'id',
  // Values
  STRING_LITERAL = 'string literal',
  VALUE = 'value',
}

//
// Abstractions
//
export interface NamedNode {
  name:SymbolName;
}

export interface NullableNode {
  nullable:boolean;
}

export interface ReferenceNode extends NullableNode {
  target:SymbolName;
}

//
// Root node
//
export interface SchemaDefinitionNode extends TranspiledNode {
  query:SymbolName;
  mutation?:SymbolName;
}

//
// Type Definitions
//
export interface GraphQLDefinitionNode extends TranspiledNode, NamedNode {
  kind:GQLDefinitionKind;
}

export interface ObjectTypeDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.OBJECT_DEFINITION;
  fields:OutputFieldDefinitionNode[];
  implements:ReferenceNode[];
}

export interface InterfaceTypeDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.INTERFACE_DEFINITION;
  fields:OutputFieldDefinitionNode[];
  implements:ReferenceNode[];
}

export interface InputObjectTypeDefinition extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.INPUT_OBJECT_DEFINITION;
  fields:InputFieldDefinitionNode[];
  implements:ReferenceNode[];
}

export interface EnumTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
  kind:GQLDefinitionKind.ENUM_DEFINITION;
  fields:EnumFieldDefinitionNode[];
}

export interface UnionTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
  kind:GQLDefinitionKind.UNION_DEFINITION;
  members:ObjectTypeNode[];
}

export interface ScalarTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
  kind:GQLDefinitionKind.SCALAR_DEFINITION;
  builtIn?:GQLTypeKind.INT_TYPE|GQLTypeKind.ID_TYPE;
}

export interface DefinitionAliasNode extends GraphQLDefinitionNode, NullableNode, ReferenceNode {
  kind:GQLDefinitionKind.DEFINITION_ALIAS;
}

export type TypeDefinitionNode = ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode | EnumTypeDefinitionNode |
InputObjectTypeDefinition | UnionTypeDefinitionNode | ScalarTypeDefinitionNode | DefinitionAliasNode;

export type TypeDefinitionMap = Map<string, TypeDefinitionNode>;

//
// Other Definitions
//

export interface FieldDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.FIELD_DEFINITION;
  category:GQLTypeCategory;
  type:InputTypeNode | OutputTypeNode;
  arguments?:InputValueDefinitionNode[];
  directives?:DirectiveDefinitionNode[];
}

export interface InputFieldDefinitionNode extends FieldDefinitionNode {
  category:GQLTypeCategory.INPUT;
  type:InputTypeNode;
}

export interface OutputFieldDefinitionNode extends FieldDefinitionNode {
  category:GQLTypeCategory.OUTPUT;
  type:OutputTypeNode;
}

export interface InputValueDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.INPUT_VALUE_DEFINITION;
  value:InputTypeNode;
}

export interface DirectiveDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.DIRECTIVE;
  args:DirectiveInputValueNode[];
}

export interface DirectiveInputValueNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.DIRECTIVE_INPUT_VALUE_DEFINITION;
  value:ValueNode;
}

export interface EnumFieldDefinitionNode extends GraphQLDefinitionNode {
  kind:GQLDefinitionKind.ENUM_FIELD_DEFINITION;
}

//
// Types
//

// General definitions

export interface GraphQLTypeNode extends TranspiledNode {
  kind:GQLTypeKind;
}

export enum GQLTypeCategory {
  INPUT = 'input',
  OUTPUT = 'output',
}

export type NamedInputTypeNode = ScalarTypeNode | EnumTypeNode | InputObjectTypeNode;
export type NamedOutputTypeNode = ScalarTypeNode | ObjectTypeNode | InterfaceTypeNode | UnionTypeNode | EnumTypeNode;
export type NamedTypeNode = NamedInputTypeNode | NamedOutputTypeNode | CircularReferenceTypeNode;

export type WrappingInputTypeNode = ListInputTypeNode;
export type WrappingOutputTypeNode = ListOutputTypeNode;
export type WrappingTypeNode = ListInputTypeNode | ListOutputTypeNode | ListTypeNode;

export type InputTypeNode = NamedInputTypeNode | WrappingInputTypeNode;
export type OutputTypeNode = NamedOutputTypeNode | WrappingOutputTypeNode;
export type TypeNode = NamedTypeNode | WrappingTypeNode;

// Wrapping Types

export interface WrappingNode<T extends GraphQLTypeNode | ReferenceNode> extends GraphQLTypeNode, NullableNode {
  wrapped:T;
}

export interface ListNode<T extends GraphQLTypeNode & NullableNode> extends WrappingNode<T | ListNode<T>> {
  kind:GQLTypeKind.LIST_TYPE;
}

export type ListInputTypeNode = ListNode<NamedInputTypeNode>;
export type ListOutputTypeNode = ListNode<NamedOutputTypeNode>;
export type ListTypeNode = ListNode<NamedTypeNode>;

// Named Types

export type ReferenceTypeNode = ObjectTypeNode | InterfaceTypeNode | EnumTypeNode | InputObjectTypeNode | UnionTypeNode
| CustomScalarTypeNode | CircularReferenceTypeNode;

export const DefinitionFromType = new Map<GQLDefinitionKind, ReferenceTypeNode['kind']>([
  [GQLDefinitionKind.OBJECT_DEFINITION, GQLTypeKind.OBJECT_TYPE],
  [GQLDefinitionKind.INTERFACE_DEFINITION, GQLTypeKind.INTERFACE_TYPE],
  [GQLDefinitionKind.ENUM_DEFINITION, GQLTypeKind.ENUM_TYPE],
  [GQLDefinitionKind.INPUT_OBJECT_DEFINITION, GQLTypeKind.INPUT_OBJECT_TYPE],
  [GQLDefinitionKind.UNION_DEFINITION, GQLTypeKind.UNION_TYPE],
  [GQLDefinitionKind.SCALAR_DEFINITION, GQLTypeKind.CUSTOM_SCALAR_TYPE],
]);

export interface ObjectTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.OBJECT_TYPE;
}

export interface InterfaceTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.INTERFACE_TYPE;
}

export interface EnumTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.ENUM_TYPE;
}

export interface InputObjectTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.INPUT_OBJECT_TYPE;
}

export interface UnionTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.UNION_TYPE;
}

// This type is a reference to a unresolved definition
// Definitions having this type as leaf must assume it is according to expectations
export interface CircularReferenceTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.CIRCULAR_TYPE;
}

// Scalar Types

export interface CustomScalarTypeNode extends GraphQLTypeNode, ReferenceNode {
  kind:GQLTypeKind.CUSTOM_SCALAR_TYPE;
}

export interface StringTypeNode extends GraphQLTypeNode, NullableNode {
  kind:GQLTypeKind.STRING_TYPE;
}

export interface IntTypeNode extends GraphQLTypeNode, NullableNode {
  kind:GQLTypeKind.INT_TYPE;
}

export interface FloatTypeNode extends GraphQLTypeNode, NullableNode {
  kind:GQLTypeKind.FLOAT_TYPE;
}

export type NumberTypeNode = IntTypeNode | FloatTypeNode;

export interface BooleanTypeNode extends GraphQLTypeNode, NullableNode {
  kind:GQLTypeKind.BOOLEAN_TYPE;
}

export interface IDTypeNode extends GraphQLTypeNode, NullableNode {
  kind:GQLTypeKind.ID_TYPE;
}

export type BuiltInScalarTypeNode = StringTypeNode | NumberTypeNode | BooleanTypeNode | IDTypeNode;
export type ScalarTypeNode = CustomScalarTypeNode | BuiltInScalarTypeNode;

// Currently we have no distinction between values: they're string-represented
export interface ValueNode extends GraphQLTypeNode {
  kind:GQLTypeKind.VALUE;
  value:string;
}
