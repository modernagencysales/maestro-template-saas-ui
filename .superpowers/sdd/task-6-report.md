# Task 6 report — unify verified principals and repair tenant identity

## Commit

`f747086 fix: authenticate every headless principal`

## Delivered changes

- User tenancy rows now require an issuer-bound `tokenIdentifier` and use the
  `by_token_identifier` index. Session lookup call sites in provisioning,
  handler context, workspace access, and editor sync no longer select users by
  bare subject.
- Provisioning requires both a provider subject and trusted token identifier;
  the migration note documents deterministic backfill from canonical
  `(issuer, subject)` provider data.
- Added `AnonymousPrincipal`, API-key scopes on `Principal`, and an API-key
  authentication boundary that hashes the bearer credential once, loads by the
  hash, checks revocation/expiry/scopes, and derives authority only from the
  stored row.
- Added `executeAuthorizedOperation` with a single adapter path, policy-kind and
  API-key scope validation, and an explicit caller-workspace/principal authority
  mismatch rejection. `principalSurfaceFor` maps public `ui` to principal `web`.
- Removed the `acme-demo -> workspace_123` HTTP tenant oracle; requests must now
  carry a workspace ID (which the dispatcher can compare with a verified
  principal).

## Tests and checks

- RED observed:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/headless-auth.test.ts`
  failed as expected because `authenticateApiKey` did not exist.
- Focused local test command was subsequently blocked before execution by the
  shared load guard (`host-test-slot: waiting for load 15.01 < 10.00`).
- Remote focused suite completed successfully with no failure output:
  `rtk maestro-remote-test -- pnpm --dir packages/convex exec vitest run test/authorized-dispatch.test.ts test/headless-auth.test.ts test/headless-executor.test.ts test/http-docs.test.ts test/tenancy-tables.test.ts`.
- `rtk maestro-remote-test -- pnpm check:schema-migration-notes` completed
  successfully with no failure output.
- `rtk git diff --check` passed before commit.
- Remote `check:generators` and `check:convex` each returned exit code 1 with no
  emitted diagnostic, so they require a rerun on an available remote worker.

## Files

Implementation: `principal.ts`, `authorizedDispatch.ts`, `workspaceAccess.ts`,
the access/provisioning/handler-context files, `editor/sync.ts`, `users.ts`,
`headless/auth.ts`, and `httpRequest.ts`.

Tests: `authorized-dispatch.test.ts`, `headless-auth.test.ts`,
`http-docs.test.ts`, and `tenancy-tables.test.ts`.

Migration note:
`docs/template/migrations/2026-08-03-token-identifier-and-api-principal.md`.

## Review remediation

- Generated Confect `authorizationBindings` now bind surface, transport,
  operation, and auth policy. The dispatcher authenticates, admits/emergency
  denies, validates tenant authority, authorizes, then invokes the shared
  executor.
- Deployable HTTP session and API-key requests now use that dispatcher. API
  principals derive persisted ID, workspace, scopes, status, expiry, and the
  requested API/CLI/MCP surface; users are web-only and webhooks system-only.
- Added bounded executable `httpAuthorization:backfillTokenIdentifiers` for
  trusted issuer/subject triples and refreshed stale identity fixtures.

Fresh evidence: the initial focused run failed 7 authorization/auth tests and
the migration test failed before its executable existed. The final focused run
passed 50/50 tests across 7 files, and `pnpm --dir packages/convex typecheck`
passed. `pnpm confect:manifest` passed. `pnpm confect:codegen` reported outputs
up to date but removed the existing plain Convex `httpAuthorization.ts`; that
runtime adapter was restored, so `check:generators` remains a follow-up until
the plain adapter is promoted into the Confect spec/impl tree.

## Re-review remediation

- API-key HTTP requests now execute the same internal authorization query as
  sessions. The query re-reads the persisted key document, active creator,
  workspace, organization, and memberships; archived workspaces and suspended
  organizations fail before the operation handler.
- `executeAuthorizedOperation` uses the `Principal` returned by `authenticate()`
  for policy, tenant, authorization, and execution decisions; the
  caller-supplied principal is no longer the verified authority.
- User identity is in the deployable first migration phase: optional
  `tokenIdentifier`, temporary fail-closed `by_subject` reads, and a staged
  `by_token_identifier` index. The executable backfill now runs over actual
  legacy rows. The migration note documents the later enable-index and
  required-field deploy, and the test pins that final required schema.
- HTTP authorization and backfill now live in Confect-owned `.ts`, `.spec.ts`,
  and `.impl.ts` sources. Confect codegen recreates the registered-function
  module and thin `convex/httpAuthorization.ts` wrapper.

Fresh exact evidence:

- RED: 4/4 focused files failed on forged-principal trust, missing API-key
  principal authorization, unstaged schema, and missing Confect ownership.
- `rtk pnpm --dir packages/convex typecheck`: exit 0.
- Focused Vitest: 8 files passed, 55 tests passed.
- `rtk pnpm confect:codegen`: exit 0, generated files up to date.
- `rtk pnpm check:generators`: exit 0,
  `check:generators (shape-only): ok (pin-only)`.
- `rtk pnpm check:convex`: exit 0, `Codegen introduced no generated drift.`
- `rtk git diff --check`: exit 0.
- Repository preflight remains environmental: exit 4 with
  `Next: Install the required Node version.`
