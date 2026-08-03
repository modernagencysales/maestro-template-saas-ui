# Woodpecker Template Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obsolete Buildkite release surface with native Woodpecker
verification and guarded staging/production deployment, then ship the merged
app-idea funnel.

**Architecture:** Two pinned Woodpecker pipelines call provider-neutral scripts
under `tooling/ci`. Existing promotion-authority, provider-isolation, canary,
and receipt primitives remain authoritative; Bitwarden supplies durable operator
bindings and Woodpecker receives deployment-event-scoped copies.

**Tech Stack:** Woodpecker 3.x YAML and CLI, Bash, TypeScript/tsx, Vitest,
Convex CLI, Cloudflare Pages, Bitwarden Secrets Manager, Playwright.

## Global Constraints

- Woodpecker is the only active repository CI/deployment control plane.
- Bitwarden is the durable source for future headless workers; secret values
  never enter source, logs, receipts, or chat.
- Staging and production use distinct Convex identities, URLs, and deploy keys.
- The promotion-authority private signing key never enters this repository,
  Bitwarden worker exports, Woodpecker, or application environments.
- Backend deploy and liveness precede frontend build/deploy in each environment.
- Production targets the exact accepted staging SHA through a distinct
  deployment event.
- All shell commands use `rtk`; focused and full tests use `host-test-slot` with
  the appropriate class.
- Source edits use `apply_patch`; generated or unrelated user changes are
  preserved.

---

### Task 1: Pin the native Woodpecker pipeline contract

**Files:**

- Create: `tooling/quality/woodpecker-template-pipeline.test.mts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Test: `tooling/quality/woodpecker-template-pipeline.test.mts`

**Interfaces:**

- Consumes: repository files through `readFileSync`.
- Produces: a static contract requiring `.woodpecker/verify.yml`,
  `.woodpecker/deploy.yml`, neutral CI script paths, pinned images, trusted
  ordering, target-specific secrets, and no active `.buildkite/pipeline.yml`.

- [ ] **Step 1: Write the failing contract test**

```ts
it("uses Woodpecker as the sole guarded release surface", () => {
  expect(existsSync(".buildkite/pipeline.yml")).toBe(false);
  expect(read(".woodpecker/verify.yml")).toContain("trusted-ci-policy");
  expect(read(".woodpecker/deploy.yml")).toContain(
    'CI_PIPELINE_DEPLOY_TARGET == "staging"',
  );
  expect(read(".woodpecker/deploy.yml")).toContain(
    'CI_PIPELINE_DEPLOY_TARGET == "production"',
  );
});
```

- [ ] **Step 2: Run RED**

Run:
`rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/woodpecker-template-pipeline.test.mts`

Expected: FAIL because the Woodpecker files do not exist and Buildkite remains
active.

- [ ] **Step 3: Point the CI-completeness descriptors at the wished-for
      Woodpecker files**

Update descriptor requirements to name `.woodpecker/verify.yml`,
`.woodpecker/deploy.yml`, `tooling/ci/ci-self-protection.sh`, and
`tooling/ci/phase1.sh`. Require both deployment targets and the existing gate
inventory.

- [ ] **Step 4: Keep the test red for the correct missing implementation**

Re-run the Step 2 command. Expected: FAIL only for absent Woodpecker/scripts,
not test syntax.

- [ ] **Step 5: Commit the red contract**

```bash
rtk git add tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/src/check-definitions.mts
rtk git commit -m "test: pin Woodpecker template release contract"
```

### Task 2: Move CI execution behind neutral scripts

**Files:**

- Create: `tooling/ci/setup.sh`
- Create: `tooling/ci/ci-self-protection.sh`
- Create: `tooling/ci/phase1.sh`
- Create: `tooling/ci/deploy-canary.sh`
- Create: `tooling/ci/staging-deploy.sh`
- Create: `tooling/ci/production-promote.sh`
- Create: `tooling/ci/rollback-promote.sh`
- Modify: `tooling/quality/check-deploy-authority.test.mts`
- Modify: `tooling/quality/check-deploy-authority.mts`
- Modify: `tooling/release/deploy-policy.json`
- Modify: `tooling/release/deploy-trust-bundle.json`
- Delete after replacements pass: corresponding active files under
  `.buildkite/scripts/`

**Interfaces:**

- Consumes: standard CI variables plus `CI_COMMIT_SHA`, `CI_PIPELINE_NUMBER`,
  `CI_PIPELINE_DEPLOY_TARGET`, and explicitly mapped environment bindings.
- Produces: unchanged guarded provider calls and deployment receipts, with
  Woodpecker build coordinates replacing Buildkite coordinates.

- [ ] **Step 1: Rewrite authority fixtures to require neutral paths and
      Woodpecker coordinates**

Replace `.buildkite/scripts/*` fixture keys with `tooling/ci/*`; require
`CI_COMMIT_SHA` and `CI_PIPELINE_NUMBER`; rename `forbiddenBuildkiteEnv` to
`forbiddenCiEnv` in the release policy and verifier types.

- [ ] **Step 2: Run RED**

Run:
`rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-deploy-authority.test.mts tooling/quality/check-deploy-authority-receipt.test.mts`

Expected: FAIL because neutral scripts and Woodpecker receipt coordinates do not
exist.

- [ ] **Step 3: Port scripts without changing release ordering**

Copy behavior into neutral files, translating only orchestrator variables:

```bash
COMMIT_SHA="${CI_COMMIT_SHA:-$(git rev-parse HEAD)}"
CI_BUILD_ID="${CI_PIPELINE_NUMBER:?CI_PIPELINE_NUMBER is required}"
DEPLOY_ENVIRONMENT="${CI_PIPELINE_DEPLOY_TARGET:?deployment target is required}"
```

Staging must validate authority, deploy Convex, seed, run backend canary, build
with exact `VITE_CONVEX_URL`, deploy Pages, run hosted canaries, and record a
receipt. Production preserves the staged-SHA equality check before the same
ordered sequence.

- [ ] **Step 4: Update policy/trust references and remove active vendor
      scripts**

Set job script and rollback paths to `tooling/ci/*`. Keep `guardedDeploy.ts`,
the authority verifier, release policy, and public verification key inside the
trust bundle.

- [ ] **Step 5: Run GREEN**

Run the Step 2 command, then:

`rtk host-test-slot --class focused pnpm check:deploy-authority`

Expected: all authority and receipt tests pass; static verifier exits zero.

- [ ] **Step 6: Commit**

```bash
rtk git add tooling/ci tooling/quality tooling/release .buildkite/scripts
rtk git commit -m "refactor(ci): make guarded deployment vendor neutral"
```

### Task 3: Add native verification and deployment pipelines

**Files:**

- Create: `.woodpecker/verify.yml`
- Create: `.woodpecker/deploy.yml`
- Delete: `.buildkite/pipeline.yml`
- Test: `tooling/quality/woodpecker-template-pipeline.test.mts`

**Interfaces:**

- Consumes: Woodpecker PR/manual/deployment events and repository secrets.
- Produces: `ci/woodpecker/pr/verify`, staging deployment, and production
  deployment pipelines.

- [ ] **Step 1: Add verification pipeline**

Use the pinned Maestro Woodpecker git and Node images, `platform: linux/amd64`,
`role: maestro-ci`, non-draft PR/manual conditions, and:

```yaml
steps:
  - name: trusted-ci-policy
    commands:
      - tooling/ci/ci-self-protection.sh
    failure: cancel
  - name: verify
    commands:
      - tooling/ci/phase1.sh
    depends_on:
      - trusted-ci-policy
    failure: cancel
```

- [ ] **Step 2: Add target-isolated deployment pipeline**

Map staging and production secrets into distinct uppercase variables. Limit each
step to its exact deployment target. Neither step receives the other
environment's deploy key.

- [ ] **Step 3: Run pipeline contract and lint**

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/woodpecker-template-pipeline.test.mts
rtk woodpecker-cli lint .woodpecker/verify.yml
rtk woodpecker-cli lint .woodpecker/deploy.yml
```

Expected: contract passes and both pipeline documents lint successfully.

- [ ] **Step 4: Commit**

```bash
rtk git add .woodpecker .buildkite/pipeline.yml tooling/quality
rtk git commit -m "feat(ci): migrate template releases to Woodpecker"
```

### Task 4: Remove stale Buildkite authority from contracts and documentation

**Files:**

- Modify: `docs/template/env-manifest.json`
- Modify: `docs/template/env-manifest.md`
- Modify: `docs/template/operations-runbook.md`
- Modify: `docs/template/delivery-story.md`
- Modify: `docs/template/delivery-receipts.md`
- Modify: `docs/template/contributor-guide.md`
- Modify: `docs/template/app-idea-funnel-launch-audit.md`
- Modify: `docs/template/system-decisions/deployment-authority.md`
- Modify: relevant tests under `tooling/quality/`

**Interfaces:**

- Consumes: the native Woodpecker contract from Tasks 1–3.
- Produces: an environment manifest and operator runbook that name Woodpecker as
  current authority while retaining historical Buildkite receipts only when
  explicitly labeled historical.

- [ ] **Step 1: Add a failing stale-authority scan**

Require active runbooks and environment entries to contain `WOODPECKER_SERVER`
and `WOODPECKER_API_TOKEN`, and reject present-tense claims that Buildkite runs
or promotes this repository.

- [ ] **Step 2: Run RED**

Run:
`rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/env-manifest.test.mts tooling/quality/woodpecker-template-pipeline.test.mts`

Expected: FAIL on stale active Buildkite language.

- [ ] **Step 3: Update manifests and runbooks**

Document `https://ci.maestrogtm.com`,
`modernagencysales/maestro-template-saas-ui`, repository-scoped deployment
secrets, deployment events, artifact/log retrieval, and the accepted-staging-SHA
boundary. Preserve historical records as historical evidence only.

- [ ] **Step 4: Run GREEN and formatting**

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/env-manifest.test.mts tooling/quality/woodpecker-template-pipeline.test.mts
rtk prettier --check docs/template tooling/quality
rtk git diff --check
```

- [ ] **Step 5: Commit**

```bash
rtk git add docs/template tooling/quality
rtk git commit -m "docs(ci): make Woodpecker the release authority"
```

### Task 5: Bind real provider identities and durable secrets

**Files:**

- Modify if validated identities require it: `project.config.json`
- Modify if public bindings change: `scripts/_project-config.test.mjs`
- External: Hermes Bitwarden Secrets Manager project
- External: Woodpecker repository `modernagencysales/maestro-template-saas-ui`

**Interfaces:**

- Consumes: authenticated Convex account, existing production key prefix
  `prod:exciting-cat-536`, Cloudflare account and Pages projects, and
  `WOODPECKER_API_TOKEN`.
- Produces: twelve Bitwarden bindings and matching Woodpecker deployment-event
  secrets, without logging values.

- [ ] **Step 1: Inspect authenticated Convex projects and validate production
      ownership**

Use Convex project/deployment listing commands. Confirm the production URL
identity matches `exciting-cat-536` and the stored key's public prefix.

- [ ] **Step 2: Create or adopt isolated staging**

Create/adopt a staging deployment with a different identity, generate its deploy
key, and verify deployment/URL/key-prefix agreement using
`scripts/_project-config.mjs`.

- [ ] **Step 3: Write twelve Bitwarden records without emitting values**

Use `bws secret create`/`edit --output none` through the existing service
account. Add the six coordinates and six credential records defined in the
design.

- [ ] **Step 4: Activate and configure Woodpecker**

Synchronize forge repositories, add the template repository, then stream each
Bitwarden-loaded value directly into `woodpecker-cli repo secret add/update`.
Restrict credential secrets to deployment events.

- [ ] **Step 5: Verify names and identities only**

```bash
rtk headless-bws-env check TEMPLATE_STAGING_CONVEX_DEPLOYMENT TEMPLATE_STAGING_CONVEX_URL TEMPLATE_STAGING_HOSTED_URL TEMPLATE_STAGING_CONVEX_DEPLOY_KEY TEMPLATE_STAGING_CLOUDFLARE_API_TOKEN TEMPLATE_STAGING_CLOUDFLARE_ACCOUNT_ID TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT TEMPLATE_PRODUCTION_CONVEX_URL TEMPLATE_PRODUCTION_HOSTED_URL TEMPLATE_PRODUCTION_CONVEX_DEPLOY_KEY TEMPLATE_PRODUCTION_CLOUDFLARE_API_TOKEN TEMPLATE_PRODUCTION_CLOUDFLARE_ACCOUNT_ID
```

List Woodpecker secret names only and run both project-config identity
assertions. No command prints values.

- [ ] **Step 6: Commit public configuration changes, if any**

```bash
rtk git add project.config.json scripts/_project-config.test.mjs
rtk git commit -m "config: bind isolated funnel deployments"
```

### Task 6: Focused verification, PR, and merge

**Files:**

- Verify all changed files.
- Update: `docs/template/app-idea-funnel-launch-audit.md` with current evidence.

**Interfaces:**

- Consumes: complete branch and provisioned secret names.
- Produces: reviewed, merged Woodpecker migration.

- [ ] **Step 1: Run focused migration gates**

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-deploy-authority.test.mts tooling/quality/check-deploy-authority-receipt.test.mts tooling/quality/woodpecker-template-pipeline.test.mts scripts/_project-config.test.mjs
rtk host-test-slot --class focused pnpm check:deploy-authority
rtk woodpecker-cli lint .woodpecker/verify.yml
rtk woodpecker-cli lint .woodpecker/deploy.yml
rtk prettier --check .woodpecker tooling/ci tooling/quality docs/template
rtk git diff --check
```

- [ ] **Step 2: Run the full repository gate through the semaphore**

Run: `rtk host-test-slot --class full pnpm verify`

Expected: exit zero without weakening or excluding deployment gates.

- [ ] **Step 3: Push and open the migration PR**

Push `feat/woodpecker-template-deployment`, create the PR with design/plan links
and exact verification evidence, and observe the current-head GitHub and
Woodpecker checks.

- [ ] **Step 4: Repair only concrete current-head findings and merge**

Use focused TDD for any failure. Do not manufacture no-op commits for canceled
orchestration runs. Merge only after required checks and conversations are
green.

### Task 7: Deploy staging, promote production, and prove the funnel

**Files:**

- External: Woodpecker pipeline and artifacts.
- Update after proof: `docs/template/app-idea-funnel-launch-audit.md`

**Interfaces:**

- Consumes: merged exact main SHA, configured repository secrets, and promotion
  authority.
- Produces: live staging/production deployments and evidence-linked receipts.

- [ ] **Step 1: Launch staging deployment for exact main SHA**

Use `woodpecker-cli pipeline deploy` with target `staging`. Record the pipeline
number and commit without recording secrets.

- [ ] **Step 2: Monitor every staging boundary**

Require authority preflight, Convex deploy, seed, backend canary, exact-URL web
build, Pages deploy, HTTP smoke, functional browser, accessibility, visual
proof, and receipt creation.

- [ ] **Step 3: Verify staging live pages**

Run the app-idea functional, accessibility, and visual Playwright suites against
`https://maestro-template-staging.pages.dev`; confirm `/`, `/evaluate`,
`/library`, `/support`, `/privacy`, and `/terms` render the funnel shell.

- [ ] **Step 4: Launch production for the exact accepted staged SHA**

Only after staging passes, create a production deployment event for the same
SHA. Monitor the same ordered provider and canary boundaries.

- [ ] **Step 5: Verify production and capture final pages**

Run the focused hosted suites against `https://maestro-template.pages.dev`,
confirm Cloudflare's latest deployment commit equals the accepted SHA, and
capture landing, report, Build Pack, and Maestro-offer screenshots.

- [ ] **Step 6: Commit and merge the final audit evidence**

Record pipeline URLs/numbers, commit SHA, receipt identifiers, test counts,
hosted URLs, and deployment timestamps without private content or credential
material. Push a documentation-only PR and merge after its required check.
