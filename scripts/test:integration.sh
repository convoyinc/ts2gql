#!/usr/bin/env bash
set -e

source ./scripts/include/shell.sh

FILES=("${OPTIONS_ARGS[@]}")
if [[ "${#FILES[@]}" == "0" ]]; then
  FILES+=($(
    find ./test/integration \
      \( -name "*.ts" -not -name "*.d.ts" \) \
      -or -name "*.tsx"
  ))
fi

# We take ts files as arguments for everyone's sanity; but redirect to their
# compiled sources under the covers.
for i in "${!FILES[@]}"; do
  file="${FILES[$i]}"
  if [[ "${file##*.}" == "ts" ]]; then
    FILES[$i]="${file%.*}.js"
  fi
done

OPTIONS=(
  --config ./test/integration/jest.json
)
# Jest doesn't handle debugger flags directly.
NODE_OPTIONS=()
for option in "${OPTIONS_FLAGS[@]}"; do
  if [[ "${option}" =~ ^--(inspect|debug-brk|nolazy) ]]; then
    NODE_OPTIONS+=("${option}")
  else
    OPTIONS+=("${option}")
  fi
done

npm run compile

# For jest-junit
export JEST_SUITE_NAME="test:integration"
export JEST_JUNIT_OUTPUT=./output/test:integration/report.xml

set -x
node "${NODE_OPTIONS[@]}" ./node_modules/.bin/jest "${OPTIONS[@]}" "${FILES[@]}"
