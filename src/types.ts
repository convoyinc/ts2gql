export type SymbolName = string;

export interface ComplexNode {
  documentation?:string;
}

export interface InterfaceNode extends ComplexNode {
  type:'interface';
  // documentation:string;
  members:{[key:string]:Node};
  query?:boolean;
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
  types:SymbolName[];
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

export type Node = InterfaceNode
  | MethodNode
  | ArrayNode
  | ReferenceNode
  | PropertyNode
  | AliasNode
  | EnumNode
  | UnionNode
  | LiteralObjectNode
  | StringNode
  | NumberNode
  | BooleanNode;

export type TypeMap = {[key:string]:Node};
