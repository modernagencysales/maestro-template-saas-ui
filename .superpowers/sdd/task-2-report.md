# Task 2 report: one quality command authority

## Implementation

- Removed `canonicalScriptBodies` and `canonicalScriptBody` from quality and
  Agent Pack diagnostic descriptors.
- Kept descriptor `argv` as command identity. Root `pnpm <script>` commands
  resolve their current non-empty script from the root `package.json` at run
  time; copied script text is never compared.
- Direct executables and bounded `pnpm --dir <path> <script>` descriptors run
  without a root script lookup. Shell executables and `pnpm exec`/`dlx` remain
  rejected.
- Removed the three package-command static pins that duplicated the removed
  command bodies. Other static requirements were left unchanged.
- Reworded successful static checks from `ok (pin-only)` to `ok`.

## TDD evidence

### RED

```text
rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/quality/src/diagnosticRegistry.test.mts
1 failed: expected descriptor not to have property canonicalScriptBody;
received tsx tooling/quality/check-ci-completeness.mts.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/agent-pack/src/verificationRunner.test.ts
9 failed: copied-body mismatches made current package scripts unavailable.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/agent-pack/src/diagnostics.test.ts
1 failed: direct executable descriptor was rejected.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/agent-pack/src/diagnostics.test.ts
1 failed: bash -lc true was accepted after direct-executable support was added.
```

### GREEN

```text
rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/quality/src/gate.test.mts
1 file passed, 3 tests passed.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/quality/src/diagnosticRegistry.test.mts
1 file passed, 6 tests passed.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/agent-pack/src/verificationRunner.test.ts
1 file passed, 24 tests passed.

rtk fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/agent-pack/src/diagnostics.test.ts
1 file passed, 14 tests passed.

rtk fnm exec --using=22.23.2 -- pnpm --dir tooling/agent-pack typecheck
pass

rtk fnm exec --using=22.23.2 -- pnpm --dir tooling/quality typecheck
pass

rtk fnm exec --using=22.23.2 -- pnpm check:headless-surface-contract
check:headless-surface-contract: ok

rtk fnm exec --using=22.23.2 -- pnpm check:ci-completeness
check:ci-completeness: ok
```

`rtk git diff --check` passed. A source scan found no remaining
`canonicalScriptBody`, `canonicalScriptBodies`, or `pin-only` production text.

## Changed files

- `tooling/quality/src/gate.mts`
- `tooling/quality/src/gate.test.mts`
- `tooling/quality/src/check-definitions.mts`
- `tooling/quality/src/diagnosticRegistry.mts`
- `tooling/quality/src/diagnosticRegistry.test.mts`
- `tooling/agent-pack/src/verificationRunner.ts`
- `tooling/agent-pack/src/verificationRunner.test.ts`
- `tooling/agent-pack/src/diagnostics.ts`
- `tooling/agent-pack/src/diagnostics.test.ts`

## Self-review

- Root package script availability is checked only for the root command kind;
  direct and `pnpm --dir` argv are not misread as root script names.
- Full-run membership and failed-run attribution use descriptor argv identity.
- No Acceptance-owned headless/idempotency code or blueprint hot file changed.
- No static requirement beyond the three command-body consumers was removed.

## Concern / deferred verification

The required combined semaphore suite was deferred because the host semaphore is
overloaded, per controller direction. Controller remote testing should run this
exact command:

```text
rtk host-test-slot --class focused fnm exec --using=22.23.2 -- pnpm exec vitest run tooling/quality/src/gate.test.mts tooling/quality/src/diagnosticRegistry.test.mts tooling/agent-pack/src/verificationRunner.test.ts
```

Per-file GREEN evidence and both required deterministic checks are recorded
above.

The pre-commit lint-staged hook also reports existing complexity/max-parameter
findings in `verificationRunner.ts` and `diagnostics.ts`; the runner findings
pre-date this change, while command-kind validation is covered by the focused
tests and package typechecks above. The hook's format and Qlty stages passed.
