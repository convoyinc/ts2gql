import Emitter from '../../src/Emitter';
import * as types from '../../src/types';
import * as ts2gql from '../../src/index';
import { UnionNode, AliasNode } from '../../src/types';

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

});
