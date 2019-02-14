#!/usr/bin/env bash
set -e

OPTIONS=()
if [[ "${CI}" == "" ]]; then
  OPTIONS+=(
    --coverageReporters html
  )
fi

npm run test:unit --coverage "${OPTIONS[@]}"

if [[ "${CI}" == "" ]]; then
  open ./output/test:unit/index.html
else
  codecov --file=./output/test:unit/lcov.info
fi
