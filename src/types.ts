import * as doctrine from 'doctrine';
import { MethodParamsParser } from './Parser';

export type SymbolName = string;

export interface ComplexNode {
  documentation?:doctrine.ParseResult;
  type:NodeType;
}

export enum NodeType {
  INTERFACE = 'interface',
  METHOD = 'method',
  METHOD_PARAMS = 'method params',
  DIRECTIVE = 'directive',
  ARRAY = 'array',
  REFERENCE = 'reference',
  PROPERTY = 'property',
  ALIAS = 'alias',
  ENUM = 'enum',
  UNION = 'union',
  LITERAL_OBJECT = 'literal object',
  STRING_LITERAL = 'string literal',
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ANY = 'any',
  NULL = 'null',
  UNDEFINED = 'undefined',
  NOT_NULL = 'not null',
  VALUE = 'value',
}

export interface InterfaceNode extends ComplexNode {
  type:NodeType.INTERFACE;
  members:FieldNode[];
  inherits:SymbolName[];
  concrete?:boolean; // Whether the type is directly used (returned).
}

export interface MethodNode extends ComplexNode {
  type:NodeType.METHOD;
  name:string;
  parameters:MethodParamsNode;
  returns:Node;
  directives:DirectiveNode[];
}

export interface MethodParamsNode extends ComplexNode {
  type:NodeType.METHOD_PARAMS;
  args:TypeMap;
}

export interface DirectiveNode extends ComplexNode {
  type:NodeType.DIRECTIVE;
  name:string;
  params:MethodParamsNode;
}

export interface ArrayNode extends ComplexNode {
  type:NodeType.ARRAY;
  elements:Node[];
}

export interface ReferenceNode extends ComplexNode {
  type:NodeType.REFERENCE;
  target:SymbolName;
}

export interface PropertyNode extends ComplexNode {
  type:NodeType.PROPERTY;
  name:string;
  signature:Node;
}

export interface AliasNode extends ComplexNode {
  type:NodeType.ALIAS;
  target:Node;
}

export interface EnumNode extends ComplexNode {
  type:NodeType.ENUM;
  values:string[];
}

export interface UnionNode extends ComplexNode {
  type:NodeType.UNION;
  types:Node[];
}

export interface LiteralObjectNode {
  type:NodeType.LITERAL_OBJECT;
  members:Node[];
}

export interface StringLiteralNode {
  type:NodeType.STRING_LITERAL;
  value:string;
}

export interface StringNode {
  type:NodeType.STRING;
}

export interface NumberNode {
  type:NodeType.NUMBER;
}

export interface BooleanNode {
  type:NodeType.BOOLEAN;
}

export interface AnyNode {
  type:NodeType.ANY;
}

export interface NullNode {
  type:NodeType.NULL;
}

export interface UndefinedNode {
  type:NodeType.UNDEFINED;
}

export interface NotNullNode {
  type:NodeType.NOT_NULL;
  node:Node;
}

export interface ValueNode {
  type:NodeType.VALUE;
  value:string;
}

export type Node =
  InterfaceNode |
  MethodNode |
  ArrayNode |
  ReferenceNode |
  PropertyNode |
  AliasNode |
  EnumNode |
  UnionNode |
  LiteralObjectNode |
  StringLiteralNode |
  StringNode |
  NumberNode |
  BooleanNode |
  NullNode |
  UndefinedNode |
  NotNullNode |
  AnyNode |
  ValueNode;

export type ScalarNode = StringNode | NumberNode | BooleanNode;

export type FieldNode = MethodNode | PropertyNode;

export type TypeMap = {[key:string]:Node};

export interface Parser<T> {
  result:T;
}

export interface MethodParamsParser extends Parser<MethodParamsNode> {

}
