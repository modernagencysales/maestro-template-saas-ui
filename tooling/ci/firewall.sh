#!/usr/bin/env bash
set -euo pipefail
source tooling/ci/setup.sh
bash tooling/ci/install-gitleaks.sh
bash tooling/ci/install-qlty.sh
pnpm check:format
pnpm lint
pnpm typecheck
pnpm check:deps
pnpm check:layer-boundaries
pnpm check:secret-canaries
pnpm acceptance:check
pnpm acceptance:features
pnpm check:qlty -- --diff
