#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
: "${DEPLOY_ENVIRONMENT:?DEPLOY_ENVIRONMENT is required}"
: "${CI_COMMIT_SHA:?CI_COMMIT_SHA is required}"
: "${CONVEX_DEPLOYMENT:?CONVEX_DEPLOYMENT is required}"
: "${TEMPLATE_HOSTED_URL:?TEMPLATE_HOSTED_URL is required}"

case "${MODE}" in
  backend)
    CHECKED_AT="$(date +%s)000"
    export CHECKED_AT
    HEALTH_ARGS="$(node -e 'process.stdout.write(JSON.stringify({environment:"live",commitSha:process.env.CI_COMMIT_SHA,checkedAt:Number(process.env.CHECKED_AT)}))')"
    HEALTH_RESULT="$(cd packages/convex && pnpm exec convex run ops/health:liveness "${HEALTH_ARGS}")"
    export HEALTH_RESULT
    node -e 'const result=JSON.parse(process.env.HEALTH_RESULT); if (result?.ok !== true) throw new Error("Convex liveness canary failed")'
    ;;
  hosted)
    pnpm smoke:hosted
    pnpm smoke:hosted:browser
    pnpm smoke:hosted:a11y
    pnpm smoke:hosted:visual
    ;;
  *)
    echo "Usage: deploy-canary.sh <backend|hosted>" >&2
    exit 2
    ;;
esac
