#!/usr/bin/env bash
set -e

source ./scripts/include/node.sh

FILES=("${@}")
if [[ "${#FILES[@]}" = "0" ]]; then
  FILES+=($(find scripts src test ! -name "*.d.ts" -not -path "test/fixtures/*" -and -name "*.ts" -or -name "*.tsx"))
fi

OPTIONS=(
  --format codeFrame
  --project tsconfig.json
)

set -x
tslint "${OPTIONS[@]}" "${FILES[@]}"
