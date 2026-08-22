#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

if [[ "$*" == *"--mode fake"* ]]; then
  echo "mutation: ok (fake mode)"
  exit 0
fi

if [[ "${CI:-}" != "true" && "${RUN_MUTATION:-}" != "true" ]]; then
  echo "mutation: skipped outside scheduled/manual mutation runs"
  exit 0
fi

pnpm exec stryker run stryker.conf.mjs
