# AI App Factory Chassis Repair Design

## Objective

Make `maestro-template-saas-ui` a reliable, mostly AI-driven chassis for bounded
customer applications. A successful repair must generate a standalone customer
repository, expose one genuinely complete workspace-safe CRUD golden path,
remain stable under real browser use, and prevent a broken candidate from
merging or being sealed.

The chassis remains an AI-assisted application platform. It does not claim that
arbitrary billing, authentication, provider integrations, or autonomous agent
behavior can ship without technical review.

## Scope

This repair covers four coupled boundaries:

1. Customer release composition and sealing.
2. Local browser runtime stability.
3. A complete generated CRUD vertical slice.
4. Deterministic Woodpecker admission for all three boundaries.

It deliberately reuses the existing blueprint, recipe, transaction, receipt,
backup, Confect, and CLI machinery. No replacement generator or orchestration
layer will be introduced.

## Current Failures

- The current customer projection omits the root `acceptance:check` script.
- `.factory/project.yaml` is shipped but has no customer ownership
  classification, so canonical customer materialization fails closed.
- The sealed alpha.2 Agent Pack release lacks the current Corepack fallback and
  realpath behavior.
- A real browser navigation can leave a TanStack SSR transformation alive; its
  120-second lifetime guard then throws an unhandled error and kills Vite.
- The generated Milestone recipe is an honest scaffold but not a complete
  application feature: its schema lacks domain fields, its capability returns a
  canned result, its UI reads fixtures, and Edit is inert.
- Woodpecker has firewall, epoch, and deployment workflows but no deterministic
  verification workflow that prevents these failures from reaching the default
  branch.

## Design

### 1. Release integrity

Customer source ownership remains fail-closed. `.factory/project.yaml` will be
classified through the same explicit ownership table as every other shipped
path; the inventory must not gain a wildcard or directory-wide exception.

The customer root script projection will retain `acceptance:check` and its
required tooling closure. A focused generator test will prove the emitted
command and a create-root integration test will prove the materialized customer
repository can execute its canonical registries.

The next sealed customer release will be produced only after current-source
Agent Pack behavior, customer materialization, frozen installation, and customer
tests pass. It will contain the current npx/Corepack fallback and
canonical-realpath behavior. Historical alpha releases remain immutable.

### 2. Runtime stability

The failing runtime path will be reduced to a deterministic browser lifecycle:
start in fake mode, navigate to a server-rendered route, allow hydration,
dispose the browser connection, and prove the Vite child remains alive and
healthy beyond the former failure boundary.

The fix belongs at the first repository-owned boundary that fails to close or
cancel the SSR stream. Dependency version changes are acceptable only if the
failure is demonstrated to originate in an incompatible TanStack package set;
versions must then be aligned as one reviewed set rather than independently
bumped. The CLI supervisor remains responsible only for reporting the child exit
and stopping siblings; it will not hide or restart a broken web child.

### 3. Complete CRUD golden path

The generated CRUD recipe will emit one usable workspace-owned entity with:

- a required title;
- an optional detail;
- a lifecycle status with a closed set of allowed values;
- workspace ownership and created/updated timestamps;
- list, create, read, update, and delete capabilities;
- input validation and workspace isolation at the backend boundary;
- loading, empty, list, detail, create, edit, mutation-success, and
  mutation-failure UI states;
- real fake-mode persistence through the typed adapter;
- Confect-backed behavior through generated typed references;
- model, adapter, backend, and browser behavior tests.

The existing Milestone output will either become this complete vertical slice or
be replaced by the same recipe-owned files. No fixture, canned `accepted`
response, inert action, or "replace this later" copy may remain in a successful
recipe receipt.

Recipe application remains transactional. Exact fingerprints, collision checks,
receipts, backups, missing-preimage witnesses, actual-created witnesses, and
emitted gates remain mandatory.

### 4. Deterministic Woodpecker admission

A new PR verification workflow will run on Woodpecker, the sole CI authority. It
will use Node 22 and the repository-pinned pnpm version and run, at minimum:

- Agent Pack focused and customer test closures;
- generator tests;
- create-root customer integration;
- release composition tests;
- web typecheck and build;
- the generated CRUD behavior closure;
- a fake-mode browser runtime smoke that covers navigation, CRUD, health, and
  clean shutdown.

Firewall remains an independent policy gate. Qlty remains advisory. No
Buildkite, Fabro, or Graphite execution is introduced.

## Data and Control Flow

1. The factory resolves a sealed blueprint and previews its exact writes.
2. Materialization copies only explicitly classified customer-owned sources.
3. The customer repository installs with the frozen lockfile and runs preflight
   without requiring globally installed Corepack.
4. A recipe plan fingerprints the target, applies atomically, writes witnesses
   and a receipt, then runs its emitted gates.
5. The generated web surface calls a fake typed adapter in fake mode and Confect
   capabilities in connected modes.
6. Workspace identity is passed to every operation and enforced again at the
   backend boundary.
7. Woodpecker independently regenerates and exercises the customer target so
   source-tree tests cannot certify an incomplete release projection.

## Error Handling

- Unknown customer paths remain hard failures with the exact path named.
- Invalid CRUD input returns typed validation failure and does not mutate data.
- Cross-workspace reads or mutations return no data or a typed authorization
  failure; they never disclose another workspace's entity.
- Failed recipe writes or gates retain the existing receipt and recovery
  evidence.
- Runtime readiness failures retain grouped child logs and terminate all
  supervised children.
- CI fails on any generator, release, runtime, build, or behavior regression.

## Acceptance Evidence

The chassis is repaired only when all of the following are observed from a clean
current-source worktree:

1. Generator, create-root, release, and Agent Pack suites pass with zero
   failures and no cleanup timeout.
2. A new sealed release materializes into an empty directory, installs with
   `--frozen-lockfile`, and passes preflight on macOS with Node 22 both with and
   without a global Corepack executable.
3. The CRUD recipe applies atomically to that customer target and all emitted
   gates pass.
4. Browser automation creates, reads, updates, lists, and deletes an entity;
   verifies empty and error states; and reports no page or console errors.
5. The fake-mode process remains healthy after browser navigation beyond the
   former 120-second failure boundary, then stops cleanly on user signal.
6. The production web build and typecheck pass.
7. The Woodpecker verification workflow contains and runs the same decisive
   closures.
8. The implementation worktree is clean after committed changes and no audit
   server or test process remains running.

## Operating Boundary

After this repair, the chassis is suitable for productized workspace apps,
internal tools, client delivery systems, lead-intake systems, and source/GTM
Brain applications. Every production customer app still requires human review of
its domain schema, tenancy, authentication, live providers, secrets, deployment,
and rollback posture.
