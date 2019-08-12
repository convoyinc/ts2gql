import { Seasons } from './common';
import { Droid } from './Droid';
import Starship from './Starship';

export interface Human {
  name:string;
  height:number;
}

export enum Color {
  'Red',
  'Yellow',
  'Blue',
}

export enum Size {
  'Big',
  'Small',
}

export enum Planet {
  CHTHONIAN    = 'CHTHONIAN',
  CIRCUMBINARY = 'CIRCUMBINARY',
  PLUTOID      = 'PLUTOID',
}

export enum Cloud {
  ALTOSTRATUS  = <any>'ALTOSTRATUS',
  CIRROCUMULUS = <any>'CIRROCUMULUS',
  CUMULONIMBUS = <any>'CUMULONIMBUS',
}

export enum Ordinal {
  FIRST = 1,
  SECOND,
  THIRD,
}

export type QuarkFlavor = "UP" | "DOWN" | "CHARM" | "STRANGE" | "TOP" | "BOTTOM";

export type UnionOfInterfaceTypes = Human | Droid | Starship;

export type UnionOfEnumTypes = Color | Size;

export type UnionOfInterfaceAndOtherTypes = Human | UnionOfEnumTypes;

export type UnionOfEnumAndOtherTypes = Color | UnionOfInterfaceTypes;

export type UnionOfNonReferenceTypes = boolean | string;

export interface QueryRoot {
  unionOfInterfaceTypes():UnionOfInterfaceTypes[];
  unionOfEnumTypes():UnionOfEnumTypes[];
  planetTypes():Planet;
  seasonTypes():Seasons;
  cloudTypes():Cloud;
  ordinalTypes():Ordinal;
  quarkFlavorTypes():QuarkFlavor;
}

// References to invalid types
export interface BustedQueryRoot extends QueryRoot {
  unionOfInterfaceAndOtherTypes():UnionOfInterfaceAndOtherTypes[];
  unionOfEnumAndOtherTypes():UnionOfEnumAndOtherTypes[];
  unionOfNonReferenceTypes():UnionOfNonReferenceTypes[];
}

export interface MutationRoot {
}

export interface Schema {
  query:QueryRoot;
  mutation:MutationRoot;
}

export interface BustedSchema {
  query:BustedQueryRoot;
  mutation:MutationRoot;
}
