# Contributor Guide

## First-Day Setup

```bash
pnpm install
pnpm check:format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use fake providers until a task explicitly asks for live provider setup.

## Local Commands

- `pnpm check:format`: formatting check.
- `pnpm lint`: ESLint.
- `pnpm typecheck`: TypeScript project references through Turbo.
- `pnpm test`: all package tests.
- `pnpm test:tooling`: focused tooling tests.
- `pnpm test:workflow`: focused workflow tooling tests.
- `pnpm build`: all package builds.
- `pnpm verify`: full deterministic gate chain.

## PR Workflow

Use small commits that match the implementation plan tasks. Publish ordinary
GitHub branches and PRs while preserving task-sized commit boundaries.

## Reading CI Failures

1. Check deterministic gates first: format, lint, typecheck, tests, build, and
   repo-specific check scripts.
2. Check generated-file failures next. Regenerate through the official script;
   do not edit generated files by hand.
3. Check provider or auth failures for missing fake-mode configuration before
   assuming the provider implementation is wrong.
4. Check AI gate verdicts last. AI gates explain risks; deterministic failures
   are usually the first fix.
5. For exact AI gate commands and Woodpecker log retrieval, use
   [operations-runbook.md](./operations-runbook.md#ci-and-ai-gate-verdicts).

## Rule Review

If a rule blocks a legitimate change, document the conflict in the PR and add a
small proposal to `docs/template/coding-standards.md` or `docs/rule-coverage.md`
as part of the same review. Do not silently bypass a rule.
