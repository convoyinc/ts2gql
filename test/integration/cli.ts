import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Relative to the current working directory; not files.
const SNAPSHOTS_PATH = './test/snapshots';

// TODO: Switch to real (Jest-provided) snapshot testing if we put more effort
// effort into ts2gql.
function checkAndWriteSnapshot(name:string, contents:string | Buffer) {
  contents = contents.toString();
  const snapshotPath = path.join(SNAPSHOTS_PATH, name);
  const origContents = fs.existsSync(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf-8') : null;
  fs.writeFileSync(snapshotPath, contents);

  if (contents !== origContents) {
    console.log(`Snapshot for ${name} has changed. Please inspect the output.`);
  }
}

describe(`ts2gql CLI`, () => {
  describe(`basic usage`, () => {
    it(`generates a valid schema`, () => {
      const schema = execSync(`./bin/ts2gql ./test/fixtures/schema.ts Schema`);
      checkAndWriteSnapshot('basic-cli.gql', schema);
    });
  });

  describe(`with @importedAs`, () => {
    it(`generates a valid schema`, () => {
      const schema = execSync(`EMIT_IMPORT_DIRECTIVES=yes ./bin/ts2gql ./test/fixtures/schema.ts Schema`);
      checkAndWriteSnapshot('cli-with-importedFrom.gql', schema);
    });
  });
});
