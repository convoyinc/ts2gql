import { NamedInputTypeNode, FieldDefinitionNode } from './types';
import * as doctrine from 'doctrine';
import { MethodParamsParser } from './Parser';

export type SymbolName = string;

// GraphQL language description:
// https://facebook.github.io/graphql/June2018

export interface TranspiledNode {
  documentation?:doctrine.ParseResult;
  originalLine?:number;
  originalColumn?:number;
}

export interface GraphQLNode extends TranspiledNode {
  kind:GQLNodeKind;
}

export enum GQLNodeKind {
  // Type Definitions
  OBJECT_DEFINITION = 'object definition',
  INTERFACE_DEFINITION = 'interface definition',
  ENUM_DEFINITION = 'enum definition',
  INPUT_OBJECT_DEFINITION = 'input object definition',
  UNION_DEFINITION = 'union definition',
  SCALAR_DEFINITION = 'scalar definition',
  FIELD_DEFINITION = 'field definition',
  ARGUMENTS_DEFINITION = 'arguments definition',
  INPUT_VALUE_DEFINITION = 'input value definition',
  DIRECTIVE = 'directive',
  DIRECTIVE_INPUT_VALUE_DEFINITION = 'directive input value definition',
  // Wrapping Types
  NON_NULL = 'non null',
  LIST = 'list',
  // ??
  REFERENCE = 'reference',
  // Types
  OBJECT_TYPE = 'object type',
  INTERFACE_TYPE = 'interface type',
  ENUM_TYPE = 'enum type',
  INPUT_OBJECT_TYPE = 'input object type',
  UNION_TYPE = 'union type',
  STRING_TYPE = 'string',
  INT_TYPE = 'int',
  FLOAT_TYPE = 'float',
  BOOLEAN_TYPE = 'boolean',
  ID_TYPE = 'id',
  CUSTOM_SCALAR = 'custom scalar',
  // Value Nodes
  STRING_LITERAL = 'string literal',
  VALUE = 'value',
}

//
// Abstractions
//
export interface NamedNode extends GraphQLNode {
  name:SymbolName;
}

//
// Root node
//
export interface SchemaDefinitionNode extends GraphQLNode {
  query:ObjectTypeDefinitionNode;
  mutation?:ObjectTypeDefinitionNode;
}

//
// Type Definitions
//
export interface ObjectTypeDefinitionNode extends NamedNode {
  kind:GQLNodeKind.OBJECT_DEFINITION;
  fields:OutputFieldDefinitionNode[];
}

export interface InterfaceTypeDefinitionNode extends NamedNode {
  kind:GQLNodeKind.INTERFACE_DEFINITION;
  fields:OutputFieldDefinitionNode[];
}

export type DerivedFromTSInterface = Object

export interface EnumTypeDefinitionNode extends NamedNode {
  kind:GQLNodeKind.ENUM_DEFINITION;
  values:string[];
}

export interface InputObjectTypeDefinition extends NamedNode {
  kind:GQLNodeKind.INPUT_OBJECT_DEFINITION;
  fields:InputFieldDefinitionNode[];
}

export interface UnionTypeDefinitionNode extends NamedNode {
  kind:GQLNodeKind.UNION_DEFINITION;
  members:ObjectTypeNode[];
}

export interface ScalarTypeDefinitionNode extends NamedNode {
  kind:GQLNodeKind.SCALAR_DEFINITION;
}

export type TypeDefinitionNode = ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode | EnumTypeDefinitionNode |
InputObjectTypeDefinition | UnionTypeDefinitionNode | ScalarTypeDefinitionNode;

export type TypeDefinitionMap = {[key:string]:TypeDefinitionNode};

//
// Other Definitions
//

export interface FieldDefinitionNode extends NamedNode {
  kind:GQLNodeKind.FIELD_DEFINITION;
  type:NamedTypeNode;
  arguments?:ArgumentsDefinitionNode;
  directives?:DirectiveDefinitionNode[];
}

export interface InputFieldDefinitionNode extends FieldDefinitionNode {
  type:NamedInputTypeNode;
}

export interface OutputFieldDefinitionNode extends FieldDefinitionNode {
  type:NamedOutputTypeNode;
}

export interface ArgumentsDefinitionNode extends GraphQLNode {
  kind:GQLNodeKind.ARGUMENTS_DEFINITION;
  args:InputValueDefinitionNode[];
}

export interface InputValueDefinitionNode extends NamedNode {
  kind:GQLNodeKind.INPUT_VALUE_DEFINITION;
  value:ScalarTypeNode | ReferenceTypeNode;
}

export interface DirectiveDefinitionNode extends NamedNode {
  kind:GQLNodeKind.DIRECTIVE;
  arguments:DirectiveInputValueNode[];
}

export interface DirectiveInputValueNode extends NamedNode {
  kind:GQLNodeKind.DIRECTIVE_INPUT_VALUE_DEFINITION;
  value:ValueNode;
}

//
// Types
//

// General definitions

export type NamedInputTypeNode = ScalarTypeNode | EnumTypeNode | InputObjectTypeNode;
export type NamedOutputTypeNode = ScalarTypeNode | ObjectTypeNode | InterfaceTypeNode | UnionTypeNode | EnumTypeNode;
type NamedTypeNode = NamedInputTypeNode | NamedOutputTypeNode;

type WrappingInputTypeNode = NonNullInputTypeNode | ListInputTypeNode;
type WrappingOutputTypeNode = NonNullOutputTypeNode | ListOutputTypeNode;

type InputTypeNode = NamedInputTypeNode | WrappingInputTypeNode;
type OutputTypeNode = NamedOutputTypeNode | WrappingOutputTypeNode;
type TypeNode = InputTypeNode | OutputTypeNode;

// Wrapping Types

interface WrappingTypeNode<T extends GraphQLNode> extends GraphQLNode {
  wrapped:T;
}

export interface NonNullTypeNode<T extends NamedTypeNode> extends WrappingTypeNode<T | ListTypeNode<T>> {
  kind:GQLNodeKind.NON_NULL;
}

export type NonNullInputTypeNode = NonNullTypeNode<NamedInputTypeNode>;
export type NonNullOutputTypeNode = NonNullTypeNode<NamedOutputTypeNode>;

interface ListTypeNode<T extends NamedTypeNode> extends WrappingTypeNode<T | NonNullTypeNode<T> | ListTypeNode<T>> {
  kind:GQLNodeKind.LIST;
}

export type ListInputTypeNode = ListTypeNode<NamedInputTypeNode>;
export type ListOutputTypeNode = ListTypeNode<NamedOutputTypeNode>;

// Named Types

interface ReferenceTypeNode extends GraphQLNode {
  definitionTarget:SymbolName;
}

export interface ObjectTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.OBJECT_TYPE;
}

export interface InterfaceTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.INTERFACE_TYPE;
}

export interface EnumTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.ENUM_TYPE;
}

export interface InputObjectTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.INPUT_OBJECT_TYPE;
}

export interface UnionTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.UNION_TYPE;
}

// Scalar Types

export interface CustomScalarTypeNode extends ReferenceTypeNode {
  kind:GQLNodeKind.CUSTOM_SCALAR;
}

export interface StringTypeNode extends GraphQLNode {
  kind:GQLNodeKind.STRING_TYPE;
}

export interface IntTypeNode extends GraphQLNode {
  kind:GQLNodeKind.INT_TYPE;
}

export interface FloatTypeNode extends GraphQLNode {
  kind:GQLNodeKind.FLOAT_TYPE;
}

type NumberTypeNode = IntTypeNode | FloatTypeNode;

export interface BooleanTypeNode extends GraphQLNode {
  kind:GQLNodeKind.BOOLEAN_TYPE;
}

export interface IDTypeNode extends GraphQLNode {
  kind:GQLNodeKind.ID_TYPE;
}

export type BuiltInScalarTypeNode = StringTypeNode | NumberTypeNode | BooleanTypeNode | IDTypeNode;
export type ScalarTypeNode = CustomScalarTypeNode | BuiltInScalarTypeNode;

//
// Misc
//
export interface StringLiteralNode {
  type:GQLNodeKind.STRING_LITERAL;
  value:string;
}

// Currently we have no distinction between values: they're string-represented
export interface ValueNode {
  type:GQLNodeKind.VALUE;
  value:string;
}

export interface Parser<T> {
  result:T;
}

export interface MethodParamsParser extends Parser<ArgumentsDefinitionNode> {

}