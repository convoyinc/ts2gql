import * as doctrine from 'doctrine';

export type SymbolName = string;

export interface ComplexNode {
  documentation?:doctrine.ParseResult;
}

export interface InterfaceNode extends ComplexNode {
  type:'interface';
  members:NamedNode[];
  inherits:SymbolName[];
  concrete?:boolean; // Whether the type is directly used (returned).
}

export interface ClassNode extends ComplexNode {
  type:'class';
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

export interface LiteralObjectNode {
  type:'literal object';
  members:Node[];
}

export interface StringNode {
  type:'string';
}

export interface NumberNode {
  type:'number';
}

export interface BooleanNode {
  type:'boolean';
}

export type Node =
  InterfaceNode |
  ClassNode |
  MethodNode |
  ArrayNode |
  ReferenceNode |
  PropertyNode |
  AliasNode |
  EnumNode |
  UnionNode |
  LiteralObjectNode |
  StringNode |
  NumberNode |
  BooleanNode;

export type NamedNode = MethodNode | PropertyNode;

export type TypeMap = {[key:string]:Node};
