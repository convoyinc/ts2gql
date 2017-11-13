#!/usr/bin/env bash

(( __NODE_INCLUDED__ )) && return
__NODE_INCLUDED__=1

if [[ ! -f ./.nvmrc ]]; then
  echo ".nvmrc is missing from the repo root (or paths are screwed up?)" 1>&2
  exit 1
fi

CURRENT_NODE_VERSION=$(node --version 2> /dev/null || echo 'none')
DESIRED_NODE_VERSION=v$(cat ./.nvmrc)
if [[ "${CURRENT_NODE_VERSION}" != "${DESIRED_NODE_VERSION}" ]]; then
  # Attempt to switch to the correct node for this shell…
  if ! type nvm >/dev/null 2>&1 && [[ -x "${NVM_DIR}"/nvm.sh ]]; then
    source "${NVM_DIR}"/nvm.sh
  fi
  if type nvm > /dev/null 2>&1; then
    nvm use
  fi

  CURRENT_NODE_VERSION=$(node --version 2>/dev/null || echo 'none')
  if [[ "${CURRENT_NODE_VERSION}" != "${DESIRED_NODE_VERSION}" ]]; then
    echo "Wrong node version. Found ${CURRENT_NODE_VERSION}, expected ${DESIRED_NODE_VERSION}…" 1>&2
    echo "…and was unable to switch to ${DESIRED_NODE_VERSION} via nvm." 1>&2
    exit 1
  fi
fi

# Note that VS Code gets a free pass
if [[ ! "${npm_config_user_agent}" =~ yarn/ && "${VSCODE_PID}" == "" ]]; then
  echo "Please use yarn to run scripts in this repository." 1>&2
  exit 1
fi

export PATH=$(yarn bin):$PATH

current_yarn_command() {
  node -e "console.log(JSON.parse(process.env.npm_config_argv).cooked[0])"
}

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
