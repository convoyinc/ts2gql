/// <reference types="node" />
import * as types from './types';
export declare function load(schemaRootPath: string, rootNodeNames: string[]): types.TypeMap;
export declare function emit(schemaRootPath: string, rootNodeNames: string[], stream?: NodeJS.WritableStream): void;
