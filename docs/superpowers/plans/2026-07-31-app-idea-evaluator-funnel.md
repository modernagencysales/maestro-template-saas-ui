# App Idea Evaluator Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete public app-idea evaluation funnel from free
constructive evaluation through paid Build Pack generation and honest Maestro
handoff.

**Architecture:** Keep the deterministic evaluation rubric in a focused pure
TypeScript package, persist public-funnel state through new Confect/Convex
groups, and expose a separate TanStack Start public shell. Reuse the existing
OpenRouter, Dodo, MailerSend, PostHog, billing-ledger, receipt, and generator
seams; free and premium model policies remain separately configurable and every
paid stage is checkpointed and entitlement-gated.

**Tech Stack:** TypeScript 5.9, Effect Schema/Effect, Confect v9, Convex 1.42,
TanStack Start/Router, React 19, Chakra UI 3, Saas UI, Vitest, Playwright,
OpenRouter-compatible LLM gateway, Dodo, MailerSend, PostHog.

## Global Constraints

- Preserve the exact approved product language in
  `docs/design-intake/2026-07-31-app-idea-evaluator-language-bank.md`.
- Free means a useful unblurred verdict and Buildability Report; paid means the
  Complete Build Pack.
- The first Build Pack payment creates an equal Maestro credit.
- Free model calls have strict call, token, retry, per-evaluation, and daily
  spend ceilings.
- Paid generation starts only after a verified, active entitlement.
- Public funnel routes use a separate shell from the internal workspace sidebar.
- Idea, answer, report, prompt, model-output, email, and payment contents never
  enter analytics payloads.
- All model output is untrusted and must decode through Effect Schema before
  persistence.
- Dodo return URLs never grant entitlement; only verified idempotent webhooks
  do.
- Frontend work includes loading, empty, ready/read, ready/edit, skipped,
  mutation success/failure, typed error, and transport error states where
  applicable.
- All broad local verification runs through `host-test-slot --class full`;
  focused suites use `host-test-slot --class focused`.
- Do not run `check-generators` or `just verify` as a Fabro/local preflight
  because they include live Convex generator requirements; run individual
  focused gates and defer the full generator-connected gate to its configured
  environment.
- Do not modify or discard unrelated dirty UI work already present in the
  original workspace.

## File And Boundary Map

- `packages/app-idea-evaluator/src/*`: pure rubric, verdict, report,
  model-policy, Build Pack, and Maestro-mapping schemas and deterministic
  functions.
- `packages/integrations/src/llm.ts`: reusable provider transport; extend only
  with explicit request pricing/policy inputs rather than product rules.
- `packages/convex/confect/evaluator/*`: evaluation commands/queries and
  ownership contracts.
- `packages/convex/confect/buildPacks/*`: entitlement-gated premium stage and
  artifact contracts.
- `packages/convex/confect/commerce/*`: checkout, purchase, webhook,
  entitlement, refund, and Maestro-credit contracts.
- `packages/convex/confect/tables/*`: one table owner per durable funnel
  concept.
- `apps/web/src/features/public-funnel/*`: public shell, landing, intake,
  report, checkout, generation, pack, library, Maestro, support, and view-model
  adapters.
- `apps/web/src/routes/*`: thin route boundaries only.
- `apps/web/src/providers/*`: consented analytics and public-session context.
- `tests/e2e/app-idea-funnel*.spec.ts`: cross-route browser journeys.

---

### Task 1: Deterministic Evaluation Domain

**Work package:** `pattern-instance`

**Target:** new focused workspace package `@maestro-template/app-idea-evaluator`

**Generator command:** none exists for a pure domain package; create the package
using the repo's existing package conventions and record this as the
product-specific package boundary, not template core.

**Follow-up gates:** `rtk pnpm --dir packages/app-idea-evaluator test`,
`rtk pnpm --dir packages/app-idea-evaluator typecheck`,
`rtk prettier --check packages/app-idea-evaluator`

**Files:**

- Create: `packages/app-idea-evaluator/package.json`
- Create: `packages/app-idea-evaluator/tsconfig.json`
- Create: `packages/app-idea-evaluator/src/schemas.ts`
- Create: `packages/app-idea-evaluator/src/rubric.ts`
- Create: `packages/app-idea-evaluator/src/verdict.ts`
- Create: `packages/app-idea-evaluator/src/report.ts`
- Create: `packages/app-idea-evaluator/src/index.ts`
- Test: `packages/app-idea-evaluator/src/rubric.test.ts`
- Test: `packages/app-idea-evaluator/src/verdict.test.ts`
- Test: `packages/app-idea-evaluator/src/report.test.ts`

**Interfaces:**

- Produces: `EvaluationInput`, `DimensionKey`, `DimensionScore`,
  `EvaluationResult`, `EvaluationVerdict`, `BuildabilityReport`,
  `scoreEvaluation(input)`, `selectVerdict(scores)`, `buildFreeReport(result)`.
- Consumes: Effect Schema only; no browser, Convex, provider, or payment
  imports.

- [ ] **Step 1: Write failing rubric and verdict tests**

```ts
it("selects good-product-unclear-distribution from the score pattern", () => {
  const result = scoreEvaluation(fixtureInput({ distributionEvidence: [] }));
  expect(result.verdict).toBe("good-product-unclear-distribution");
  expect(result.dimensions.distribution.score).toBeLessThan(40);
});

it("never publishes a score without supporting answer ids", () => {
  expect(() =>
    DimensionScore.make({ score: 80, confidence: 0.9, evidenceAnswerIds: [] }),
  ).toThrow();
});
```

- [ ] **Step 2: Run the focused suite and confirm the missing-package failure**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator test`

Expected: FAIL because the package and exported functions do not exist.

- [ ] **Step 3: Implement schemas, deterministic weights, verdict rules, and
      report projection**

```ts
export const dimensionWeights = {
  customerSpecificity: 0.1,
  problemSeverity: 0.12,
  problemFrequency: 0.08,
  existingEffortOrSpend: 0.08,
  solutionClarity: 0.1,
  differentiation: 0.1,
  feasibility: 0.12,
  distribution: 0.12,
  monetization: 0.08,
  founderAdvantage: 0.05,
  operationalRisk: 0.03,
  maestroFit: 0.02,
} as const satisfies Record<DimensionKey, number>;

export const selectVerdict = (
  dimensions: Readonly<Record<DimensionKey, DimensionScore>>,
): EvaluationVerdict => {
  if (dimensions.feasibility.score < 30) return "too-expensive-for-version-one";
  if (
    dimensions.problemSeverity.score >= 65 &&
    dimensions.solutionClarity.score < 45
  )
    return "strong-problem-weak-solution";
  if (
    dimensions.distribution.score < 40 &&
    dimensions.solutionClarity.score >= 60
  )
    return "good-product-unclear-distribution";
  if (dimensions.customerSpecificity.score < 35)
    return "needs-a-different-customer";
  return weightedScore(dimensions) >= 70
    ? "worth-testing"
    : "promising-but-blurry";
};
```

- [ ] **Step 4: Run package tests, typecheck, and formatting**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator test && rtk pnpm --dir packages/app-idea-evaluator typecheck && rtk prettier --check packages/app-idea-evaluator`

Expected: PASS with rubric-boundary, evidence, verdict, and report fixtures
green.

- [ ] **Step 5: Commit the domain package**

```bash
rtk git add packages/app-idea-evaluator
rtk git commit -m "feat: add app idea evaluation domain"
```

### Task 2: Tiered Model Policy And Structured Outputs

**Work package:** `fixture-to-real`

**Target:** existing OpenRouter-compatible LLM gateway and spend seams

**Follow-up gates:** `rtk pnpm --dir packages/integrations test llm spend`,
evaluator package tests, env-boundary and provider-boundary checks

**Files:**

- Modify: `packages/integrations/src/llm.ts`
- Modify: `packages/integrations/src/spend.ts`
- Modify: `packages/integrations/src/llm.test.ts`
- Modify: `packages/integrations/src/spend.test.ts`
- Create: `packages/app-idea-evaluator/src/modelPolicy.ts`
- Create: `packages/app-idea-evaluator/src/modelPolicy.test.ts`
- Modify: `.env.example`
- Modify: `docs/template/env-manifest.json`
- Modify: `docs/template/env-manifest.md`

**Interfaces:**

- Produces: `LlmPricing`, `LlmCallLimits`, request-scoped `pricing` and
  `limits`, `FREE_MODEL_POLICY`, `PREMIUM_MODEL_POLICY`, and schemas for
  structured extraction/evaluation output.
- Consumes: existing `createLlmGateway`, spend-cap validation, receipt creation,
  and redaction.

- [ ] **Step 1: Write failing policy and spend tests**

```ts
it("caps free evaluation before provider transport", async () => {
  const policy = freeModelPolicy({ maxCalls: 3, maxInputTokens: 3_000 });
  expect(policy.authorize({ callsUsed: 3, inputTokens: 100 })).toEqual({
    allowed: false,
    reason: "call-limit",
  });
});

it("prices a request from request-scoped rates", () => {
  expect(
    calculateLlmSpend({
      promptTokens: 1_000,
      completionTokens: 500,
      inputCentsPerMillionTokens: 10,
      outputCentsPerMillionTokens: 40,
      minimumCents: 0,
    }),
  ).toMatchObject({ estimatedCents: 0.03 });
});
```

- [ ] **Step 2: Verify the tests fail against hard-coded gateway pricing**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/integrations test llm spend && rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator test modelPolicy`

Expected: FAIL because request-scoped policies are absent.

- [ ] **Step 3: Implement explicit tier policy without embedding product rules
      in the gateway**

```ts
export type LlmGatewayRequest = {
  readonly workspaceSlug: string;
  readonly prompt: string;
  readonly model?: string;
  readonly pricing?: LlmPricing;
  readonly limits?: LlmCallLimits;
  readonly expectedCompletionTokens?: number;
  readonly currentDailySpendCents?: number;
};

export const FREE_MODEL_POLICY = ModelPolicy.make({
  modelEnv: "LLM_FREE_MODEL",
  maxCalls: 5,
  maxInputTokens: 12_000,
  maxOutputTokens: 3_000,
  maxRepairAttempts: 1,
  allowResearch: false,
});
```

- [ ] **Step 4: Add and validate `LLM_FREE_MODEL`, `LLM_PREMIUM_MODEL`, and tier
      spend limits in the manifest**

Run:
`rtk pnpm check:env-boundary && rtk pnpm check:provider-boundary && rtk pnpm check:config-drift`

Expected: PASS and no client-bundle exposure of server-only model configuration.

- [ ] **Step 5: Commit model policy support**

```bash
rtk git add packages/integrations packages/app-idea-evaluator .env.example docs/template/env-manifest.json docs/template/env-manifest.md
rtk git commit -m "feat: add tiered model policies"
```

### Task 3: Evaluation Persistence And Confect Contracts

**Work package:** `pattern-instance`

**Target:** evaluation domain and durable tables

**Generator command:**
`rtk pnpm template:add-client-domain -- --name evaluator --write`

**Follow-up gates:** `rtk pnpm confect:manifest`, focused Convex evaluator
tests, Confect contract and schema-migration-note checks

**Files:**

- Create: `packages/convex/confect/evaluator/sessions.spec.ts`
- Create: `packages/convex/confect/evaluator/sessions.impl.ts`
- Create: `packages/convex/confect/evaluator/reports.spec.ts`
- Create: `packages/convex/confect/evaluator/reports.impl.ts`
- Create: `packages/convex/confect/tables/evaluationSessions.ts`
- Create: `packages/convex/confect/tables/evaluationAnswers.ts`
- Create: `packages/convex/confect/tables/evaluationReports.ts`
- Create: `packages/convex/confect/tables/evaluationReportVersions.ts`
- Modify: `packages/convex/confect/schema.ts`
- Modify: `packages/convex/confect/spec.ts`
- Test: `packages/convex/test/evaluator-sessions.test.ts`
- Test: `packages/convex/test/evaluator-reports.test.ts`
- Create: `docs/template/migrations/2026-07-31-app-idea-evaluator.md`

**Interfaces:**

- Produces Confect operations: `evaluator.sessions.start`, `saveAnswer`, `get`,
  `complete`; `evaluator.reports.generate`, `get`, `revise`.
- Consumes evaluator schemas and deterministic scoring from Task 1; model policy
  from Task 2.

- [ ] **Step 1: Generate the client-domain scaffold and inspect the emitted
      files**

Run: `rtk pnpm template:add-client-domain -- --name evaluator --write`

Expected: gate-correct client-domain scaffold; retain generated provenance and
replace generic names only within this domain.

- [ ] **Step 2: Write failing session state-machine and revision-version tests**

```ts
it("rejects completing a session without required evidence", async () => {
  await expect(
    run("evaluator.sessions.complete", { sessionId }),
  ).rejects.toMatchObject({
    _tag: "EvaluationIncomplete",
    missingDimensions: expect.arrayContaining(["customerSpecificity"]),
  });
});

it("revises by appending a report version", async () => {
  const revised = await reviseReport({
    reportId,
    answerId,
    value: "Dental groups",
  });
  expect(revised.version).toBe(2);
  expect(await reportVersionCount(reportId)).toBe(2);
});
```

- [ ] **Step 3: Implement tables, typed errors, authorization-by-opaque-session,
      and idempotent transitions**

```ts
export class EvaluationIncomplete extends S.TaggedError<EvaluationIncomplete>()(
  "EvaluationIncomplete",
  { missingDimensions: S.Array(DimensionKey) },
) {}

export const EvaluationStatus = S.Literal(
  "draft",
  "collecting",
  "ready-to-evaluate",
  "evaluating",
  "completed",
  "failed-recoverable",
  "revising",
);
```

- [ ] **Step 4: Regenerate Confect metadata and run focused gates**

Run:
`rtk pnpm confect:manifest && rtk host-test-slot --class focused pnpm --dir packages/convex test evaluator && rtk pnpm check:confect-contracts && rtk pnpm check:schema-migration-notes`

Expected: PASS with generated manifest diff committed and no raw provider
payloads stored.

- [ ] **Step 5: Commit evaluation persistence**

```bash
rtk git add packages/convex docs/template/migrations
rtk git commit -m "feat: persist app idea evaluations"
```

### Task 4: Public Shell, Landing Page, And Route Boundary

**Work package:** `pattern-instance`

**Target:** public acquisition surface

**Generator command:** no public-funnel route generator exists; use the
documented TanStack route and Saas UI page patterns. Record public-route
generation as a template-gap only if it recurs in another fork.

**Follow-up gates:** web focused tests, route-tree check, frontend boundary,
accessibility browser smoke

**Files:**

- Create: `apps/web/src/features/public-funnel/public-shell.tsx`
- Create: `apps/web/src/features/public-funnel/landing.tsx`
- Create: `apps/web/src/features/public-funnel/landing.test.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/privacy.tsx`
- Create: `apps/web/src/routes/terms.tsx`
- Create: `apps/web/src/routes/support.tsx`
- Modify generated: `apps/web/src/routeTree.gen.ts`

**Interfaces:**

- Produces: `PublicFunnelShell`, `AppIdeaLanding`, public header/footer, and `/`
  acquisition route.
- Consumes approved copy only; no backend or provider imports.

- [ ] **Step 1: Write failing static-render and boundary tests**

```ts
it("renders the approved promise and primary action", () => {
  const html = renderPublic(<AppIdeaLanding />);
  expect(html).toContain("Tell me if your app idea is good.");
  expect(html).toContain("Know what it will take to build it.");
  expect(html).toContain("Roast my app idea");
  expect(html).not.toContain("Revenue workspace");
});
```

- [ ] **Step 2: Verify the current dashboard route fails the acquisition test**

Run: `rtk host-test-slot --class focused pnpm --dir apps/web test landing`

Expected: FAIL because `/` still renders `BusinessDashboardRoute`.

- [ ] **Step 3: Implement the responsive, accessible public shell and landing
      page**

```tsx
export function AppIdeaLanding() {
  return (
    <PublicFunnelShell>
      <main id="main-content">
        <Heading as="h1">Tell me if your app idea is good.</Heading>
        <Text>Know what it will take to build it.</Text>
        <Button asChild>
          <Link to="/evaluate">Roast my app idea</Link>
        </Button>
      </main>
    </PublicFunnelShell>
  );
}
```

- [ ] **Step 4: Generate the route tree and run route/frontend checks**

Run:
`rtk pnpm --dir apps/web build && rtk pnpm check:route-tree && rtk pnpm check:frontend-effect-boundary`

Expected: PASS with `/` mapped to the public landing and internal workspace
routes still reachable.

- [ ] **Step 5: Commit the public acquisition shell**

```bash
rtk git add apps/web/src/features/public-funnel apps/web/src/routes apps/web/src/routeTree.gen.ts
rtk git commit -m "feat: add app idea funnel landing"
```

### Task 5: Guided Intake And Free Evaluation UI

**Work package:** `pattern-instance`

**Target:** adaptive evaluation conversation

**Generator command:**
`rtk pnpm template:add-capability -- --name evaluateAppIdea --write`

**Follow-up gates:** capability tests, Confect manifest, web intake tests,
route-tree, accessible form tests

**Files:**

- Create via generator: `packages/convex/confect/capabilities/evaluateAppIdea.*`
- Create: `apps/web/src/features/public-funnel/intake/intake-state.ts`
- Create: `apps/web/src/features/public-funnel/intake/intake-presenter.ts`
- Create: `apps/web/src/features/public-funnel/intake/intake-view.tsx`
- Test: `apps/web/src/features/public-funnel/intake/intake-*.test.ts*`
- Create: `apps/web/src/routes/evaluate.tsx`
- Create: `apps/web/src/routes/evaluate.$evaluationId.tsx`
- Modify generated: `apps/web/src/routeTree.gen.ts`

**Interfaces:**

- Produces adaptive question view model, session resume, answer mutation,
  evaluation start, and progress announcement.
- Consumes Task 3 Confect refs and Task 1 required-dimension metadata.

- [ ] **Step 1: Generate the capability scaffold**

Run: `rtk pnpm template:add-capability -- --name evaluateAppIdea --write`

Expected: flat Confect spec/impl/domain/test/headless files plus provenance.

- [ ] **Step 2: Write failing UI state tests for loading, empty, ready/read,
      ready/edit, and failure**

```ts
it.each([
  "loading",
  "empty",
  "ready-read",
  "ready-edit",
  "saving",
  "error",
] as const)("renders %s intake state", (state) => {
  expect(renderIntake(fixtureIntake(state))).toMatchSnapshot();
});

it("announces progress after a saved answer", () => {
  expect(presentIntake(savedFixture).announcement).toBe(
    "Question 3 of 7 saved",
  );
});
```

- [ ] **Step 3: Implement the adapter, one-question form, back/edit behavior,
      and bounded evaluation action**

```ts
export type IntakeViewState =
  | { readonly _tag: "loading" }
  | {
      readonly _tag: "question";
      readonly question: IntakeQuestion;
      readonly progress: number;
    }
  | { readonly _tag: "saving"; readonly question: IntakeQuestion }
  | { readonly _tag: "evaluating" }
  | {
      readonly _tag: "error";
      readonly message: string;
      readonly canRetry: boolean;
    };
```

- [ ] **Step 4: Regenerate refs/manifest and run focused backend/web tests**

Run:
`rtk pnpm confect:manifest && rtk host-test-slot --class focused pnpm --dir packages/convex test evaluateAppIdea && rtk host-test-slot --class focused pnpm --dir apps/web test intake`

Expected: PASS including preserved answers after transport failure.

- [ ] **Step 5: Commit guided intake**

```bash
rtk git add packages/convex apps/web/src/features/public-funnel/intake apps/web/src/routes apps/web/src/routeTree.gen.ts docs/template/generated
rtk git commit -m "feat: add guided app idea evaluation"
```

### Task 6: Free Report, Email Ownership, Sharing, And Library

**Work package:** `pattern-instance`

**Target:** durable free report lifecycle

**Generator command:**
`rtk pnpm template:add-capability -- --name manageEvaluationReport --write`

**Follow-up gates:** focused evaluator/notification/web tests, secret canaries,
accessibility smoke

**Files:**

- Create: `packages/convex/confect/evaluator/ownership.spec.ts`
- Create: `packages/convex/confect/evaluator/ownership.impl.ts`
- Create: `packages/convex/confect/evaluator/sharing.spec.ts`
- Create: `packages/convex/confect/evaluator/sharing.impl.ts`
- Create: `packages/convex/confect/tables/emailVerificationChallenges.ts`
- Create: `packages/convex/confect/tables/reportOwnerships.ts`
- Create: `packages/convex/confect/tables/reportShareSnapshots.ts`
- Create: `apps/web/src/features/public-funnel/report/*`
- Create: `apps/web/src/features/public-funnel/library/*`
- Create: `apps/web/src/routes/report.$reportId.tsx`
- Create: `apps/web/src/routes/share.$shareToken.tsx`
- Create: `apps/web/src/routes/library.tsx`

**Interfaces:**

- Produces verification challenge issue/consume, ownership claim, versioned
  revision, redacted snapshot create/revoke, Markdown export, and library query.
- Consumes MailerSend fake-first notification service and Task 3 reports.

- [ ] **Step 1: Write failing single-use verification and redaction tests**

```ts
it("consumes a verification challenge exactly once", async () => {
  expect(await consume(challenge.token)).toMatchObject({ claimed: true });
  await expect(consume(challenge.token)).rejects.toMatchObject({
    _tag: "ChallengeConsumed",
  });
});

it("share snapshots exclude private fields", () => {
  const json = JSON.stringify(createShareSnapshot(privateReport));
  for (const secret of [
    "email",
    "answerText",
    "prompt",
    "modelOutput",
    "paymentId",
  ])
    expect(json).not.toContain(secret);
});
```

- [ ] **Step 2: Implement ownership, share snapshots, report UI states, and
      deterministic export**

```ts
export const PublicReportSnapshot = S.Struct({
  reportId: S.String,
  verdict: EvaluationVerdict,
  overallScore: S.Number,
  roast: S.String,
  strongestElement: S.String,
  biggestWeakness: S.String,
  improvedIdea: S.String,
});
```

- [ ] **Step 3: Run focused tests and secret/privacy gates**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/convex test evaluator && rtk host-test-slot --class focused pnpm --dir apps/web test report library && rtk pnpm check:secret-canaries`

Expected: PASS with no private field in share or analytics fixtures.

- [ ] **Step 4: Commit the free report lifecycle**

```bash
rtk git add packages/convex apps/web/src/features/public-funnel apps/web/src/routes apps/web/src/routeTree.gen.ts
rtk git commit -m "feat: add saved and shareable idea reports"
```

### Task 7: Dodo Checkout, Purchase, Entitlement, And Maestro Credit

**Work package:** `fixture-to-real`

**Target:** Dodo provider seam and `ops/billing` contract fixtures

**Follow-up gates:** integrations Dodo/billing tests, Convex commerce tests,
provider/env/secret gates

**Files:**

- Modify: `packages/integrations/src/dodo.ts`
- Modify: `packages/integrations/src/billing.ts`
- Create: `packages/convex/confect/commerce/checkout.spec.ts`
- Create: `packages/convex/confect/commerce/checkout.impl.ts`
- Create: `packages/convex/confect/commerce/webhooks.spec.ts`
- Create: `packages/convex/confect/commerce/webhooks.impl.ts`
- Create: `packages/convex/confect/tables/checkoutSessions.ts`
- Create: `packages/convex/confect/tables/purchases.ts`
- Create: `packages/convex/confect/tables/buildPackEntitlements.ts`
- Create: `packages/convex/confect/tables/maestroCredits.ts`
- Create: `apps/web/src/features/public-funnel/checkout/*`
- Create: `apps/web/src/routes/checkout.$reportId.tsx`
- Create: `apps/web/src/routes/checkout.return.tsx`

**Interfaces:**

- Produces server checkout creation, signed webhook application, payment-pending
  query, active entitlement, refund/dispute transition, and equal Maestro
  credit.
- Consumes verified report ownership and existing billing idempotency/ledger
  services.

- [ ] **Step 1: Write adversarial commerce tests**

```ts
it("does not grant from a checkout return", async () => {
  await checkoutReturn({ sessionId: "checkout_1" });
  expect(await entitlementFor(reportId)).toBeNull();
});

it("grants one entitlement and equal Maestro credit for duplicate webhooks", async () => {
  await applySignedWebhook(paidEvent);
  await applySignedWebhook(paidEvent);
  expect(await entitlementCount(reportId)).toBe(1);
  expect(await maestroCredit(reportId)).toBe(paidEvent.eligibleAmountCents);
});
```

- [ ] **Step 2: Implement live-ready transport, signature verification,
      idempotent mutations, and pending recovery**

```ts
export type BuildPackEntitlement = {
  readonly reportId: string;
  readonly purchaseId: string;
  readonly status: "active" | "revoked";
  readonly generationAttempts: number;
};
```

- [ ] **Step 3: Run focused commerce and provider gates**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/integrations test dodo billing && rtk host-test-slot --class focused pnpm --dir packages/convex test commerce billing && rtk pnpm check:provider-boundary && rtk pnpm check:env-boundary && rtk pnpm check:secret-canaries`

Expected: PASS for invalid signature, duplicate, refund, dispute, delayed
webhook, and provider failure fixtures.

- [ ] **Step 4: Commit checkout and entitlement**

```bash
rtk git add packages/integrations packages/convex apps/web/src/features/public-funnel/checkout apps/web/src/routes apps/web/src/routeTree.gen.ts
rtk git commit -m "feat: sell complete build packs"
```

### Task 8: Checkpointed Premium Build Pack Pipeline

**Work package:** `pattern-instance`

**Target:** durable premium workflow and artifacts

**Generator command:**
`rtk pnpm template:add-workflow -- --name generateCompleteBuildPack --write`

**Follow-up gates:** workflow output smoke, workflow graph boundary, Build Pack
tests, Confect manifest

**Files:**

- Create via generator: Build Pack workflow spec/impl/graph/tests/docs
- Create: `packages/app-idea-evaluator/src/buildPack.ts`
- Create: `packages/app-idea-evaluator/src/buildPack.test.ts`
- Create: `packages/convex/confect/buildPacks/packs.spec.ts`
- Create: `packages/convex/confect/buildPacks/packs.impl.ts`
- Create: `packages/convex/confect/buildPacks/stages.spec.ts`
- Create: `packages/convex/confect/buildPacks/stages.impl.ts`
- Create: `packages/convex/confect/tables/buildPacks.ts`
- Create: `packages/convex/confect/tables/buildPackStages.ts`
- Create: `packages/convex/confect/tables/buildPackExports.ts`
- Test: `packages/convex/test/build-pack-pipeline.test.ts`

**Interfaces:**

- Produces `startPack`, `status`, `retryFailedStage`, `getPack`, stage schemas
  for normalize/challenge/research/design/specify/review/compile/map-to-Maestro.
- Consumes active entitlement, premium model policy, free report version, and
  receipt/cost services.

- [ ] **Step 1: Generate the durable workflow scaffold**

Run:
`rtk pnpm template:add-workflow -- --name generateCompleteBuildPack --write`

Expected: public start/status/control Confect contract plus durable replay graph
and tests.

- [ ] **Step 2: Write failing entitlement, checkpoint, retry, and citation
      tests**

```ts
it("resumes the failed stage without rerunning completed stages", async () => {
  await failStage(packId, "specify");
  await retryFailedStage({ packId });
  expect(await attempts(packId, "normalize")).toBe(1);
  expect(await attempts(packId, "specify")).toBe(2);
});

it("rejects researched claims without citations", () => {
  expect(() =>
    BuildPack.decode(
      fixturePack({
        competitorClaims: [{ text: "X is cheaper", citations: [] }],
      }),
    ),
  ).toThrow();
});
```

- [ ] **Step 3: Implement stage records, immutable completed outputs, retry
      policy, support escalation, and compiler schema**

```ts
export const BuildPackStageName = S.Literal(
  "normalize",
  "challenge",
  "research",
  "design",
  "specify",
  "review",
  "compile",
  "map-to-maestro",
);

export const BuildPackStageStatus = S.Literal(
  "queued",
  "running",
  "completed",
  "failed-recoverable",
  "needs-support",
);
```

- [ ] **Step 4: Run workflow and focused pipeline gates**

Run:
`rtk pnpm confect:manifest && rtk host-test-slot --class focused pnpm --dir packages/convex test build-pack && rtk host-test-slot --class focused pnpm template:workflow-output-smoke && rtk pnpm check:workflow-graph-boundary`

Expected: PASS with deterministic fake-mode completion and resumable failure
fixture.

- [ ] **Step 5: Commit premium generation**

```bash
rtk git add packages/app-idea-evaluator packages/convex docs/template/generated
rtk git commit -m "feat: generate complete build packs"
```

### Task 9: Build Pack Viewer, Progress, Versioning, And Exports

**Work package:** `pattern-instance`

**Target:** paid artifact experience

**Follow-up gates:** web Build Pack tests, static smoke, accessibility and
visual browser tests

**Files:**

- Create:
  `apps/web/src/features/public-funnel/build-pack/build-pack-presenter.ts`
- Create:
  `apps/web/src/features/public-funnel/build-pack/build-pack-progress.tsx`
- Create: `apps/web/src/features/public-funnel/build-pack/build-pack-view.tsx`
- Create: `apps/web/src/features/public-funnel/build-pack/build-pack-export.ts`
- Test: `apps/web/src/features/public-funnel/build-pack/*.test.ts*`
- Create: `apps/web/src/routes/build-pack.$packId.generating.tsx`
- Create: `apps/web/src/routes/build-pack.$packId.tsx`

**Interfaces:**

- Produces checkpoint progress, readable section viewer, version chooser,
  Markdown and print HTML exports.
- Consumes canonical stored Build Pack only; export performs no model call.

- [ ] **Step 1: Write failing state and export-parity tests**

```ts
it("shows completed stages while a later stage retries", () => {
  const html = renderPackProgress(
    fixturePackStatus("specify", "failed-recoverable"),
  );
  expect(html).toContain("Product brief complete");
  expect(html).toContain("Retry requirements stage");
});

it("exports the same canonical section ids as the web viewer", () => {
  expect(exportSectionIds(pack)).toEqual(viewSectionIds(pack));
});
```

- [ ] **Step 2: Implement progress, ready/read, version, export, failure, and
      support states**

```ts
export type BuildPackViewState =
  | { readonly _tag: "generating"; readonly stages: readonly StageProgress[] }
  | { readonly _tag: "ready"; readonly pack: CompleteBuildPack }
  | {
      readonly _tag: "failed";
      readonly canRetry: boolean;
      readonly supportId?: string;
    }
  | { readonly _tag: "revoked" };
```

- [ ] **Step 3: Run focused web and browser checks**

Run:
`rtk host-test-slot --class focused pnpm --dir apps/web test build-pack && rtk pnpm smoke:web-static && rtk host-test-slot --class focused pnpm exec playwright test tests/e2e/app-idea-build-pack.accessibility.spec.ts`

Expected: PASS at desktop and narrow viewport with keyboard-readable progress.

- [ ] **Step 4: Commit the Build Pack experience**

```bash
rtk git add apps/web/src/features/public-funnel/build-pack apps/web/src/routes apps/web/src/routeTree.gen.ts tests/e2e
rtk git commit -m "feat: add complete build pack experience"
```

### Task 10: Honest Maestro Mapping And Offer

**Work package:** `pattern-instance`

**Target:** evaluator-to-template mapping

**Generator command:** reuse existing generator catalog programmatically; do not
create a parallel generator registry.

**Follow-up gates:** evaluator mapping tests, generator catalog tests,
stack-plan validation, web Maestro tests

**Files:**

- Create: `packages/app-idea-evaluator/src/maestroMapping.ts`
- Test: `packages/app-idea-evaluator/src/maestroMapping.test.ts`
- Create: `packages/convex/confect/buildPacks/maestro.spec.ts`
- Create: `packages/convex/confect/buildPacks/maestro.impl.ts`
- Create: `apps/web/src/features/public-funnel/maestro/maestro-offer.tsx`
- Create: `apps/web/src/features/public-funnel/maestro/maestro-offer.test.tsx`
- Create: `apps/web/src/routes/maestro.$packId.tsx`

**Interfaces:**

- Produces template-fit score, implemented blueprint choice, domain nouns,
  capability/workflow/provider mapping, work packages, gates, gaps, credit, and
  handoff prompt.
- Consumes generator catalog status, Build Pack, purchase credit, and planning
  vocabulary.

- [ ] **Step 1: Write failing implemented/planned blueprint and low-fit
      recommendation tests**

```ts
it("never recommends a planned blueprint as executable", () => {
  const mapping = mapToMaestro(fixturePack("implementation-consulting-brain"));
  expect(mapping.blueprint.status).toBe("planned");
  expect(mapping.primaryAction).not.toBe("start-building");
});

it("requires backlog and resolution path for template gaps", () => {
  expect(() =>
    WorkPackage.decode({ kind: "template-gap", target: "native mobile" }),
  ).toThrow();
});
```

- [ ] **Step 2: Implement mapping against the existing catalog and validate
      generated work packages**

```ts
export const WorkPackage = S.Union(
  S.Struct({
    kind: S.Literal("pattern-instance"),
    target: S.String,
    generatorCommand: S.String,
    followUpGates: S.NonEmptyArray(S.String),
  }),
  S.Struct({
    kind: S.Literal("fixture-to-real"),
    target: S.String,
    persistenceOrProviderBoundary: S.String,
    followUpGates: S.NonEmptyArray(S.String),
  }),
  S.Struct({
    kind: S.Literal("template-gap"),
    target: S.String,
    templateBacklogRef: S.String,
    templateResolutionPath: S.String,
    followUpGates: S.NonEmptyArray(S.String),
  }),
);
```

- [ ] **Step 3: Run mapping, generator, stack-plan, and web tests**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator test maestroMapping && rtk host-test-slot --class focused pnpm --dir tooling/generators test && rtk pnpm stack:check tooling/stack/__fixtures__/plan.valid.json && rtk host-test-slot --class focused pnpm --dir apps/web test maestro-offer`

Expected: PASS with conditional offer and equal purchase credit displayed.

- [ ] **Step 4: Commit Maestro conversion**

```bash
rtk git add packages/app-idea-evaluator packages/convex apps/web/src/features/public-funnel/maestro apps/web/src/routes apps/web/src/routeTree.gen.ts
rtk git commit -m "feat: map build packs to Maestro"
```

### Task 11: Privacy-Safe Analytics, Lifecycle Email, And Support Operations

**Work package:** `fixture-to-real`

**Target:** PostHog, MailerSend, and operator-support seams

**Follow-up gates:** observability, notification, privacy, data lifecycle, and
web support tests

**Files:**

- Create: `packages/app-idea-evaluator/src/funnelEvents.ts`
- Test: `packages/app-idea-evaluator/src/funnelEvents.test.ts`
- Create: `packages/convex/confect/evaluator/lifecycle.spec.ts`
- Create: `packages/convex/confect/evaluator/lifecycle.impl.ts`
- Create: `packages/convex/confect/tables/supportIncidents.ts`
- Create: `apps/web/src/features/public-funnel/support/*`
- Modify: `apps/web/src/providers/posthog.tsx`
- Modify: `docs/template/data-lifecycle.md`
- Modify: `docs/template/env-manifest.json`

**Interfaces:**

- Produces allowlisted event schemas, transactional email intents, support
  incidents, paid-generation resume controls, deletion/share-revocation
  operations.
- Consumes existing PostHog consent, MailerSend fake mode, Build Pack status,
  and data-lifecycle contracts.

- [ ] **Step 1: Write failing analytics privacy and support-resume tests**

```ts
it.each([
  "idea",
  "answer",
  "roast",
  "prompt",
  "modelOutput",
  "email",
  "payment",
])("rejects %s content in funnel events", (field) => {
  expect(() =>
    FunnelEvent.decode({ name: "evaluation_completed", [field]: "secret" }),
  ).toThrow();
});

it("resumes a paid support incident without a new purchase", async () => {
  await resumeIncident({
    incidentId,
    operatorReason: "provider capacity restored",
  });
  expect(await purchaseCount(reportId)).toBe(1);
});
```

- [ ] **Step 2: Implement allowlisted events, lifecycle intents, support state,
      and deletion projection**

```ts
export const EvaluationCompletedEvent = S.Struct({
  name: S.Literal("evaluation_completed"),
  evaluationId: S.String,
  verdict: EvaluationVerdict,
  durationMs: S.Number,
  modelCalls: S.Number,
  estimatedCostCents: S.Number,
});
```

- [ ] **Step 3: Run focused privacy and lifecycle gates**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator test funnelEvents && rtk host-test-slot --class focused pnpm --dir packages/convex test lifecycle dataLifecycle && rtk host-test-slot --class focused pnpm --dir packages/notifications test && rtk host-test-slot --class focused pnpm --dir packages/observability test && rtk pnpm check:posthog-readiness`

Expected: PASS with fake email intents and redacted analytics.

- [ ] **Step 4: Commit operations and lifecycle**

```bash
rtk git add packages/app-idea-evaluator packages/convex apps/web/src/features/public-funnel/support apps/web/src/providers docs/template
rtk git commit -m "feat: operate the app idea funnel"
```

### Task 12: Complete Browser Journeys And Launch Audit

**Work package:** `pattern-instance`

**Target:** full-funnel acceptance evidence

**Follow-up gates:** focused Playwright journeys, accessibility, visual smoke,
package verification, full host-semaphore gate

**Files:**

- Create: `tests/e2e/app-idea-funnel.spec.ts`
- Create: `tests/e2e/app-idea-funnel.accessibility.spec.ts`
- Create: `tests/e2e/app-idea-funnel.visual.spec.ts`
- Create: `docs/template/app-idea-funnel-operations.md`
- Create: `docs/template/app-idea-funnel-launch-checklist.md`
- Modify: `docs/template/data-map.md`
- Modify: `docs/template/template-defaults.md`
- Modify: `README.md`

**Interfaces:**

- Produces authoritative end-to-end evidence and operator runbook.
- Consumes every earlier public route, fake provider mode, and deterministic
  fixture.

- [ ] **Step 1: Write the end-to-end journeys before final hardening**

```ts
test("anonymous evaluation through paid Build Pack and Maestro offer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Roast my app idea" }).click();
  await completeEvaluation(page, validIdeaFixture);
  await expect(
    page.getByText("Good product, unclear distribution"),
  ).toBeVisible();
  await verifyEmail(page, "founder@example.test");
  await purchaseBuildPackWithFakeDodo(page);
  await expect(page.getByText("Complete Build Pack")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start building with Maestro" }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Add journeys for revision, share revocation, webhook delay,
      premium retry, refund, and low-fit Maestro suppression**

Run:
`rtk host-test-slot --class focused pnpm exec playwright test tests/e2e/app-idea-funnel.spec.ts`

Expected: PASS in deterministic fake-provider mode.

- [ ] **Step 3: Run accessibility and responsive visual evidence**

Run:
`rtk host-test-slot --class focused pnpm exec playwright test tests/e2e/app-idea-funnel.accessibility.spec.ts tests/e2e/app-idea-funnel.visual.spec.ts`

Expected: PASS for landing, intake, free report, checkout, progress, Build Pack,
library, and Maestro routes at desktop and mobile projects.

- [ ] **Step 4: Run focused static and contract gates**

Run:
`rtk pnpm check:format && rtk pnpm lint && rtk pnpm typecheck && rtk host-test-slot --class focused pnpm test && rtk pnpm build && rtk pnpm check:route-tree && rtk pnpm check:frontend-effect-boundary && rtk pnpm check:env-boundary && rtk pnpm check:provider-boundary && rtk pnpm check:logging-boundary && rtk pnpm check:confect-contracts && rtk pnpm check:workflow-graph-boundary && rtk pnpm check:schema-migration-notes && rtk pnpm check:secret-canaries && rtk pnpm check:posthog-readiness`

Expected: every named gate passes. If a gate requires a live deployment
connection, record that fact and run it in the configured CI/deployment
environment rather than weakening the gate.

- [ ] **Step 5: Run the broad completion gate through the host semaphore**

Run: `rtk host-test-slot --class full pnpm verify`

Expected: PASS. Provider `402`, `429`, or usage-limit responses are recorded as
environmental blockers and are not papered over with code changes.

- [ ] **Step 6: Commit launch evidence and operations docs**

```bash
rtk git add tests/e2e docs/template README.md
rtk git commit -m "test: prove app idea funnel journeys"
```

## Completion Audit

Before declaring the funnel complete, map each design requirement to current
evidence:

- Public acquisition and separate shell: route source plus landing browser test.
- Adaptive cheap free evaluation: policy tests, actual receipts, spend ceiling,
  and complete anonymous browser journey.
- Useful free report: report fixture coverage and rendered/download parity.
- Saving, revision, sharing, and library: ownership and E2E evidence.
- Checkout and entitlement: signature/idempotency/refund tests and delayed
  webhook browser journey.
- Premium quality: all eight stage outputs, citation enforcement, checkpoint
  retry evidence, and completed Build Pack fixture.
- Maestro handoff: catalog status, work-package validation, conditional offer,
  and credit evidence.
- Privacy and operations: analytics schema rejection, secret scans, lifecycle
  docs, support-resume journey, and deletion/share-revocation evidence.
- Accessibility and responsive UI: axe, keyboard, focus, announcement, and
  narrow-width browser evidence for every public route.
- Full repository health: configured focused gates and
  `host-test-slot --class full pnpm verify` output.

No item is complete when its evidence is missing, indirect, or narrower than the
requirement.
