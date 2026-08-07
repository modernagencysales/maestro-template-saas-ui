#!/usr/bin/env bash
set -euo pipefail

: "${FACTORY_EPOCH_ID:?FACTORY_EPOCH_ID is required}"
: "${FACTORY_EPOCH_SHA:?FACTORY_EPOCH_SHA is required}"
: "${CI_COMMIT_SHA:?CI_COMMIT_SHA is required}"
started="$SECONDS"
outcome="failure"
emit_receipt() {
  EPOCH_DURATION_SECONDS="$((SECONDS - started))" EPOCH_OUTCOME="$outcome" node -e 'console.log(JSON.stringify({epoch_id:process.env.FACTORY_EPOCH_ID,sha:process.env.FACTORY_EPOCH_SHA,outcome:process.env.EPOCH_OUTCOME,duration_seconds:Number(process.env.EPOCH_DURATION_SECONDS)}))'
}
trap emit_receipt EXIT

head_sha="$(git rev-parse HEAD)"
[[ "$FACTORY_EPOCH_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$FACTORY_EPOCH_SHA" == "$head_sha" ]]
[[ "$FACTORY_EPOCH_SHA" == "$CI_COMMIT_SHA" ]]

source tooling/ci/setup.sh
pnpm install --frozen-lockfile
if ! bash tooling/ci/install-qlty.sh; then
  echo "epoch: Qlty install unavailable; advisory check will continue" >&2
fi
pnpm check:qlty -- --all
pnpm verify
outcome="success"
