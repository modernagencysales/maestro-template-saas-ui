#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

COMMIT_SHA="${CI_COMMIT_SHA:-$(git rev-parse HEAD)}"
export CI_COMMIT_SHA="${COMMIT_SHA}"
node scripts/_project-config.mjs assert-isolated-convex
PROJECT_NAME="$(node scripts/_project-config.mjs get staging cloudflarePagesProject)"
BRANCH_NAME="$(node scripts/_project-config.mjs get staging cloudflareBranch)"

# Cluster secrets are namespaced TEMPLATE_* so this pipeline can never read
# (or collide with) another pipeline's deploy credentials in the shared
# cluster; each is policy-locked to maestro-template main builds.
CONVEX_DEPLOY_KEY="${TEMPLATE_STAGING_CONVEX_DEPLOY_KEY:?TEMPLATE_STAGING_CONVEX_DEPLOY_KEY is required}"
CLOUDFLARE_API_TOKEN="${TEMPLATE_STAGING_CLOUDFLARE_API_TOKEN:?TEMPLATE_STAGING_CLOUDFLARE_API_TOKEN is required}"
CLOUDFLARE_ACCOUNT_ID="${TEMPLATE_STAGING_CLOUDFLARE_ACCOUNT_ID:?TEMPLATE_STAGING_CLOUDFLARE_ACCOUNT_ID is required}"
export CONVEX_DEPLOY_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

CONVEX_DEPLOYMENT="$(node scripts/_project-config.mjs get staging convexDeployName)"
TEMPLATE_HOSTED_URL="$(node scripts/_project-config.mjs get staging hostedUrl)"
CLOUDFLARE_PAGES_PROJECT="${PROJECT_NAME}"
CLOUDFLARE_PAGES_BRANCH="${BRANCH_NAME}"
CLOUDFLARE_DEPLOYMENT_VERSION="${COMMIT_SHA}"
DEPLOY_ENVIRONMENT=staging
export CONVEX_DEPLOYMENT TEMPLATE_HOSTED_URL DEPLOY_ENVIRONMENT
export CLOUDFLARE_PAGES_PROJECT CLOUDFLARE_PAGES_BRANCH CLOUDFLARE_DEPLOYMENT_VERSION

node scripts/_project-config.mjs assert-convex-deploy-key staging
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts validate-inputs pending

pnpm exec tsx tooling/release/src/index.ts deploy-doctor staging

# Backend first: CONVEX_DEPLOY_KEY (validated against its non-secret public
# prefix before deploy-doctor) targets the
# environment's deployment; the seed is idempotent and only creates the fixed
# demo workspace. The frontend below is built against the same deployment.
DEPLOY_ENVIRONMENT=staging pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts convex
(cd packages/convex && pnpm exec convex run demo/showcase:seed)
tooling/ci/deploy-canary.sh backend

VITE_CONVEX_URL="$(node scripts/_project-config.mjs get staging convexUrl)"
export VITE_CONVEX_URL

pnpm build
pnpm smoke:web-static
CLOUDFLARE_PAGES_PROJECT="${PROJECT_NAME}" CLOUDFLARE_PAGES_BRANCH="${BRANCH_NAME}" DEPLOY_ENVIRONMENT=staging \
  pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare
tooling/ci/deploy-canary.sh hosted

RECEIPT_PATH="guarded-staging-deployment-receipt.json"
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts record "${RECEIPT_PATH}"

node -e 'const receipt=require("./guarded-staging-deployment-receipt.json"); console.log("staging deployment receipt", JSON.stringify(receipt))'
