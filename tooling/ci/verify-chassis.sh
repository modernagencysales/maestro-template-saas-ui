#!/usr/bin/env bash
set -euo pipefail

source tooling/ci/setup.sh

pnpm exec playwright install --with-deps chromium
pnpm --dir tooling/agent-pack test:customer
pnpm --dir tooling/generators test
pnpm --dir tooling/release test
pnpm --dir apps/cli test:create-root-integration
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
pnpm --dir apps/web test:runtime-longevity
