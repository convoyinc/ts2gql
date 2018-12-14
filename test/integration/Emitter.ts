import Emitter from '../../src/Emitter';
import * as types from '../../src/types';
import * as ts2gql from '../../src/index';
import { UnionNode, AliasNode, EnumNode, InterfaceNode } from '../../src/types';

describe(`Emitter`, () => {

  let loadedTypes:types.TypeMap;
  let emitter:Emitter;
  beforeEach(() => {
    loadedTypes = ts2gql.load('./test/schema.ts', ['Schema']);
    emitter = new Emitter(loadedTypes);
  });

  describe(`_emitUnion`, () => {
    it(`emits GQL type union for union of interface types`, () => {
      const expected = `union FooSearchResult = Human | Droid | Starship`;
      const aliasNode = loadedTypes['UnionOfInterfaceTypes'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      const val = emitter._emitUnion(unionNode, 'FooSearchResult');
      expect(val).to.eq(expected);
    });

    it(`emits GQL enum union for union of enum types`, () => {
      const expected =
`enum FooSearchResult {
  Red
  Yellow
  Blue
  Big
  Small
}`;
      const aliasNode = loadedTypes['UnionOfEnumTypes'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      const val = emitter._emitUnion(unionNode, 'FooSearchResult');
      expect(val).to.eq(expected);
    });

    it(`emits GQL type enum union for a union type of strings`, () => {
      const expected =
`enum QuarkFlavor {
  UP
  DOWN
  CHARM
  STRANGE
  TOP
  BOTTOM
}`;
      const aliasNode = loadedTypes['QuarkFlavor'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      const val = emitter._emitUnion(unionNode, 'QuarkFlavor');
      expect(val).to.eq(expected);
    });

    it(`throws error if union combines interfaces with other node types`, () => {
      const aliasNode = loadedTypes['UnionOfInterfaceAndOtherTypes'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      expect(() => {
        emitter._emitUnion(unionNode, 'FooSearchResult');
      }).to.throw('ts2gql expected a union of only interfaces since first child is an interface. Got a reference');
    });

    it(`throws error if union combines enums with other node types`, () => {
      const aliasNode = loadedTypes['UnionOfEnumAndOtherTypes'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      expect(() => {
        emitter._emitUnion(unionNode, 'FooSearchResult');
      }).to.throw('ts2gql expected a union of only enums since first child is an enum. Got a reference');
    });

    it(`throws error if union contains non-reference types`, () => {
      const aliasNode = loadedTypes['UnionOfNonReferenceTypes'] as AliasNode;
      const unionNode = aliasNode.target as UnionNode;
      expect(() => {
        emitter._emitUnion(unionNode, 'FooSearchResult');
      }).to.throw('GraphQL unions require that all types are references. Got a boolean');
    });
  });

  describe(`_emitEnum`, () => {
    it(`emits GQL type enum for string enum with single quotes`, () => {
      const expected =
`enum Planet {
  CHTHONIAN
  CIRCUMBINARY
  PLUTOID
}`;
      const enumNode = loadedTypes['Planet'] as EnumNode;
      const val = emitter._emitEnum(enumNode, 'Planet');
      expect(val).to.eq(expected);
    });

    it(`emits GQL type enum for string enum with double quotes`, () => {
      const expected =
`enum Seasons {
  SPRING
  SUMMER
  FALL
  WINTER
}`;
      const enumNode = loadedTypes['Seasons'] as EnumNode;
      const val = emitter._emitEnum(enumNode, 'Seasons');
      expect(val).to.eq(expected);
    });

    it(`emits GQL type enum for enum with 'any' typed initializers`, () => {
      const expected =
`enum Cloud {
  ALTOSTRATUS
  CIRROCUMULUS
  CUMULONIMBUS
}`;
      const enumNode = loadedTypes['Cloud'] as EnumNode;
      const val = emitter._emitEnum(enumNode, 'Cloud');
      expect(val).to.eq(expected);
    });

    it(`emits GQL type enum for enum with numeric literal initializers`, () => {
      const expected =
`enum Ordinal {
  FIRST
  SECOND
  THIRD
}`;
      const enumNode = loadedTypes['Ordinal'] as EnumNode;
      const val = emitter._emitEnum(enumNode, 'Ordinal');
      expect(val).to.eq(expected);
    });

    it(`emits deprecated directives for TypeScript interfaces`, () => {
      const expected =
`type DeprecatedNode @deprecated {
  field: String
}`;
      const node = loadedTypes['DeprecatedNode'] as InterfaceNode;
      const val = emitter._emitInterface(node, 'DeprecatedNode');
      expect(val).to.eq(expected);
    });

    it(`emits deprecated directives for TypeScript methods`, () => {
      const expected =
`type HasDeprecatedMethod {
  doNotUse: String @deprecated
}`;
      const node = loadedTypes['HasDeprecatedMethod'] as InterfaceNode;
      const val = emitter._emitInterface(node, 'HasDeprecatedMethod');
      expect(val).to.eq(expected);
    });

    it(`emits deprecated directives for TypeScript properties`, () => {
      const expected =
`type HasDeprecatedProperty {
  doNotUse: String @deprecated(reason: "Avoid This.")
}`;
      const node = loadedTypes['HasDeprecatedProperty'] as InterfaceNode;
      const val = emitter._emitInterface(node, 'HasDeprecatedProperty');
      expect(val).to.eq(expected);
    });

    it(`emits deprecated directives for enum values`, () => {
      const expected =
`enum HasDeprecatedEnumValue @deprecated {
  USE_ME
  NOT_ME @deprecated
}`;
      const node = loadedTypes['HasDeprecatedEnumValue'] as EnumNode;
      const val = emitter._emitEnum(node, 'HasDeprecatedEnumValue');
      expect(val).to.eq(expected);
    });

  });
});
