#!/usr/bin/env bash
set -euo pipefail

# This script runs only in the secretless, disposable verify workflow container.
source tooling/ci/setup.sh
bash tooling/ci/install-gitleaks.sh

pnpm exec playwright install --with-deps chromium
pnpm verify
pnpm --dir apps/web test:runtime-longevity
