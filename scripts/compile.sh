#!/usr/bin/env bash
set -e

npm run clean
tsc "${@}"
