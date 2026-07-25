#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

# Secretless self-protection: runs BEFORE any secret-bearing job so a PR that
# weakens the CI gate structure fails before credentialed code executes.
# check:ci-completeness pins the pipeline shape, gate scripts, justfile
# recipes, and hook config; do not grant this step any secrets.

pnpm install --frozen-lockfile
pnpm check:ci-completeness
pnpm check:config-drift
pnpm check:workflow-semantics
pnpm check:gates
