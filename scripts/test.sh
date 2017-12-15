#!/usr/bin/env bash
set -e

npm run test:compile
npm run test:style
npm run test:unit
npm run test:integration
