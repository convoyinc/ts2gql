"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Emitter_1 = require("../../src/Emitter");
var ts2gql = require("../../src/index");
describe("Emitter", function () {
    var loadedTypes;
    var emitter;
    beforeEach(function () {
        loadedTypes = ts2gql.load('./test/schema.ts', ['Schema']);
        emitter = new Emitter_1.default(loadedTypes);
    });
    describe("_emitUnion", function () {
        it("emits GQL type union for union of interface types", function () {
            var expected = "union FooSearchResult = Human | Droid | Starship";
            var aliasNode = loadedTypes['UnionOfInterfaceTypes'];
            var unionNode = aliasNode.target;
            var val = emitter._emitUnion(unionNode, 'FooSearchResult');
            expect(val).to.eq(expected);
        });
        it("emits GQL enum union for union of enum types", function () {
            var expected = "enum FooSearchResult {\n  Red\n  Yellow\n  Blue\n  Big\n  Small\n}";
            var aliasNode = loadedTypes['UnionOfEnumTypes'];
            var unionNode = aliasNode.target;
            var val = emitter._emitUnion(unionNode, 'FooSearchResult');
            expect(val).to.eq(expected);
        });
        it("throws error if union combines interfaces with other node types", function () {
            var aliasNode = loadedTypes['UnionOfInterfaceAndOtherTypes'];
            var unionNode = aliasNode.target;
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('ts2gql expected a union of only interfaces since first child is an interface. Got a reference');
        });
        it("throws error if union combines enums with other node types", function () {
            var aliasNode = loadedTypes['UnionOfEnumAndOtherTypes'];
            var unionNode = aliasNode.target;
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('ts2gql expected a union of only enums since first child is an enum. Got a reference');
        });
        it("throws error if union contains non-reference types", function () {
            var aliasNode = loadedTypes['UnionOfNonReferenceTypes'];
            var unionNode = aliasNode.target;
            expect(function () {
                emitter._emitUnion(unionNode, 'FooSearchResult');
            }).to.throw('GraphQL unions require that all types are references. Got a boolean');
        });
    });
    describe("_emitEnum", function () {
        it("emits GQL type enum for string enum with single quotes", function () {
            var expected = "enum Planet {\n  CHTHONIAN\n  CIRCUMBINARY\n  PLUTOID\n}";
            var enumNode = loadedTypes['Planet'];
            var val = emitter._emitEnum(enumNode, 'Planet');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for string enum with double quotes", function () {
            var expected = "enum Seasons {\n  SPRING\n  SUMMER\n  FALL\n  WINTER\n}";
            var enumNode = loadedTypes['Seasons'];
            var val = emitter._emitEnum(enumNode, 'Seasons');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for enum with 'any' typed initializers", function () {
            var expected = "enum Cloud {\n  ALTOSTRATUS\n  CIRROCUMULUS\n  CUMULONIMBUS\n}";
            var enumNode = loadedTypes['Cloud'];
            var val = emitter._emitEnum(enumNode, 'Cloud');
            expect(val).to.eq(expected);
        });
        it("emits GQL type enum for enum with numeric literal initializers", function () {
            var expected = "enum Ordinal {\n  FIRST\n  SECOND\n  THIRD\n}";
            var enumNode = loadedTypes['Ordinal'];
            var val = emitter._emitEnum(enumNode, 'Ordinal');
            expect(val).to.eq(expected);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Rlc3QvaW50ZWdyYXRpb24vRW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDZDQUF3QztBQUV4Qyx3Q0FBMEM7QUFHMUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtJQUVsQixJQUFJLFdBQXlCLENBQUM7SUFDOUIsSUFBSSxPQUFlLENBQUM7SUFDcEIsVUFBVSxDQUFDO1FBQ1QsV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQzFELE9BQU8sR0FBRyxJQUFJLGlCQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDckMsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsWUFBWSxFQUFFO1FBQ3JCLEVBQUUsQ0FBQyxtREFBbUQsRUFBRTtZQUN0RCxJQUFNLFFBQVEsR0FBRyxrREFBa0QsQ0FBQztZQUNwRSxJQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsdUJBQXVCLENBQWMsQ0FBQztZQUNwRSxJQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBbUIsQ0FBQztZQUNoRCxJQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQzdELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLDhDQUE4QyxFQUFFO1lBQ2pELElBQU0sUUFBUSxHQUNwQixvRUFNRSxDQUFDO1lBQ0csSUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLGtCQUFrQixDQUFjLENBQUM7WUFDL0QsSUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLE1BQW1CLENBQUM7WUFDaEQsSUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxTQUFT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