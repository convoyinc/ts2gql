#!/usr/bin/env bash
set -e

write_package_key() {
  local KEY="${1}"
  local VALUE="${2}"

  node <<-end_script
    const _ = require('lodash');
    const fs = require('fs');

    const packageInfo = JSON.parse(fs.readFileSync('package.json'));
    _.set(packageInfo, '${KEY}', '${VALUE}');
    fs.writeFileSync('package.json', JSON.stringify(packageInfo, null, 2));
end_script
}

PACKAGE_XY=$(node -e "console.log(JSON.parse(fs.readFileSync('package.json')).version.replace(/\.\d+$/, ''))")
PACKAGE_VERSION="${PACKAGE_XY}.${CIRCLE_BUILD_NUM}"

npm run compile

echo "Releasing ${PACKAGE_VERSION}"
write_package_key version "${PACKAGE_VERSION}"
git add .
git commit -m "v${PACKAGE_VERSION}"
git tag v${PACKAGE_VERSION}

git push --tags
npm publish
