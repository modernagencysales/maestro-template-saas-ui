#!/usr/bin/env bash
set -euo pipefail

# This script runs only in the secretless, disposable verify workflow container.
source tooling/ci/setup.sh
bash tooling/ci/install-gitleaks.sh
export PATH="${HOME}/.local/bin:${PATH}"

pnpm exec playwright install --with-deps chromium
pnpm verify
pnpm --dir apps/cli test:create-root-admission
pnpm --dir apps/web test:runtime-longevity
