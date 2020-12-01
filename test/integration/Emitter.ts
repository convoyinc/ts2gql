import Emitter from '../../src/Emitter';
import * as types from '../../src/types';
import * as ts2gql from '../../src/index';
import { UnionNode, AliasNode, EnumNode } from '../../src/types';

describe(`Emitter`, () => {

  let loadedTypes:types.TypeMap;
  let emitter:Emitter;
  beforeEach(() => {
    loadedTypes = ts2gql.load('./test/schema.ts', ['Schema']);
    emitter = new Emitter(loadedTypes);

  });

  describe(`generics`, () => {
    describe('simple generics', () => {
      it('extending a generic with a string type results in the correct interface', () => {
const expected = 
`type Result {
  extraNonGenericProp: Boolean
  object: String
  ownProp: Boolean
}`
const itemNode = loadedTypes['StringItem'] as types.InterfaceNode;
expect(itemNode).to.exist;
const result = emitter._emitInterface(itemNode, 'Result');
expect(result).to.eq(expected);
      })

      it('extending a generic with a number type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  object: Float
  ownProp: Boolean
}`
        const itemNode = loadedTypes['NumberItem'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })

      it('extending a generic with a complex type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  object: StringItem
  ownProp: Boolean
}`
        const itemNode = loadedTypes['ComplexStringItem'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })

      it('extending a generic with a string array type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  object: [String]
  ownProp: Boolean
}`
        const itemNode = loadedTypes['StringArrayItem'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })

      it('extending a generic with a number array type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  object: [Float]
  ownProp: Boolean
}`
        const itemNode = loadedTypes['NumberArrayItem'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })
    })

    describe('array generics', () => {
      it('extending a array generic with a string type results in the correct interface', () => {
const expected = 
`type Result {
  extraNonGenericProp: Boolean
  objects: [String]
  ownProp: Boolean
}`
        const itemNode = loadedTypes['StringItemList'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })

      it('extending a array generic with a number type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  objects: [Float]
  ownProp: Boolean
}`
        const itemNode = loadedTypes['NumberItemList'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })


      it('extending a array generic with a complex type results in the correct interface', () => {
        const expected = 
`type Result {
  extraNonGenericProp: Boolean
  objects: [StringItemList]
  ownProp: Boolean
}`
        const itemNode = loadedTypes['ComplexStringItemList'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })
    })

    describe('multiple generics', () => {
      it('extending a array and simple generic with a string and number type results in the correct interface', () => {
const expected = 
`type Result {
  arrayObjectU: [Float]
  extraNonGenericProp: Boolean
  objectT: String
  ownProp: Boolean
}`
        const itemNode = loadedTypes['StringObjectNumberArray'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })

      it('extending a array and simple generic with a number and string type results in the correct interface', () => {
        const expected = 
`type Result {
  arrayObjectU: [String]
  extraNonGenericProp: Boolean
  objectT: Float
  ownProp: Boolean
}`
        const itemNode = loadedTypes['NumberObjectStringArray'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })


      it('extending a array and simple generic with a complex type and number type results in the correct interface', () => {
        const expected = 
`type Result {
  arrayObjectU: [Float]
  extraNonGenericProp: Boolean
  objectT: StringItem
  ownProp: Boolean
}`
        const itemNode = loadedTypes['StringItemObjectNumberArray'] as types.InterfaceNode;
        expect(itemNode).to.exist;
        const result = emitter._emitInterface(itemNode, 'Result');
        expect(result).to.eq(expected);
      })
    })
  })

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
  });

  describe(`federation decoration`, () => {
    it(`basic type generation`, () => {
      const expected =
`type Starship {
  length: Float
  name: String
}`;
      const node = loadedTypes['Starship'] as types.InterfaceNode;
      const val = emitter._emitInterface(node, 'Starship');
      expect(val).to.eq(expected);
    });
  });

  it(`basic key decoration`, () => {
    const expected =
`type StarshipFederated @key(fields: "name") {
  length: Float
  name: String
}`;
    const node = loadedTypes['StarshipFederated'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'StarshipFederated');
    expect(val).to.eq(expected);
  });

  it(`compound key decoration`, () => {
    const expected =
`type StarshipFederatedCompoundKey @key(fields: "name id") {
  id: String
  length: Float
  name: String
}`;
    const node = loadedTypes['StarshipFederatedCompoundKey'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'StarshipFederatedCompoundKey');
    expect(val).to.eq(expected);
  });

  it(`multiple keys decoration`, () => {
    const expected =
`type StarshipFederatedMultipleKeys @key(fields: "name") @key(fields: "id") {
  id: String
  length: Float
  name: String
}`;
    const node = loadedTypes['StarshipFederatedMultipleKeys'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'StarshipFederatedMultipleKeys');
    expect(val).to.eq(expected);
  });

  it(`cost decoration field`, () => {
    const expected =
`type CostDecorationField {
  bar: [String]
  baz: Float @cost(useMultipliers: false, complexity: 2)
}`;
    const node = loadedTypes['CostDecorationField'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'CostDecorationField');
    expect(val).to.eq(expected);
  });

  it(`cost decoration multiple fields`, () => {
    const expected =
`type CostDecorationMultipleFields {
  bar: [String] @cost(useMultipliers: false, complexity: 2)
  baz: Float @cost(useMultipliers: false, complexity: 2)
}`;
    const node = loadedTypes['CostDecorationMultipleFields'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'CostDecorationMultipleFields');
    expect(val).to.eq(expected);
  });

  it(`cost decoration type`, () => {
    const expected =
`type CostDecorationType @cost(useMultipliers: false, complexity: 2) {
  bar: [String]
  baz: Float
}`;
    const node = loadedTypes['CostDecorationType'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'CostDecorationType');
    expect(val).to.eq(expected);
  });

  it(`cost decoration field with key`, () => {
    const expected =
`type CostDecorationFieldWithKey @key(fields: "name") {
  bar: [String]
  baz: Float @cost(useMultipliers: false, complexity: 2)
}`;
    const node = loadedTypes['CostDecorationFieldWithKey'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'CostDecorationFieldWithKey');
    expect(val).to.eq(expected);
  });

  it(`cost decoration type with key`, () => {
    const expected =
`type CostDecorationTypeWithKey @key(fields: "name") @cost(useMultipliers: false, complexity: 2) {
  bar: [String]
  baz: Float
}`;
    const node = loadedTypes['CostDecorationTypeWithKey'] as types.InterfaceNode;
    const val = emitter._emitInterface(node, 'CostDecorationTypeWithKey');
    expect(val).to.eq(expected);
  });
});
