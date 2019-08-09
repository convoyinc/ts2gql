interface Starship {
  name:string;
  length:number;
  type:Starship.Type;
}

namespace Starship {
  export enum Type {
    XWING,
    ENTERPRISE,
    FIREFLY,
  }
}

export default Starship;