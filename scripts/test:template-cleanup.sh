#!/usr/bin/env bash
set -e

ORIGIN_REMOTE_URL=$(git remote get-url origin)

if [[
  "$ORIGIN_REMOTE_URL" = https://github.com/convoyinc/template.git ||
  "$ORIGIN_REMOTE_URL" =~ github.com:convoyinc/template ]]; then
  exit 0
fi

PACKAGE_NAME=$(node -e "console.log(require('./package.json').name)")
PACKAGE_REPOSITORY=$(node -e "console.log(require('./package.json').repository)")
PACKAGE_DESCRIPTION=$(node -e "console.log(require('./package.json').description)")

if [[ "$PACKAGE_NAME" =~ ^\@convoy/template.*$ ]]; then
  echo "Package name is still set to @convoy/template" >&2
  exit 1
fi
if [[ "$PACKAGE_REPOSITORY" = "convoyinc/template" ]]; then
  echo "Package repository is still set to convoyinc/template" >&2
  exit 1
fi
if [[ "$PACKAGE_DESCRIPTION" =~ ^Starter\ for\ building.*$ ]]; then
  echo "Package description still looks like a template" >&2
  exit 1
fi
