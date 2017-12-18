import * as path from 'path';
import * as fs from 'fs';

import { generateFragments } from '../../src';

describe(`generateFragments`, () => {

  it(`generates fragment with nested fields`, async () => {
    const rootDir = path.join(__dirname, '../../../test/data/post');

    generateFragments(path.join(rootDir, 'index.ts'));
    const output = fs.readFileSync(path.join(rootDir, 'output.graphql'), 'utf8');
    const expected = fs.readFileSync(path.join(rootDir, 'expected.graphql'), 'utf8');
    expect(output).to.be.equal(expected);
  });

});
