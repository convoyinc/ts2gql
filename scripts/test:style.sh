#!/usr/bin/env bash
set -e

FILES=("${@}")
if [[ "${#FILES[@]}" = "0" ]]; then
  FILES+=($(find scripts src test ! -name "*.d.ts" -and -name "*.ts" -or -name "*.tsx"))
fi

OPTIONS=(
  --format codeFrame
  --project tsconfig.json
)

set -x
tslint "${OPTIONS[@]}" "${FILES[@]}"
