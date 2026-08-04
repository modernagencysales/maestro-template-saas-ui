# Task 5a / C4b implementation report

## Result

Wired the shared lifecycle adapters without inventing activation-owned product
registrations. The current generated public-surface inventory has no
`activationJourneyId` entries, so the checked-in activation manifest is the
explicit, schema-versioned empty inventory.

- UI adapters omit non-admitted actions/routes through the shared registration
  helper.
- HTTP and raw-operation dispatch authenticate before admission and do not
  authorize or run a denied handler.
- Feature flags use per-owner admission composition; the owner map is empty
  until C11a adds the first real activation-owned registration.
- `no-admitted-contracts` requires an exact registration-manifest match before
  it can succeed; missing, malformed, or undeclared activation registrations
  fail closed.
- The authoritative base SHA comes only from controller attestation. Candidate
  `PROTECTED_BASE_SHA` input, including `origin/main`, is rejected.
- Authoritative auth-policy source reads now fail closed when protected-base
  material is missing or unparseable. The protected-base fixture and digest
  record the current controller base material.

## Verification

Passed:

```text
host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-contracts.test.mts packages/convex/test/lifecycle-registration.test.ts packages/convex/test/admission-guard.test.ts apps/web/src/navigation/admitted-action.test.ts packages/template-core/src/generated/activation-registration-manifest.test.ts
5 files, 66 tests passed

pnpm --dir packages/convex typecheck
pnpm --dir packages/template-core typecheck
pnpm check:auth-demo-bypass
```

The optional broader HTTP-docs suite ran and had one pre-existing failure in
`packages/convex/test/http-docs.test.ts`: it uses `toEqual(arrayContaining())`
with partial expected route objects while the established route entries also
contain `kind`. The same `kind` fields exist at `HEAD`; this packet did not
change route declarations. The other 81 focused tests passed.

`acceptance:check` cannot be run locally without a controller-issued attestation
and immutable base SHA; static projection coverage is exercised by the
acceptance unit suite above.

## Boundary

C11a owns the first real activation-owned registration and must rerun this exact
adapter/darkness suite after adding it. The pre-existing Task 2 report edit and
nested fixture deletions were left unstaged.
