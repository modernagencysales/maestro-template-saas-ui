# External-User Friction Hardening Design

## Context

The Signal Scout external-user failure ledger records failures encountered while
using `maestro-template-v0.2.0-alpha.2` from a clean environment. A fresh audit
of the release tip shows that later reseals repaired several original findings,
including `maestro scaffold --help`, the reviewed scaffold entry point,
`add-client-domain`, direct generator execution, materialized customer workspace
compilation, and plan checking. The remaining repeatable problems cluster around
day-zero bootstrap, command discovery, automation-safe output, reviewed writes,
and generated-target self-containment.

This change hardens the published release line rather than the older `main`
line. The release is 86 commits ahead of `origin/main` and contains the factory
and generated-customer surfaces exercised by the ledger.

## Goals

- Make the first supported command runnable before dependencies are installed.
- Give every documented command and subcommand useful zero-exit help.
- Preserve valid machine-readable stdout and the CLI's documented exit code.
- Route consequential generation through one reviewable safety contract.
- Reject ambiguous input instead of silently interpreting only part of it.
- Detect generated targets that contain unresolved workspace dependencies or
  documentation links to files omitted from the target.
- Make offline/fake-mode, code-generation freshness, verification evidence, port
  ownership, and hosting guidance truthful and actionable.
- Add regression coverage tied to the externally observed failure modes.

## Non-goals

- Generalize Signal Scout-specific commands, cache behavior, provider schemas,
  or branding into the factory.
- Claim production durability for workflow features that the compatibility
  ledger still marks restricted or unsupported.
- Require private provider credentials for fake-mode validation.
- Merge the release line into the older `main` line as part of this change.
- Stop, reconfigure, or take ownership of ports held by another process.

## Scope Guard

The implementation may change the bootstrap script, factory and shared CLI
parsers, generator command metadata, customer composition, release validation,
and the directly related template documentation and tests. It may not refactor
unrelated product features, replace the workflow engine, change provider
behavior, or absorb application-specific fixes from the Signal Scout target.

## Approach

### 1. Install-free bootstrap diagnosis

Add `scripts/maestro-bootstrap.mjs`, runnable with the system `node` before
`pnpm install`. Its pure diagnostic core receives injected runtime facts and
returns structured checks for:

- the Node major pinned by `.nvmrc`;
- the exact pnpm version pinned by `packageManager`;
- Corepack availability;
- repository-local or global Git author name and email;
- the next safe installation command.

Human output leads with the exact repair. JSON output is a single document. When
Corepack is missing or broken, the supported fallback is
`npx --yes pnpm@10.12.1`; when Git identity is absent, the output gives
repository-local `git config user.name` and `git config user.email` examples
without changing global configuration. The existing post-install preflight
reuses the same wording and does not describe pnpm as unavailable when the
pinned standalone invocation is already working.

### 2. Shared command discovery

Define command help as data and render it through the factory CLI and direct
generator CLI. Root help remains concise. `--help` and `-h` succeed for every
documented command group, including the shared `workflow` surface and each
`template:add-*` generator. Generator help names required arguments, reviewed
ownership arguments, preview behavior, the reviewed scaffold equivalent, and the
focused checks that follow a write.

Unknown commands retain a non-zero exit and include the nearest useful help or
suggestion. Help never performs preflight, network access, code generation, or
writes.

### 3. Automation-safe launcher and parsing

Ship a cross-platform repository-owned Node launcher at `maestro-template.mjs`
and include it in generated customer targets. Users run it as
`node maestro-template.mjs`, so it invokes the local CLI entry point without
package-script banners or an unrelated executable named `maestro`. Interactive
documentation may retain `pnpm maestro`; automation and JSON examples use the
owned Node launcher.

The launcher must preserve stdout, stderr, signals, and exact child exit codes.
With `--json`, stdout contains one JSON document and diagnostics stay on stderr.
The system-catalog parser rejects surplus positional arguments with guidance to
quote a multi-word query. It must never silently reduce `social sync` to
`social`.

### 4. One reviewed generator safety contract

The reviewed `maestro scaffold` path remains the authority for consequential
writes. Its preview exposes:

- proposed files and collisions;
- privacy posture;
- semantic rules and manual follow-up;
- a fingerprint over the exact preview;
- the exact write command containing that fingerprint;
- focused code-generation and verification commands.

Direct `template:add-*` commands remain compatible for existing users. Their
help and preview identify the reviewed scaffold equivalent, and documentation
uses the reviewed route for the normal customer loop. A direct write must not
silently bypass an existing collision check.

### 5. Generated-target integrity

Extend release/customer materialization validation with two deterministic checks
before a target is accepted:

1. Every `workspace:*` dependency resolves to a package included in the
   generated workspace.
2. Every generated instruction that references a repository-relative path points
   to a shipped file, or is rewritten to a generated-target-safe canonical
   document.

Factory-only packages may remain in the factory, but generated package manifests
cannot depend on them unless their package directories are also in the target
composition. Vendored `repos/effect` and `repos/confect` references must not
appear as required generated-target instructions when those trees are omitted.

### 6. Truthful operational guidance

- Rename the current generated-file check so it distinguishes committed
  freshness from a reviewed uncommitted code-generation diff. Provide a check
  that snapshots before generation and fails only when generation itself adds
  new drift.
- Document offline Confect contract generation separately from live Convex
  deployment code generation. Fake-mode instructions never suggest creating or
  selecting an external Convex project.
- Persist verification evidence only in an ignored, bounded receipt owned by the
  verification command. The readiness view must label absent or stale evidence
  accurately.
- On port collision, report the exact occupied port, the owning process when it
  can be observed safely, and supported override arguments. Never kill or
  restart the owner.
- Keep hosting documentation aligned with the artifact actually produced by each
  generated blueprint. Static Vite and Astro outputs must not share an incorrect
  hard-coded directory.

## Components and Boundaries

- `scripts/maestro-bootstrap.mjs` owns pre-install host diagnosis only.
- Factory preflight owns post-install repository and compatibility diagnosis.
- CLI command metadata owns names, help, arguments, and render modes.
- The launcher owns process fidelity, not command parsing.
- Generator descriptors own reviewed argument names, safety metadata, and
  focused checks.
- Customer composition owns which files and workspace packages ship.
- Release validation owns cross-file integrity of the materialized target.
- Verification owns evidence receipts; the readiness UI only reads and renders
  them.

These units exchange serializable values. No UI component or provider adapter is
imported into bootstrap, parsing, generation, or validation code.

## Data Flow

1. A new user runs `node scripts/maestro-bootstrap.mjs`.
2. Bootstrap reports runtime facts and an exact pinned install command.
3. The user invokes the owned launcher for help or preflight.
4. Command metadata parses the request and selects human or JSON rendering.
5. A generator preview resolves the canonical system owner, calculates files,
   collisions, privacy posture, follow-up checks, and its fingerprint.
6. An exact confirmed write materializes files.
7. Target-integrity validation verifies workspace and documentation closure.
8. Focused verification emits a bounded receipt consumed by readiness views.

## Error Handling

- Missing prerequisites produce stable diagnostic codes and exact rerun
  commands; they do not throw raw subprocess errors.
- Invalid or ambiguous arguments exit non-zero and never mutate state.
- Help exits zero even when required command arguments are absent.
- JSON mode never mixes human banners into stdout.
- Fingerprint mismatch, collisions, unresolved workspace dependencies, and
  missing generated-target references fail closed before writes or release
  acceptance.
- Port conflicts and live deployment requirements are reported as external
  state, not application-source failures.

## Quality Targets

- A clean user can discover the pinned install fallback without Corepack.
- All documented help commands exit zero and are covered by contract tests.
- Machine output parses with `JSON.parse` and preserves documented exit codes.
- No generated target has an unresolved `workspace:*` dependency.
- No required generated-target document points at an omitted path.
- No consequential reviewed write occurs without collision and fingerprint
  validation.
- Fake/offline checks make no network request and never prompt for an account.

## Test Plan

- Unit-test bootstrap results for supported tools, stale Node, wrong pnpm,
  missing/broken Corepack with standalone fallback, and absent Git identity.
- Contract-test `--help` and `-h` for factory commands, shared headless groups,
  and every reviewed generator descriptor.
- Spawn the owned launcher and assert clean JSON stdout, separated stderr, exact
  exit-code preservation, and signal forwarding where portable.
- Reproduce unquoted multi-word system lookup and assert actionable rejection;
  assert a quoted multi-word query remains one value.
- Preview a reviewed generator and assert collisions, privacy posture,
  fingerprint, exact confirmation, codegen, and focused gates.
- Materialize a customer target and verify workspace dependency closure and
  generated documentation links. Add deliberately broken fixtures that fail each
  validator.
- Test code-generation freshness with clean committed output, newly generated
  drift, and an already-reviewed uncommitted generated diff.
- Test verification receipt states: absent, current, stale, failed, and
  malformed.
- Test start behavior for free ports, occupied defaults, supported overrides,
  and child failure without stopping the existing owner.
- Check hosting documentation and generated scripts against each blueprint's
  actual output directory.
- Run focused package tests after each red-green cycle, then the full
  host-semaphored `pnpm test` and `just verify` gates.

## Rollout

Land the work as small commits grouped by bootstrap, discovery/launcher,
generator safety, generated-target integrity, and operational truthfulness.
Existing interactive commands remain compatible. Documentation switches its
recommended automation examples only after the owned launcher and tests exist.
The final release audit reruns the original reproducible commands and records
which ledger findings are fixed, mitigated, environmental, or intentionally
unsupported.
