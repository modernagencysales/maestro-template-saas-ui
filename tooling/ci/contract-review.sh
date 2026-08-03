#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"
# contract-review — required AI gate. Judges the whole PR against AGENTS.md and
# the contract-review rubric, failing closed: no provider key, no verdict
# marker, or a blocking verdict all exit non-zero. `--mode fake` is the
# deterministic no-network wiring check.
cd "$(dirname "$0")/../.."

if [[ "$*" == *"--mode fake"* ]]; then
  pnpm exec tsx tooling/quality/contract-review.mts --mode fake | pnpm exec tsx tooling/quality/extract-ai-verdict.mts
  exit 0
fi

if [[ -z "${OPENROUTER_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "contract-review gate requires OPENROUTER_API_KEY or OPENAI_API_KEY in CI" >&2
  exit 1
fi

# The reviewer itself also fails closed when no provider is configured.
export CONTRACT_REVIEW_REQUIRE_AUTH=1

BASE_BRANCH="${CI_COMMIT_TARGET_BRANCH:-main}"
git fetch origin "${BASE_BRANCH}:refs/remotes/origin/${BASE_BRANCH}" --depth=50 2>/dev/null || true
export CONTRACT_BASE="origin/${BASE_BRANCH}"
CONTRACT_REVIEW_WORKTREE="$(pwd)"
export CONTRACT_REVIEW_WORKTREE

TRUSTED_TREE="$(mktemp -d)"
trap 'rm -rf "$TRUSTED_TREE"' EXIT
git archive "origin/${BASE_BRANCH}" AGENTS.md .woodpecker tooling/ci dependency-cruiser.config.cjs docs/template/coding-standards.md eslint.config.mjs tooling/quality package.json pnpm-lock.yaml pnpm-workspace.yaml |
  tar -x -C "$TRUSTED_TREE"

LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"; rm -rf "$TRUSTED_TREE"' EXIT

GATE_EXIT=0
pnpm exec tsx "$TRUSTED_TREE/tooling/quality/contract-review.mts" 2>&1 | tee "$LOG_FILE" || GATE_EXIT=$?

VERDICT_JSON="$(pnpm exec tsx "$TRUSTED_TREE/tooling/quality/ai-gate-log-verdict.mts" --marker CONTRACT_VERDICT_JSON --log-file "$LOG_FILE" || true)"
if [[ -z "$VERDICT_JSON" ]]; then
  echo "contract-review gate exited without CONTRACT_VERDICT_JSON — failing closed." >&2
  pnpm exec tsx "$TRUSTED_TREE/tooling/quality/ai-gate-fallback-verdict.mts" --gate contract-review --log-file "$LOG_FILE" >&2 || true
  exit 1
fi

# Best-effort sticky PR comment; the gate verdict below stays authoritative.
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  VERDICT_FILE="$(mktemp)"
  printf '%s' "$VERDICT_JSON" > "$VERDICT_FILE"
  pnpm exec tsx "$TRUSTED_TREE/tooling/quality/post-ai-gate-comment.mts" --gate contract-review --verdict-file "$VERDICT_FILE" ||
    echo "contract-review: PR comment publish failed; the gate verdict remains authoritative." >&2
  rm -f "$VERDICT_FILE"
fi

printf '%s\n' "$VERDICT_JSON" | pnpm exec tsx "$TRUSTED_TREE/tooling/quality/extract-ai-verdict.mts" || GATE_EXIT=1
exit "$GATE_EXIT"
