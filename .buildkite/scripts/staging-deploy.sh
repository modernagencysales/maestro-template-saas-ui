#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

COMMIT_SHA="${BUILDKITE_COMMIT:-$(git rev-parse HEAD)}"
PROJECT_NAME="$(node scripts/_project-config.mjs get staging cloudflarePagesProject)"
BRANCH_NAME="$(node scripts/_project-config.mjs get staging cloudflareBranch)"

# Cluster secrets are namespaced TEMPLATE_* so this pipeline can never read
# (or collide with) another pipeline's deploy credentials in the shared
# cluster; each is policy-locked to maestro-template main builds.
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY:-${TEMPLATE_CONVEX_DEPLOY_KEY:-}}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${TEMPLATE_CLOUDFLARE_API_TOKEN:-}}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${TEMPLATE_CLOUDFLARE_ACCOUNT_ID:-}}"
export CONVEX_DEPLOY_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

pnpm exec tsx tooling/release/src/index.ts deploy-authority-check staging "${BUILDKITE_COMMIT}" "${PROMOTION_TARGET_ID}"
pnpm exec tsx tooling/release/src/index.ts deploy-doctor staging

# Backend first: CONVEX_DEPLOY_KEY (validated by deploy-doctor) targets the
# environment's deployment; the seed is idempotent and only creates the fixed
# demo workspace. The frontend below is built against the same deployment.
(cd packages/convex && pnpm exec convex deploy -y)
(cd packages/convex && pnpm exec convex run demo/showcase:seed)

VITE_CONVEX_URL="${VITE_CONVEX_URL:-$(node scripts/_project-config.mjs get staging convexUrl)}"
export VITE_CONVEX_URL

pnpm build
pnpm smoke:web-static
pnpm dlx wrangler@latest pages deploy apps/web/dist/client \
  --project-name "${PROJECT_NAME}" \
  --branch "${BRANCH_NAME}" \
  --commit-dirty=true

if command -v buildkite-agent >/dev/null 2>&1; then
  buildkite-agent meta-data set staged-sha "${COMMIT_SHA}"
fi
