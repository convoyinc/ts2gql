import Emitter from '../../src/Emitter';
import * as ts2gql from '../../src/index';
import * as types from '../../src/types';

describe(`Emitter`, () => {

  let loadedTypes:types.TypeDefinitionMap;
  let emitter:Emitter;
  beforeEach(() => {
    const collector = ts2gql.load('./test/schema.ts', ['Schema']);
    loadedTypes = collector.resolved;
    emitter = new Emitter(collector);
  });

  describe(`_emitUnion`, () => {
    it(`emits GQL type union for union of interface types`, () => {
      const expected = `union FooSearchResult = Human | Droid | Starship`;
      const unionNode = loadedTypes['UnionOfInterfaceTypes'] as types.UnionTypeDefinitionNode;
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
      const unionNode = loadedTypes['UnionOfEnumTypes'] as types.UnionTypeDefinitionNode;
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
      const unionNode = loadedTypes['QuarkFlavor'] as types.UnionTypeDefinitionNode;
      const val = emitter._emitUnion(unionNode, 'QuarkFlavor');
      expect(val).to.eq(expected);
    });

    it(`throws error if union combines interfaces with other node types`, () => {
      const unionNode = loadedTypes['UnionOfInterfaceAndOtherTypes'] as types.UnionTypeDefinitionNode;
      expect(() => {
        emitter._emitUnion(unionNode, 'FooSearchResult');
      }).to.throw('ts2gql expected a union of only interfaces since first child is an interface. Got a reference');
    });

    it(`throws error if union combines enums with other node types`, () => {
      const unionNode = loadedTypes['UnionOfEnumAndOtherTypes'] as types.UnionTypeDefinitionNode;
      expect(() => {
        emitter._emitUnion(unionNode, 'FooSearchResult');
      }).to.throw('ts2gql expected a union of only enums since first child is an enum. Got a reference');
    });

    it(`throws error if union contains non-reference types`, () => {
      const unionNode = loadedTypes['UnionOfNonReferenceTypes'] as types.UnionTypeDefinitionNode;
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
      const enumNode = loadedTypes['Planet'] as types.EnumTypeDefinitionNode;
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
      const enumNode = loadedTypes['Seasons'] as types.EnumTypeDefinitionNode;
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
      const enumNode = loadedTypes['Cloud'] as types.EnumTypeDefinitionNode;
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
      const enumNode = loadedTypes['Ordinal'] as types.EnumTypeDefinitionNode;
      const val = emitter._emitEnum(enumNode, 'Ordinal');
      expect(val).to.eq(expected);
    });
  });
});
