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

export interface Item<T> {
  object: T;
  extraNonGenericProp: boolean;
}

export interface ItemList<T> {
  objects: T[];
  extraNonGenericProp: boolean;
}

export interface MultipleGenerics<T, U> {
  objectT: T;
  arrayObjectU: U[];
  extraNonGenericProp: boolean;
}

export interface StringItem extends Item<string> {
  ownProp: boolean;
}
export interface NumberItem extends Item<number> {
  ownProp: boolean;
}

export interface StringArrayItem extends Item<string[]>{
  ownProp: boolean;
}

export interface NumberArrayItem extends Item<number[]>{
  ownProp: boolean;
}
export interface ComplexStringItem extends Item<StringItem> {
  ownProp: boolean;
}

export interface StringItemList extends ItemList<string> {
  ownProp: boolean;
}
export interface NumberItemList extends ItemList<number> {
  ownProp: boolean;
}

export interface ComplexStringItemList extends ItemList<StringItemList> {
  ownProp: boolean;
}

export interface StringObjectNumberArray extends MultipleGenerics<string, number> {
  ownProp: boolean;
}

export interface NumberObjectStringArray extends MultipleGenerics<number, string> {
  ownProp: boolean;
}

export interface StringItemObjectNumberArray extends MultipleGenerics<StringItem, number> {
  ownProp: boolean;
}

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

  // Generics
  stringItem(): StringItem;
  numberItem(): NumberItem;
  complexStringItem(): ComplexStringItem;
  stringArrayItem(): StringArrayItem;
  numberArrayItem(): NumberArrayItem;
  stringItemList(): StringItemList;
  numberItemList(): NumberItemList;
  complexStringItemList(): ComplexStringItemList;
  stringObjectNumberArray(): StringObjectNumberArray;
  numberObjectStringArray(): NumberObjectStringArray;
  stringItemObjectNumberArray(): StringItemObjectNumberArray;
}

export interface MutationRoot {
}

/** @graphql schema */
export interface Schema {
  query:QueryRoot;
  mutation:MutationRoot;
}