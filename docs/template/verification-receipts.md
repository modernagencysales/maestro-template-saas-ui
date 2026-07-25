# Maestro Verification Receipts

Status: seam. Typed diagnostic and receipt contracts are implemented; the root
diagnostic registry, receipt JSON Schema, and central CLI registration remain
controller-owned integration.

Raw gate commands and Just recipes remain authoritative. Maestro verification
projects their results into a versioned receipt; it never edits a gate, weakens
required checks, or treats a static shape check as stronger runtime evidence.

```bash
pnpm maestro -- verify --scope focused --changed tooling/agent-pack
pnpm maestro -- verify --scope full
pnpm maestro -- check
```

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

`taste` and `contract-review` remain advisory. A deterministic required-gate
failure is blocking; advisory evidence cannot make a required failure pass.

The machine contract is
[`schemas/maestro-verification-receipt.schema.json`](../../schemas/maestro-verification-receipt.schema.json).
Committed [pass](./examples/receipts/pass.json),
[pass-with-advisories](./examples/receipts/advisory.json), and
[stale partial-scope](./examples/receipts/stale.json) receipts keep human and
agent consumers aligned with that versioned shape.
