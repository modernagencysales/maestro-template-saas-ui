#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"
# taste — required AI gate. Runs the LLM taste judge over the PR diff and
# fails closed: no provider key, no verdict marker, or a blocking verdict all
# exit non-zero. `--mode fake` is the deterministic no-network wiring check.
cd "$(dirname "$0")/../.."

if [[ "$*" == *"--mode fake"* ]]; then
  pnpm exec tsx tooling/quality/taste.mts --mode fake | pnpm exec tsx tooling/quality/extract-ai-verdict.mts
  exit 0
fi

if [[ -z "${OPENROUTER_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "taste gate requires OPENROUTER_API_KEY or OPENAI_API_KEY in CI" >&2
  exit 1
fi

# The reviewer itself also fails closed when no provider is configured.
export TASTE_REQUIRE_AUTH=1
if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  export TASTE_PROVIDER="${TASTE_PROVIDER:-openrouter}"
  export TASTE_OPENROUTER_MODEL="${TASTE_OPENROUTER_MODEL:-openai/gpt-5.5}"
elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
  export TASTE_PROVIDER="${TASTE_PROVIDER:-openai}"
fi

BASE_BRANCH="${CI_COMMIT_TARGET_BRANCH:-main}"
git fetch origin "${BASE_BRANCH}:refs/remotes/origin/${BASE_BRANCH}" --depth=50 2>/dev/null || true
export TASTE_BASE="origin/${BASE_BRANCH}"
export TASTE_REVIEW_WORKTREE="$(pwd)"

TRUSTED_TREE="$(mktemp -d)"
trap 'rm -rf "$TRUSTED_TREE"' EXIT
git archive "origin/${BASE_BRANCH}" AGENTS.md .woodpecker tooling/ci dependency-cruiser.config.cjs docs/template/coding-standards.md eslint.config.mjs tooling/quality package.json pnpm-lock.yaml pnpm-workspace.yaml |
  tar -x -C "$TRUSTED_TREE"

LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"; rm -rf "$TRUSTED_TREE"' EXIT

GATE_EXIT=0
pnpm exec tsx "$TRUSTED_TREE/tooling/quality/taste.mts" 2>&1 | tee "$LOG_FILE" || GATE_EXIT=$?

VERDICT_JSON="$(pnpm exec tsx "$TRUSTED_TREE/tooling/quality/ai-gate-log-verdict.mts" --marker TASTE_VERDICT_JSON --log-file "$LOG_FILE" || true)"
if [[ -z "$VERDICT_JSON" ]]; then
  echo "taste gate exited without TASTE_VERDICT_JSON — failing closed." >&2
  pnpm exec tsx "$TRUSTED_TREE/tooling/quality/ai-gate-fallback-verdict.mts" --gate taste --log-file "$LOG_FILE" >&2 || true
  exit 1
fi

# Best-effort sticky PR comment; the gate verdict below stays authoritative.
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  VERDICT_FILE="$(mktemp)"
  printf '%s' "$VERDICT_JSON" > "$VERDICT_FILE"
  pnpm exec tsx "$TRUSTED_TREE/tooling/quality/post-ai-gate-comment.mts" --gate taste --verdict-file "$VERDICT_FILE" ||
    echo "taste: PR comment publish failed; the gate verdict remains authoritative." >&2
  rm -f "$VERDICT_FILE"
fi

printf '%s\n' "$VERDICT_JSON" | pnpm exec tsx "$TRUSTED_TREE/tooling/quality/extract-ai-verdict.mts" || GATE_EXIT=1
exit "$GATE_EXIT"
