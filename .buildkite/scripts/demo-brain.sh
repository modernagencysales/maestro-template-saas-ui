#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/setup.sh"

pnpm install --frozen-lockfile
pnpm demo:brain:contract
pnpm demo:brain -- --verify-only --no-open
