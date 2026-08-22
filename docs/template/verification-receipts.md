# Maestro Verification Receipts

Status: implemented. The typed diagnostic registry projection, receipt JSON
Schema, read-only CLI/MCP verification path, and explicit CLI-only export are
wired through one library contract.

Package scripts remain authoritative. Maestro verification projects their
results into a versioned receipt; it never edits a gate, weakens required
checks, or treats a static shape check as stronger runtime evidence.

```bash
pnpm maestro -- verify --scope focused --changed tooling/agent-pack
pnpm maestro -- verify --scope full
pnpm maestro -- check
pnpm maestro -- verify-export --scope full --json
pnpm maestro -- verify-export --scope full --fingerprint <preview-fingerprint> --write
```

Default focused verification is the canonical non-empty registry projection of
`gates`, `secret-canaries`, `headless-surface-contract`, and
`workflow-semantics`. CLI and MCP resolve the same descriptors and exact argv.
Any focused request that resolves to zero gates fails closed with
`AGENT_PACK_VERIFY_GATE_SELECTION_EMPTY`; an empty receipt can never summarize
as passing.

`secret-canaries` retains its canonical gate ID when the pinned `gitleaks`
prerequisite is absent. The shared CLI/MCP runner reports that gate unavailable,
fails required readiness, and points to the checksum-pinned installer; it never
synthesizes a scan result or drops the gate.

The repository-owned `pnpm maestro -- verify` and `pnpm maestro -- check`
commands persist their complete receipt to `.maestro/verification-receipt.json`,
including required failures and advisory findings. Persistence failure is
blocking, so readiness never reports evidence as current when the bounded write
did not succeed. `maestro_verify` over MCP returns the same receipt projection
without writing a target file.

`verify-export` remains available for an explicitly reviewed export workflow. It
is a preview by default; `--write` requires the exact preflight fingerprint
returned by preview, rechecks that fingerprint after verification, and writes
only the bounded target-local receipt. A stale or unavailable fingerprint fails
before persistence.

Each observation preserves:

- stable gate ID and required or advisory posture;
- static, behavioral, runtime, live-promotion, or advisory evidence class;
- pass, fail, skipped, or unavailable state;
- canonical documentation, safe repair guidance, and exact argv/rerun;
- workflow semantic rule ID when applicable.

Receipts bind command/version, subject commit and dirty state, environment and
provider-posture fingerprints, selected scope, changed paths, partial evidence,
and gate observations. They become stale after a later commit, dirty-state
change, relevant environment or provider-posture change, or when only partial
scope was recorded.

Build readiness distinguishes a missing receipt, malformed receipt, current
pass, current failure, and stale evidence. When evidence is absent or invalid,
rerun `pnpm maestro -- verify --scope focused`; an unrelated `pnpm verify`
invocation does not emit a Maestro receipt.

Environment and provider fingerprints contain domain-separated aggregate
bindings for configured values, including provider deployment/project/account
identity where the environment manifest makes it observable. A same-name value
change stales the receipt. Raw values and one-value hashes are never returned.

`taste` and `contract-review` remain advisory. A deterministic required-gate
failure is blocking; advisory evidence cannot make a required failure pass.

Full scope invokes `pnpm verify`. On success, its exact canonical package-script
members are attributed as passing without rerunning them. If that aggregate
process fails, Maestro replays the canonical package-script argv sequentially
for attribution, preserves gates that actually pass or fail, and marks only
later gates unavailable with the exact causal command. The aggregate failure
remains a blocking diagnostic with `pnpm verify` as its rerun; one process exit
is never projected as an all-gates verdict.

For a receipt-producing delivery-batch run, use
`pnpm maestro -- verify --scope full`, not `pnpm verify`. Remote execution uses
`maestro-remote-test -- pnpm maestro -- verify --scope full --json`; retain
stdout's `data.receipt` and confirm its `subject.commit` is the exact frozen
SHA. The remote worktree is deleted after the command, so do not instruct
operators to inspect its receipt file afterward.

The machine contract is
[`schemas/maestro-verification-receipt.schema.json`](../../schemas/maestro-verification-receipt.schema.json).
Committed [pass](./examples/receipts/pass.json),
[pass-with-advisories](./examples/receipts/advisory.json), and
[stale partial-scope](./examples/receipts/stale.json) receipts keep human and
agent consumers aligned with that versioned shape.
