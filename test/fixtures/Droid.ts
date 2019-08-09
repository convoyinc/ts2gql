export interface Droid {
  name:string;
  primaryFunction:Droid.Function;
}


export namespace Droid {
  export enum Function {
    PROTOCOL,
    MILITARY
  }
}
