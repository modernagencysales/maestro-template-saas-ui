# Single-pass CI design

## Problem

Woodpecker pipeline 242 was killed after 38 minutes without a test failure. Root
`verify` first runs the full test command, then `check:coverage-ratchet` runs
2,243 of the same tests again under coverage for another 12 minutes 42 seconds.
The chassis also schedules the web runtime-longevity test after `verify` even
though the web test suite already owns it.

## Design

Keep the developer-facing `pnpm test` command unchanged. Add one CI-only test
command containing only suites outside the coverage command plus the three heavy
suites that coverage intentionally excludes. Root `verify` runs that CI-only
command and the existing coverage command, so every deterministic suite still
runs while the broad workspace suite runs once. Remove the redundant post-verify
runtime-longevity invocation from the chassis.

Do not raise the timeout, weaken coverage thresholds, remove security or
acceptance gates, or parallelize tests that currently require serial execution.

## Verification

An owned chassis regression asserts unique suite ownership. Run that regression,
CI completeness, generated-file checks, formatting, lint, and the exact-head
Woodpecker gate.
