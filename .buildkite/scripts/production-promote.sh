#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

CURRENT_SHA="${BUILDKITE_COMMIT:-$(git rev-parse HEAD)}"
if command -v buildkite-agent >/dev/null 2>&1; then
  STAGED_SHA="${STAGED_SHA:-$(buildkite-agent meta-data get staged-sha)}"
else
  STAGED_SHA="${STAGED_SHA:-${CURRENT_SHA}}"
fi
PROJECT_NAME="$(node scripts/_project-config.mjs get production cloudflarePagesProject)"
PRODUCTION_BRANCH="$(node scripts/_project-config.mjs get production cloudflareBranch)"

# Cluster secrets are namespaced TEMPLATE_* so this pipeline can never read
# (or collide with) another pipeline's deploy credentials in the shared
# cluster; each is policy-locked to maestro-template main builds.
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY:-${TEMPLATE_CONVEX_DEPLOY_KEY:-}}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${TEMPLATE_CLOUDFLARE_API_TOKEN:-}}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${TEMPLATE_CLOUDFLARE_ACCOUNT_ID:-}}"
export CONVEX_DEPLOY_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

pnpm exec tsx tooling/release/src/deploy/authorityCli.ts production "${BUILDKITE_COMMIT}" "${PROMOTION_TARGET_ID}"
pnpm exec tsx tooling/release/src/index.ts deploy-doctor production
pnpm exec tsx tooling/release/src/index.ts promote-plan "${STAGED_SHA}" "${CURRENT_SHA}"

# Backend first: CONVEX_DEPLOY_KEY (validated by deploy-doctor) targets the
# production deployment; the seed is idempotent and only creates the fixed
# demo workspace. The frontend below is built against the same deployment.
DEPLOY_ENVIRONMENT=production pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts convex
(cd packages/convex && pnpm exec convex run demo/showcase:seed)

VITE_CONVEX_URL="${VITE_CONVEX_URL:-$(node scripts/_project-config.mjs get production convexUrl)}"
export VITE_CONVEX_URL

pnpm build
pnpm smoke:web-static
CLOUDFLARE_PAGES_PROJECT="${PROJECT_NAME}" CLOUDFLARE_PAGES_BRANCH="${PRODUCTION_BRANCH}" DEPLOY_ENVIRONMENT=production \
  pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare
