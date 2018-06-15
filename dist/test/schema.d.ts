export interface Human {
    name: string;
    height: number;
}
export interface Droid {
    name: string;
    primaryFunction: string;
}
export interface Starship {
    name: string;
    length: number;
}
export declare enum Color {
    'Red' = 0,
    'Yellow' = 1,
    'Blue' = 2
}
export declare enum Size {
    'Big' = 0,
    'Small' = 1
}
export declare enum Planet {
    CHTHONIAN = "CHTHONIAN",
    CIRCUMBINARY = "CIRCUMBINARY",
    PLUTOID = "PLUTOID"
}
export declare enum Seasons {
    SPRING = "SPRING",
    SUMMER = "SUMMER",
    FALL = "FALL",
    WINTER = "WINTER"
}
export declare enum Cloud {
    ALTOSTRATUS,
    CIRROCUMULUS,
    CUMULONIMBUS
}
export declare enum Ordinal {
    FIRST = 1,
    SECOND = 2,
    THIRD = 3
}
export declare type UnionOfInterfaceTypes = Human | Droid | Starship;
export declare type UnionOfEnumTypes = Color | Size;
export declare type UnionOfInterfaceAndOtherTypes = Human | UnionOfEnumTypes;
export declare type UnionOfEnumAndOtherTypes = Color | UnionOfInterfaceTypes;
export declare type UnionOfNonReferenceTypes = boolean | string;
export interface QueryRoot {
    unionOfInterfaceTypes(): UnionOfInterfaceTypes[];
    unionOfEnumTypes(): UnionOfEnumTypes[];
    unionOfInterfaceAndOtherTypes(): UnionOfInterfaceAndOtherTypes[];
    unionOfEnumAndOtherTypes(): UnionOfEnumAndOtherTypes[];
    unionOfNonReferenceTypes(): UnionOfNonReferenceTypes[];
    planetTypes(): Planet;
    seasonTypes(): Seasons;
    cloudTypes(): Cloud;
    ordinalTypes(): Ordinal;
}
export interface MutationRoot {
}
/** @graphql schema */
export interface Schema {
    query: QueryRoot;
    mutation: MutationRoot;
}
