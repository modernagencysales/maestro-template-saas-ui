#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/setup.sh"

: "${ROLLBACK_RECEIPT_PATH:?ROLLBACK_RECEIPT_PATH is required}"
: "${BUILDKITE_COMMIT:?BUILDKITE_COMMIT is required}"

CHECKED_OUT_SHA="$(git rev-parse HEAD)"
if [[ "${CHECKED_OUT_SHA}" != "${BUILDKITE_COMMIT}" ]]; then
  echo "Rollback checkout must match BUILDKITE_COMMIT exactly." >&2
  exit 1
fi
if ! git cat-file -e "${BUILDKITE_COMMIT}:.buildkite/scripts/rollback-promote.sh"; then
  echo "Rollback target predates the guarded rollback seed; freeze deployment." >&2
  exit 1
fi

node scripts/_project-config.mjs assert-isolated-convex

CONVEX_DEPLOY_KEY="${TEMPLATE_PRODUCTION_CONVEX_DEPLOY_KEY:?TEMPLATE_PRODUCTION_CONVEX_DEPLOY_KEY is required}"
CLOUDFLARE_API_TOKEN="${TEMPLATE_PRODUCTION_CLOUDFLARE_API_TOKEN:?TEMPLATE_PRODUCTION_CLOUDFLARE_API_TOKEN is required}"
CLOUDFLARE_ACCOUNT_ID="${TEMPLATE_PRODUCTION_CLOUDFLARE_ACCOUNT_ID:?TEMPLATE_PRODUCTION_CLOUDFLARE_ACCOUNT_ID is required}"
CONVEX_DEPLOYMENT="$(node scripts/_project-config.mjs get production convexDeployName)"
VITE_CONVEX_URL="$(node scripts/_project-config.mjs get production convexUrl)"
TEMPLATE_HOSTED_URL="$(node scripts/_project-config.mjs get production hostedUrl)"
CLOUDFLARE_PAGES_PROJECT="$(node scripts/_project-config.mjs get production cloudflarePagesProject)"
CLOUDFLARE_PAGES_BRANCH="$(node scripts/_project-config.mjs get production cloudflareBranch)"
DEPLOY_ENVIRONMENT=production
CLOUDFLARE_DEPLOYMENT_VERSION="${BUILDKITE_COMMIT}"
export CONVEX_DEPLOY_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
export CONVEX_DEPLOYMENT VITE_CONVEX_URL TEMPLATE_HOSTED_URL
export CLOUDFLARE_PAGES_PROJECT CLOUDFLARE_PAGES_BRANCH DEPLOY_ENVIRONMENT
export CLOUDFLARE_DEPLOYMENT_VERSION

pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts validate-inputs pending
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts verify-rollback "${ROLLBACK_RECEIPT_PATH}"
pnpm exec tsx tooling/release/src/index.ts deploy-doctor production

DEPLOY_ENVIRONMENT=production pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts convex
(cd packages/convex && pnpm exec convex run demo/showcase:seed)
.buildkite/scripts/deploy-canary.sh backend

pnpm build
pnpm smoke:web-static
DEPLOY_ENVIRONMENT=production pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare
.buildkite/scripts/deploy-canary.sh hosted

RECEIPT_PATH="guarded-production-rollback-receipt.json"
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts record "${RECEIPT_PATH}"
buildkite-agent artifact upload "${RECEIPT_PATH}"
