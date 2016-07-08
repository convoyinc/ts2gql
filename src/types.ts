export type SymbolName = string;

export interface InterfaceNode {
  type:'interface';
  // documentation:string;
  members:{[key:string]:Node}
  query?:boolean;
}

export interface MethodNode {
  type:'method';
  name:string;
  documentation:string;
  parameters:{[key:string]:Node};
  returns:Node;
}

export interface ArrayNode {
  type:'array';
  elements:Node[];
}

export interface ReferenceNode {
  type:'reference';
  target:SymbolName;
}

export interface PropertyNode {
  type:'property';
  name:string;
  signature:Node;
}

export interface AliasNode {
  type:'alias';
  target:Node;
}

export interface EnumNode {
  type:'enum';
  values:string[];
}

export interface LiteralObjectNode {
  type:'literal object';
  members:{[key:string]:Node};
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

export type Node = InterfaceNode | MethodNode | ArrayNode | ReferenceNode | PropertyNode | AliasNode | EnumNode | LiteralObjectNode | StringNode | NumberNode | BooleanNode;

export type TypeMap = {[key:string]:Node};
