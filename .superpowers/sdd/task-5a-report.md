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

## Review remediation

Reviewer findings were addressed in commit `cc67e67`:

- controller attestation now requires a controller-trusted root, HMAC binding,
  expiry, immutable base binding, and rejects candidate-path spoofing;
- deployable HTTP routes fail closed without injected authentication/
  authorization and use auth → admission → authorization → handler ordering;
- `ops/flags:evaluate` authenticates before admission and then performs
  workspace authorization;
- protected-base fixture bytes and digest are verified against the attested
  base; the unused duplicate registration guard was removed.

Fresh verification: `check-contracts.test.mts` 52/52, lifecycle/admission/http/
flags focused suites 30/31 (the sole failure is the pre-existing partial-route
`arrayContaining` assertion), Convex typecheck, and `check:auth-demo-bypass` all
passed.

## Final review remediation

The remaining C4b findings were closed with direct trust-boundary checks:

- `verifyProtectedBaseFixture` now validates the declared schema, fixed auth
  policy path, and SHA-256 against `git show <attested-base>:<path>`; changing
  candidate fixture JSON and its sidecar digest together no longer supplies the
  protected bytes.
- The deployable HTTP adapter now authorizes the parsed operation/workspace via
  `httpAuthorization:authorize`. That internal query derives the required role
  from the operation and resolves the authenticated user's live workspace and
  organization memberships before the operation runner executes.
- Lifecycle tests invoke the actual exported Convex HTTP router. A mutated dark
  registration stops after authentication, and a denied authorization query
  proves neither the mutation nor action handler executes.

Red evidence: the new focused run failed 3/60 exactly because the two mutated
protected-base fixtures were accepted and the deployable route skipped its
authorization query. Green evidence: the same two files then passed 60/60.

Requested five-file verification completed with 84/87 passing. The three
failures are outside this remediation diff: the previously documented
`http-docs.test.ts` partial-object `arrayContaining` assertion, plus two
`flags.test.ts` fixture decode failures
(`Expected string, got undefined at ["id"]`) present alongside the shared
worktree's unrelated Task 6 edits. Convex typecheck reports no diagnostics in
the remediation files; it remains red on unrelated existing/shared-worktree
diagnostics in provisioning, surface transport coverage, headless principal
typing, and Task 6 tenancy test fixtures.
