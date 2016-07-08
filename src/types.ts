export type SymbolName = string;

export interface InterfaceNode {
  type:'interface';
  // documentation:string;
  members:{[key:string]:Node};
  query?:boolean;
  documentation?:string;
}

export interface MethodNode {
  type:'method';
  name:string;
  parameters:{[key:string]:Node};
  returns:Node;
  documentation?:string;
}

export interface ArrayNode {
  type:'array';
  elements:Node[];
  documentation?:string;
}

export interface ReferenceNode {
  type:'reference';
  target:SymbolName;
  documentation?:string;
}

export interface PropertyNode {
  type:'property';
  name:string;
  signature:Node;
  documentation?:string;
}

export interface AliasNode {
  type:'alias';
  target:Node;
  documentation?:string;
}

export interface EnumNode {
  type:'enum';
  values:string[];
  documentation?:string;
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
