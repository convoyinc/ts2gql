export interface Human {
  name:string;
  height:number;
}

export interface Droid {
  name:string;
  primaryFunction:string;
}

export interface Starship {
  name:string;
  length:number;
}

/** @graphql key name */
export interface StarshipFederated {
  name:string;
  length:number;
}

/** @graphql key name id */
export interface StarshipFederatedCompoundKey {
  name:string;
  id:string;
  length:number;
}

/**
 * @graphql key name
 * @graphql key id
 */
export interface StarshipFederatedMultipleKeys {
  name:string;
  id:string;
  length:number;
}

export interface CostDecorationField {
  bar:string[];
  /** @graphql cost (useMultipliers: false, complexity: 2) */
  baz:number;
}

export interface CostDecorationMultipleFields {
  /** @graphql cost (useMultipliers: false, complexity: 2) */
  bar:string[];
  /** @graphql cost (useMultipliers: false, complexity: 2) */
  baz:number;
}

/** @graphql cost (useMultipliers: false, complexity: 2) */
export interface CostDecorationType {
  bar:string[];
  baz:number;
}

/** @graphql key name */
export interface CostDecorationFieldWithKey {
  bar:string[];
  /** @graphql cost (useMultipliers: false, complexity: 2) */
  baz:number;
}

/**
 * @graphql cost (useMultipliers: false, complexity: 2)
 * @graphql key name
 */
export interface CostDecorationTypeWithKey {
  bar:string[];
  baz:number;
}

export interface NonNullableProperties {
  nullableString:string;
  /* @graphql non-nullable */
  nonNullString:string;
  /* @graphql non-nullable */
  nonNullArray:string[];
  /* @graphql non-nullable */
  someMethod(): { /* @graphql non-nullable */ foo: string}[];
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

export enum Seasons {
  SPRING   = "SPRING",
  SUMMER   = "SUMMER",
  FALL     = "FALL",
  WINTER   = "WINTER",
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
  unionOfInterfaceAndOtherTypes():UnionOfInterfaceAndOtherTypes[];
  unionOfEnumAndOtherTypes():UnionOfEnumAndOtherTypes[];
  unionOfNonReferenceTypes():UnionOfNonReferenceTypes[];
  planetTypes():Planet;
  seasonTypes():Seasons;
  cloudTypes():Cloud;
  ordinalTypes():Ordinal;
  quarkFlavorTypes():QuarkFlavor;
  starshipFederated():StarshipFederated;
  starshipFederatedCompound():StarshipFederatedCompoundKey;
  starshipFederatedMultiple():StarshipFederatedMultipleKeys;
  costDecorationField():CostDecorationField;
  costDecorationMultipleFields():CostDecorationMultipleFields;
  costDecorationType():CostDecorationType;
  costDecorationFieldWithKey():CostDecorationFieldWithKey;
  costDecorationTypeWithKey():CostDecorationTypeWithKey;
  nonNullableProperties():NonNullableProperties;
}

export interface MutationRoot {
}

/** @graphql schema */
export interface Schema {
  query:QueryRoot;
  mutation:MutationRoot;
}
