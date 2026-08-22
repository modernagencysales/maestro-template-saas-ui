#!/usr/bin/env bash
set -euo pipefail
source tooling/ci/setup.sh
bash tooling/ci/install-gitleaks.sh
if ! bash tooling/ci/install-qlty.sh; then
  echo "firewall: Qlty install unavailable; advisory check will continue" >&2
fi
pnpm check:format
pnpm lint
pnpm typecheck
pnpm check:deps
pnpm check:layer-boundaries
pnpm check:secret-canaries
pnpm check:qlty -- --diff
