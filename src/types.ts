import * as doctrine from 'doctrine';

export type SymbolName = string;

export interface BaseNode {
  exportedAs?:{
    fileName:string;
    path:string[];
  };
}

export interface ComplexNode extends BaseNode {
  documentation?:doctrine.ParseResult;
}

export interface InterfaceNode extends ComplexNode {
  type:'interface';
  members:NamedNode[];
  inherits:SymbolName[];
  concrete?:boolean; // Whether the type is directly used (returned).
}

export interface MethodNode extends ComplexNode {
  type:'method';
  name:string;
  parameters:{[key:string]:Node};
  returns:Node;
}

export interface ArrayNode extends ComplexNode {
  type:'array';
  elements:Node[];
}

export interface ReferenceNode extends ComplexNode {
  type:'reference';
  target:SymbolName;
}

export interface PropertyNode extends ComplexNode {
  type:'property';
  name:string;
  signature:Node;
}

export interface AliasNode extends ComplexNode {
  type:'alias';
  target:Node;
}

export interface EnumNode extends ComplexNode {
  type:'enum';
  values:string[];
}

export interface UnionNode extends ComplexNode {
  type:'union';
  types:Node[];
}

export interface LiteralObjectNode extends BaseNode {
  type:'literal object';
  members:Node[];
}

export interface StringLiteralNode extends BaseNode {
  type:'string literal';
  value:string;
}

export interface StringNode extends BaseNode {
  type:'string';
}

export interface NumberNode extends BaseNode {
  type:'number';
}

export interface BooleanNode extends BaseNode {
  type:'boolean';
}

export interface AnyNode extends BaseNode {
  type:'any';
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
  AnyNode;

export type NamedNode = MethodNode | PropertyNode;

export type TypeMap = {[key:string]:Node};
