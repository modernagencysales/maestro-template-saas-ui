# Post-Port Backlog

Status audit after the porting implementation plan completed (2026-07-01) and
one external diligence review. Each diligence finding is marked resolved,
partial, or open, and every remaining Maestro asset worth porting is listed so
nothing identified during review is lost.

Source of truth for what Maestro has: `modernagencysales/maestro`. Everything
here respects `do-not-port-register.md`.

Current readiness note: this backlog is not a completion gate for the starter
baseline. The maturity model and effectification status are authoritative for
what the template can prove today; this file preserves future acceleration
options and diligence findings so they are not lost.

## Diligence Finding Coverage

| Finding                                 | Status   | Evidence / remaining gap                                                                                                                                                                                        |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product surface was hardcoded demo data | Resolved | Real tenancy (`confect/access`), LLM gateway with live OpenRouter path + spend caps, policy/prompt registry, `sourceGroundedBrief`, workflow runner + trust receipts, bounded agent runtime.                    |
| No real LLM/provider path               | Resolved | `packages/integrations/src/llm.ts` live mode, redaction, kill switch; fake-first preserved.                                                                                                                     |
| Quality gates were string-grep theater  | Resolved | Real AI judges (taste + contract-review, fail-closed), coverage ratchet with checked-in baseline, ESLint layer-law pack, knip, depcruise, gitleaks, type-coverage, Stryker. Remaining pins say `ok (pin-only)`. |
| Mutation testing was fake               | Resolved | `mutation.sh` runs Stryker with `stryker.conf.mjs`.                                                                                                                                                             |
| App factory was thin                    | Resolved | `tooling/generators` emits compiling modules; init/doctor/promote/upgrade/private-package import covered by tests. Enhancement: P11.                                                                            |
| No provenance/history                   | Resolved | `how-this-relates-to-maestro.md`, maturity model, threat model, do-not-port register, 1,383-line porting backlog.                                                                                               |
| 35MB vendored `repos/` bloat            | Resolved | Kept by decision (P8): agents code better with upstream source present; history retains blobs regardless.                                                                                                       |
| Misleading gate names                   | Resolved | Every descriptor-backed gate prints `ok (pin-only)`; rule-coverage.md maps each rule to its enforcement tier.                                                                                                   |
| Reference app is a static brochure      | Resolved | The Start app is the only entry, and the visible shell is now a Saas UI business-app surface instead of the old static reference document. Browser smoke covers the business shell locally.                     |
| Packages with zero tests                | Resolved | `packages/search` is a tested workspace-scoped retrieval seam; every workspace package has tests.                                                                                                               |

## Priority 1 — Correctness and honesty

1. **Real AI gates — DONE.** `tooling/quality/taste.mts` and
   `contract-review.mts` are no-op stubs, but `.buildkite/scripts/taste.sh`
   requires `OPENAI_API_KEY` and pipes through `extract-ai-verdict.mts` as if a
   verdict exists — in live CI this path is broken/misleading. Port Maestro's
   harness (`.buildkite/scripts/ai-gates.sh`,
   `tooling/quality/taste-review.mts`, `contract-review.mts` +
   `contract-review-rubric.md`, fail-closed provider fallback, GitHub
   status/comment posting), genericizing the rubric. Until ported, make the
   stubs print `pin-only` and make `taste.sh` fail with a clear "not yet ported"
   message instead of a fake verdict path.
2. **Coverage ratchet with a baseline — DONE** (83.4% lines baseline checked
   in). `check:coverage-ratchet` only covers `tooling/quality` and has no
   ratchet. Port Maestro's `check-coverage-ratchet.mts` + checked-in
   `coverage-baseline.json` (refuses to lower, `--update` only raises) across
   workspace packages.
3. **Mount the real app shell — DONE.** The TanStack Start router/provider shell
   is mounted as the app, and the visible route surface now uses the Saas UI
   business shell instead of the old static reference document.
4. **`packages/search` — DONE** (tested workspace-scoped seam). Implement the
   search seam (Maestro: `convex/capabilities/brain/retrievalSearch.ts` shape,
   genericized) or delete the package until needed. An exported package name
   with zero behavior is the diligence pattern this repo is trying to kill.

## Priority 2 — Enforcement machinery from Maestro

5. **ESLint rule pack — DONE** (9 rules at error; 96 rule tests). Port
   `tooling/eslint-plugin-maestro` as `tooling/eslint-plugin-template` with the
   domain-neutral rules: `typed-convex-errors`, `require-minrole-on-write`,
   `workflow-steps-are-capabilities`, `workflow-handler-determinism`,
   `workflow-policy-snapshot`, `no-cross-domain-value-import`,
   `no-raw-scheduler`, `frontend-route-thin`, `frontend-route-server-boundary`.
   This is the layer law as machine enforcement, not documentation.
6. **Lefthook + rubric injection — DONE.** Port `lefthook.yml` and
   `scripts/pre-push-rubric.sh`: pre-commit auto-format, pre-push deterministic
   gates, and AI-gate rubric injection so coding agents self-review against the
   exact criteria CI judges. Depends on item 1 for the rubric files.
7. **CI self-protection — DONE for the template scale** (secretless first step +
   pipeline/justfile/lefthook pins; maestro's 1,949-line checker remains the
   reference for deeper pins). Template `check:ci-completeness` is a grep pin;
   Maestro's is 1,949 lines and runs secretless before any credentialed job
   (`ci-self-protection.sh`). Port the pattern: pipeline-shape pins, justfile
   recipe pins, and the secretless first stage. Add `upload-pipeline.sh`
   conditional scheduling (mutation/auto-fix never in PR job graphs) and
   `auto-fix.sh` as the scheduled self-repair job.
8. **~~Delete `repos/`~~ — decided: keep.** The vendored effect/confect source
   stays in the repo intentionally: AI agents code measurably better with the
   upstream source and tests present locally, and git history retains the blobs
   anyway so deletion saves no real clone weight. Do not remove.
   `agent-patterns/*` remains the first read; `repos/*` is the deep reference.

## Priority 3 — Dev workflow and curation

9. **Label remaining pin-gates — DONE.** Every gate still backed by
   `src/check-definitions.mts` descriptors should say so in its output
   (`check:debt: ok (pin-only)`) and in `docs/rule-coverage.md`, so a passing
   run never overstates enforcement.
10. **Stack merge tooling — DONE** (42 tests; `stack:*` scripts). Port
    `tooling/stack/` (merge-preflight, mergeability, plan, submit, sync — all
    through the injectable `exec.mts` Runner seam). Encodes the hard-won rule:
    never manually squash-merge stacked PRs.
11. **Generator test scaffolds — DONE** (fast-check property tests emitted;
    blueprint growth continues per client need). Maestro's `pnpm new:<kind>`
    scaffolds fast-check property tests alongside implementation so generated
    modules are born tested. Add test scaffolds to template blueprints and grow
    the blueprint set beyond `gtmImplementation`.
12. **Justfile canonical gate recipes — DONE.** Port Maestro's justfile pattern:
    canonical recipe names (`just verify`) consumed identically by local dev,
    CI, and agent SOPs, with names pinned by check-ci-completeness.
13. **`rule-coverage.md` — DONE** (rule → enforcement tier map with unenforced
    list). Template's is 1.7K; Maestro's 78K maps every stated rule to its
    enforcing gate or marks it unenforced. Expand as rules gain real enforcement
    (items 1, 2, 5, 7).
14. **AGENTS.md operating depth — DONE** (working-loop section). Template 6.2K
    vs Maestro 14.7K. Port the generic agent-operating rules: generators-first,
    gate discipline, commit conventions, generated-file protection,
    verification-before-completion.
15. **`.github/` hygiene — DONE.** Port `pull_request_template.md` and a
    CODEOWNERS seed.
16. **Deploy doctor family — deploy:doctor is real and fail-closed;**
    smoke-deploy/convex-prod-env checks land as client forks approach L5
    (unchanged scope). `deploy:doctor` exists in release tooling; Maestro also
    has `smoke-deploy.mjs`, `check-convex-production-env.mjs`,
    `doctor-cloudflare-checks.mjs`, `apply-worker-vars.mjs`. Port as client
    forks approach L5 (provisioned deploys).

## Later / evaluate

- **Installable CLI release pipeline** (`tooling/maestro-cli` +
  `.github/workflows/maestro-cli-release.yml`) once client forks ship CLIs.
- **`apps/nk-preview`** component-preview app pattern for the UI kit.
- **`packages/shared`** utilities — review for generic helpers worth lifting.
- **`tooling/pipeline`** PR preflight/create scripts — useful if forks adopt the
  same agent-orchestrated PR flow; skip the Fabro-specific pieces.

## Explicitly not ported (confirmed against do-not-port register)

`tooling/analytics`, `tooling/corpus`, `tooling/launch`, GTM/LinkedIn eval
fixtures, client data, real prompt bodies, and Fabro-specific orchestration.
