#!/usr/bin/env bash
set -e

source ./scripts/include/node.sh

npm run clean
tsc "${@}"
