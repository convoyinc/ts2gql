import * as path from 'path';

import * as ts2gql from '../../src';

// Assume we are always being run via npm/yarn.
const PROJECT_ROOT = process.cwd();
const FIXTURE_ROOT = path.join(PROJECT_ROOT, 'test', 'fixtures');

describe(`Collector`, () => {
  describe(`exportedAs`, () => {
    let types:ts2gql.TypeMap;
    beforeAll(() => {
      types = ts2gql.load(path.join(FIXTURE_ROOT, 'schema.ts'), ['Schema']);
    });

    it(`discovers: export enum <Name>`, () => {
      expect(types['Color'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'schema.ts'),
        path: ['Color'],
      });
    });

    it(`discovers: types imported from other modules`, () => {
      expect(types['Seasons'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'common.ts'),
        path: ['Seasons'],
      });
    });

    it(`discovers: export namespace { export enum <Name> }`, () => {
      expect(types['Droid.Function'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'Droid.ts'),
        path: ['Droid', 'Function'],
      });
    });
    it(`discovers: export default <Name>`, () => {
      expect(types['Starship'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'Starship.ts'),
        path: ['default'],
      });
    });

    it(`discovers: default export namespace { export enum <Name> }`, () => {
      expect(types['Starship.Type'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'Starship.ts'),
        path: ['default', 'Type'],
      });
    });

    it(`discovers: export type <Name> = <Enum> | <Enum>`, () => {
      expect(types['UnionOfEnumTypes'].exportedAs).to.deep.equal({
        fileName: path.join(FIXTURE_ROOT, 'schema.ts'),
        path: ['UnionOfEnumTypes'],
      });
    });
  });
});
