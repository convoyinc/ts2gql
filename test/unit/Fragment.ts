import * as path from 'path';
import * as fs from 'fs';

import { generateFragments } from '../../src';

describe(`generateFragments`, () => {

  it(`reads complex stuff`, async () => {
    const program = '../../../test/fixtures/post.ts';
    generateFragments(path.join(__dirname, program));
    const fragmentFile = fs.readFileSync(path.join(__dirname, '../../../test_output/getPosts.graphql'), 'utf8');

    expect(fragmentFile).to.be.equal(
`fragment getPosts on Post {
  id
  title
  postedAt
  author {
    name
    photo
  }
  editor {
    name
  }
}
`);
  });

});
