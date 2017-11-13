declare module 'doctrine' {
  export interface ParseOptions {
    unwrap?:boolean;
    tags?:string[];
    recoverable?:boolean;
    sloppy?:boolean;
    lineNumbers?:boolean;
  }
  export interface ParseResult {
    description:string;
    tags:Tag[];
  }
  export function parse(comment:string, options?:ParseOptions):ParseResult;

  export interface Tag {
    title:string;
    description:string;
    type:Type;
    name:string;
  }

  export interface Type {
    // We don't use this.
  }
}
