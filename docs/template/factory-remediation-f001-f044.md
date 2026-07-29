# Factory Remediation: F-001–F-044 and External-User Union

Status: active. This is the durable remediation ledger for the upstream Maestro
SaaS application factory. It must remain current through reproduction, fixes,
fresh-customer proof, and final handoff.

## Scope and authority

- Primary authority: `/home/maestro/change-signal/docs/factory-evaluation.md`,
  findings `F-001` through `F-044`, evaluated at template commit `35c5bd1`.
- Additive read-only authority:
  `/home/maestro/jungler-better-listening/docs/external-user-test-failures.md`,
  findings `F-01` through `F-85` as observed on 2026-07-29. Stable ledger IDs
  use the `ES-F-` prefix so source coordinates cannot collide with ChangeSignal.
- Remediation target: `/home/maestro/maestro-template-saas-ui` on `main`,
  fast-forwarded cleanly to `f55653a0` before remediation.
- ChangeSignal is evidence-only except for status updates after direct upstream
  proof. Signal Scout is strictly read-only evidence.
- No pipeline mutation, deployment, secret access, threshold increase, broad
  ignore, fabricated authority, generated-file hand edit, or fake-success path
  is authorized.

## Coordination checkpoint

- Agent Mail identity: `SwiftBadger`.
- Project key: `/home/maestro/maestro-template-saas-ui`.
- Initial exclusive reservations:
  `docs/template/factory-remediation-f001-f044.md` and
  `docs/template/factory-remediation-f001-f044.evidence.json`.
- Startup inspection: template and ChangeSignal worktrees were clean; Signal
  Scout already had unrelated edits to its failure ledger and remains untouched.
- Historical search: CM returned no rules; CASS was unavailable because its
  lexical checkpoint is incomplete. Current source/tests remain authoritative.

## Work-package classification

All remediation is a `template-gap` repair against the existing application
factory and customer materialization boundary. No new product subsystem is being
introduced. Sub-slices reuse or extend these canonical patterns:

1. Bootstrap and safe create: factory CLI/preflight/materializer.
2. Command/help/provenance: customer command registry and generator dispatcher.
3. Customer closure: privacy-reviewed transitive runtime, test, workspace, and
   verification projection.
4. Generated SaaS slice: canonical Confect, lifecycle, topology, TanStack, and
   UI projections.
5. Workflow emission: `template:add-workflow` plus its focused semantic gates.
6. Headless parity: one operation/ref projection for API, CLI, MCP, and OpenAPI.
7. Acceptance: public create command followed by untouched-customer gates.

## Primary inventory

Each row retains the original status and severity. `triage` means current-main
reproduction or obsolescence evidence is not yet complete.

| IDs         | Original status / severity                        | Root-cause cluster                                                | Current status |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
| F-001–F-002 | Worked around / high                              | bootstrap and pinned package manager                              | triage         |
| F-003–F-006 | Open or worked around / critical–low              | create receipt, reviewability, safe Git handoff                   | triage         |
| F-007–F-015 | Open or worked around / critical–medium           | customer command/help registry, doctor schema, closure, lifecycle | triage         |
| F-016–F-017 | Under evaluation or worked around / high–critical | canonical Confect/workflow generation                             | triage         |
| F-018–F-022 | Open or worked around / critical–high             | canonical headless refs, MCP stdio, customer runtime closure      | triage         |
| F-023–F-030 | Open or customer-corrected / high–medium          | dependency pins, SaaS/TanStack/UI/format/lint output              | triage         |
| F-031–F-036 | Open or customer-corrected / critical–low         | workflow emitter and materialized source/test closure             | triage         |
| F-037–F-043 | Open or customer-corrected / critical–high        | customer test/verify/authority/App Map/SBOM/readiness projection  | triage         |
| F-044       | Customer-corrected / medium                       | route-file identity versus public route node                      | triage         |

## External-user inventory reconciliation

The source ledger deliberately mixes upstream factory issues, product-specific
implementation defects, tester mistakes, environment limitations, and live
deployment evidence. Every source ID is retained here; only genuinely upstream,
non-overlapping claims become remediation requirements.

| Source IDs      | Initial disposition                                                            | Primary overlap or upstream claim                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| ES-F-01–ES-F-07 | upstream candidate                                                             | F-002, release preflight, F-006/F-007/F-011                                                                                        |
| ES-F-08         | likely obsolete / tester error                                                 | shell quoting outside factory                                                                                                      |
| ES-F-09–ES-F-19 | upstream candidate                                                             | F-027, recipe/generator safety, F-013, offline codegen, F-011, F-010                                                               |
| ES-F-20–ES-F-46 | mostly product/test-specific; shared-emitter candidates retained               | naming validation, shared help, workflow emitter, registry/projection brittleness                                                  |
| ES-F-47–ES-F-48 | upstream candidate                                                             | nested help and generated-freshness semantics                                                                                      |
| ES-F-49–ES-F-51 | upstream candidate requiring generic proof                                     | fake start composition, personalization, verification receipt persistence                                                          |
| ES-F-52–ES-F-58 | mixed                                                                          | machine-readable launcher, exit-code preservation, help/schema discovery; product cache/idempotency issues remain product-specific |
| ES-F-59–ES-F-82 | product/test/environment-specific unless generic reproduction proves otherwise | retained for explicit obsolete/not-applicable evidence                                                                             |
| ES-F-83–ES-F-84 | environment/docs candidate                                                     | secret-wrapper/deploy-doctor discoverability; no live mutation permitted                                                           |
| ES-F-85         | upstream candidate                                                             | clean JSON stdout; same root as ES-F-12/ES-F-52                                                                                    |

## Per-finding evidence contract

Before any finding becomes `fixed`, `obsolete`, or `blocked`, record:

1. exact ID/title and original status/severity;
2. narrow current-main reproduction, or direct evidence it is obsolete;
3. root cause;
4. failing regression test first where practical;
5. canonical upstream fix and files;
6. focused command output;
7. untouched fresh-customer evidence;
8. final status and commit.

Detailed per-ID records will be appended below as root-cause clusters close.

## Acceptance contract

The final customer must be materialized to a distinct temporary directory by the
public command and committed locally for cleanliness/freshness tests. It must
prove:

- package-manager preflight and pinned frozen install without lockfile drift;
- concise reviewable preview and collision-safe materialization;
- complete workspace dependency closure;
- command/help/handler/script consistency and doctor compatibility;
- advertised feature, capability, table, workflow, agent, and private-package
  paths;
- offline Confect generation, bounded Convex generation posture, and TanStack
  generation with no unexpected drift;
- MCP stdio initialize, tools/list, tools/call, malformed input, and unknown
  tool behavior;
- one canonical API/CLI/MCP operation/ref projection;
- format, lint, typecheck, tests, workflow gates, App Map, topology, lifecycle,
  security, SBOM/license, provider readiness, builds, and `just verify`;
- no unreviewed large-chunk warning; and
- empty Git status after the normal install/generate/check/test/verify/build
  sequence.

## Progress log

- 2026-07-29: exact goal created; coordination and release-evidence skills
  loaded; both AGENTS files and both complete defect inventories read.
- 2026-07-29: template worktree inspected clean at `35c5bd1`; ChangeSignal
  clean; Signal Scout dirty only in its read-only evidence ledger.
- 2026-07-29: template fast-forwarded without conflict to current `origin/main`
  at `f55653a0`; no other Agent Mail reservations were active.

## Verification evidence

No remediation or acceptance command is yet claimed passing. Exact command
outputs and commit coordinates will be added only after observation.
