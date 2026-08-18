#!/usr/bin/env bash
set -euo pipefail

# Coverage runs in its own secretless, disposable workflow workspace.
source tooling/ci/setup.sh

pnpm check:coverage-ratchet
