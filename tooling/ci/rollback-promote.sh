#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/setup.sh"

: "${ROLLBACK_RECEIPT_PATH:?ROLLBACK_RECEIPT_PATH is required}"
: "${CI_COMMIT_SHA:?CI_COMMIT_SHA is required}"
: "${TRUSTED_ROLLBACK_SEED_COMMIT:?TRUSTED_ROLLBACK_SEED_COMMIT is required}"

if [[ ! "${CI_COMMIT_SHA}" =~ ^[0-9a-f]{40}([0-9a-f]{24})?$ ]]; then
  echo "Rollback target must be an exact immutable commit SHA." >&2
  exit 1
fi
if [[ ! "${TRUSTED_ROLLBACK_SEED_COMMIT}" =~ ^[0-9a-f]{40}([0-9a-f]{24})?$ ]]; then
  echo "Trusted rollback seed must be an exact immutable commit SHA." >&2
  exit 1
fi
if ! git cat-file -e "${TRUSTED_ROLLBACK_SEED_COMMIT}^{commit}"; then
  echo "Trusted rollback seed commit is unavailable; freeze deployment." >&2
  exit 1
fi
RESOLVED_SEED_SHA="$(git rev-parse "${TRUSTED_ROLLBACK_SEED_COMMIT}^{commit}")"
if [[ "${RESOLVED_SEED_SHA}" != "${TRUSTED_ROLLBACK_SEED_COMMIT}" ]]; then
  echo "Trusted rollback seed did not resolve exactly; freeze deployment." >&2
  exit 1
fi
if ! git merge-base --is-ancestor "${TRUSTED_ROLLBACK_SEED_COMMIT}" "${CI_COMMIT_SHA}"; then
  echo "Rollback target predates the trusted rollback seed; freeze deployment." >&2
  exit 1
fi

CHECKED_OUT_SHA="$(git rev-parse HEAD)"
if [[ "${CHECKED_OUT_SHA}" != "${CI_COMMIT_SHA}" ]]; then
  echo "Rollback checkout must match CI_COMMIT_SHA exactly." >&2
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
CLOUDFLARE_DEPLOYMENT_VERSION="${CI_COMMIT_SHA}"
export CONVEX_DEPLOY_KEY CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
export CONVEX_DEPLOYMENT VITE_CONVEX_URL TEMPLATE_HOSTED_URL
export CLOUDFLARE_PAGES_PROJECT CLOUDFLARE_PAGES_BRANCH DEPLOY_ENVIRONMENT
export CLOUDFLARE_DEPLOYMENT_VERSION

node scripts/_project-config.mjs assert-convex-deploy-key production
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts validate-inputs pending
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts verify-rollback "${ROLLBACK_RECEIPT_PATH}"
pnpm exec tsx tooling/release/src/index.ts deploy-doctor production

DEPLOY_ENVIRONMENT=production pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts convex
(cd packages/convex && pnpm exec convex run demo/showcase:seed)
tooling/ci/deploy-canary.sh backend

pnpm build
pnpm smoke:web-static
DEPLOY_ENVIRONMENT=production pnpm exec tsx tooling/release/src/deploy/guardedDeploy.ts cloudflare
tooling/ci/deploy-canary.sh hosted

RECEIPT_PATH="guarded-production-rollback-receipt.json"
pnpm exec tsx tooling/quality/check-deploy-authority-receipt.mts record "${RECEIPT_PATH}"
node -e 'const receipt=require("./guarded-production-rollback-receipt.json"); console.log("production rollback receipt", JSON.stringify(receipt))'
