/**
 * RuleTester coverage for every rule in @maestro-template/eslint-plugin-template.
 * Filenames below mirror this repo's layout: packages/convex/confect/** for the
 * backend and apps/web/src/** for the frontend. Rules that guard conventions
 * not present in the repo yet (workspace* builders, defineWorkflow handlers,
 * getPolicy/getPolicyVersion) are forward-guards — these tests are their proof.
 */
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";

import typedConvexErrors from "../typed-convex-errors.mjs";
import noThrowInEffectHandler from "../no-throw-in-effect-handler.mjs";
import noThrowTaggedError from "../no-throw-tagged-error.mjs";
import requireMinroleOnWrite from "../require-minrole-on-write.mjs";
import workflowStepsAreCapabilities from "../workflow-steps-are-capabilities.mjs";
import workflowHandlerDeterminism from "../workflow-handler-determinism.mjs";
import workflowPolicySnapshot from "../workflow-policy-snapshot.mjs";
import noRawWorkflowPrimitives from "../no-raw-workflow-primitives.mjs";
import noCrossDomainValueImport from "../no-cross-domain-value-import.mjs";
import noRawScheduler from "../no-raw-scheduler.mjs";
import frontendRouteThin from "../frontend-route-thin.mjs";
import frontendRouteServerBoundary from "../frontend-route-server-boundary.mjs";

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const CAP = "packages/convex/confect/capabilities/x.ts";
const SHARED = "packages/convex/confect/shared/x.ts";
const OPS = "packages/convex/confect/ops/x.ts";
const HTTP = "packages/convex/confect/http.ts";
const WORKFLOW = "packages/convex/confect/workflows/x.ts";
const WORKFLOW_TEST = "packages/convex/confect/workflows/x.test.ts";
const INTERPRETER = "packages/convex/confect/workflows/runGraph.ts";
const GENERATED_RUNNER =
  "packages/convex/confect/workflowRunners/generatedBrief.ts";
const PROJECTED_RUNNER =
  "packages/convex/convex/workflowRunners/generatedBrief.ts";
const DOMAIN = "packages/convex/confect/capabilities/batch.domain.ts";
const DOMAIN_DIR = "packages/convex/confect/domain/batch.ts";
const DOMAIN_TEST = "packages/convex/confect/capabilities/batch.domain.test.ts";
const TEST_FILE = "packages/convex/confect/capabilities/x.test.ts";

tester.run("typed-convex-errors", typedConvexErrors, {
  valid: [
    {
      filename: CAP,
      code: "export function f() { throw new ConvexError({ code: 'X' }); }",
    },
    // pure layers (shared helpers, domain modules) may throw plain Error
    {
      filename: SHARED,
      code: "export function f() { throw new Error('pure layer ok'); }",
    },
    // test files are exempt even inside a boundary layer
    {
      filename: TEST_FILE,
      code: "export function f() { throw new Error('test ok'); }",
    },
  ],
  invalid: [
    {
      filename: CAP,
      code: "export function f() { throw new Error('bad'); }",
      errors: [{ messageId: "typed" }],
    },
    // the confect HTTP router (confect/http.ts) is a boundary layer too
    {
      filename: HTTP,
      code: "export function f() { throw new Error('bad'); }",
      errors: [{ messageId: "typed" }],
    },
  ],
});

const IMPL = "packages/convex/confect/access/members.impl.ts";
const IMPL_TEST = "packages/convex/confect/access/members.impl.test.ts";
const PLANNER = "packages/convex/confect/access/lifecycle.ts";

tester.run("no-throw-in-effect-handler", noThrowInEffectHandler, {
  valid: [
    // handler surfaces the error through the channel — no throw
    {
      filename: IMPL,
      code: "const h = () => Effect.gen(function* () { return yield* new Forbidden({ reason: 'x' }); });",
    },
    // an intentional invariant defect is stated, not thrown
    {
      filename: IMPL,
      code: "const h = () => Effect.gen(function* () { return yield* Effect.dieMessage('unreachable'); });",
    },
    // pure planner modules (not *.impl.ts) are out of scope: unit-tested as
    // throwing pure functions, wrapped into typed failures at the boundary
    {
      filename: PLANNER,
      code: "export const plan = () => { throw new Forbidden({ reason: 'x' }); };",
    },
    // *.impl.test.ts is exempt
    {
      filename: IMPL_TEST,
      code: "it('x', () => { throw new Error('assert'); });",
    },
  ],
  invalid: [
    // the headline defect leak: throwing a tagged error inside a handler file
    {
      filename: IMPL,
      code: "const requireRole = () => { throw new Forbidden({ reason: 'x' }); };",
      errors: [{ messageId: "noThrow" }],
    },
    // bare Error thrown as an invariant in a handler file — still a defect,
    // still must be an explicit Effect.die
    {
      filename: IMPL,
      code: "const f = (p) => { if (p.action !== 'insert') throw new Error('bad'); return p.value; };",
      errors: [{ messageId: "noThrow" }],
    },
  ],
});

const PLANNER_FILE = "packages/convex/confect/access/lifecycle.ts";
const ERRORS_FILE = "packages/convex/confect/errors.ts";

tester.run("no-throw-tagged-error", noThrowTaggedError, {
  valid: [
    // planner returns the error, never throws it
    {
      filename: PLANNER_FILE,
      code: "import { Forbidden } from '../errors'; export const p = () => Either.left(new Forbidden({ reason: 'x' }));",
    },
    // a genuine invariant may still throw a plain Error (intentional defect)
    {
      filename: PLANNER_FILE,
      code: "export const p = () => { throw new Error('invariant'); };",
    },
    // throwing a non-error-module identifier is untouched
    {
      filename: PLANNER_FILE,
      code: "import { Thing } from './thing'; export const p = () => { throw new Thing(); };",
    },
    // test files are exempt
    {
      filename: "packages/convex/test/access-lifecycle.test.ts",
      code: "import { Forbidden } from '../confect/errors'; it('x', () => { throw new Forbidden({ reason: 'x' }); });",
    },
  ],
  invalid: [
    // throwing a tagged error imported from an errors module
    {
      filename: PLANNER_FILE,
      code: "import { Forbidden } from '../errors'; export const p = () => { throw new Forbidden({ reason: 'x' }); };",
      errors: [{ messageId: "noThrowTagged" }],
    },
    // throwing a tagged error declared in the same file
    {
      filename: ERRORS_FILE,
      code: "import * as Schema from 'effect/Schema'; class Boom extends Schema.TaggedError()('Boom', {}) {} const p = () => { throw new Boom(); };",
      errors: [{ messageId: "noThrowTagged" }],
    },
  ],
});

tester.run("require-minrole-on-write", requireMinroleOnWrite, {
  valid: [
    // workspaceMutation with explicit minRole: "editor" — compliant
    {
      filename: CAP,
      code: "workspaceMutation({ minRole: 'editor', args: {}, returns: v.id('edits'), handler: async (ctx) => {} });",
    },
    // workspaceMutation with explicit minRole: "viewer" — forces the decision
    {
      filename: CAP,
      code: "workspaceMutation({ minRole: 'viewer', args: {}, returns: v.null(), handler: async () => null });",
    },
    // workspaceAction with explicit minRole: "viewer"
    {
      filename: CAP,
      code: "workspaceAction({ minRole: 'viewer', args: {}, returns: v.null(), handler: () => null });",
    },
    // workspaceQuery is exempt — reads default-viewer is fine
    {
      filename: CAP,
      code: "workspaceQuery({ args: {}, returns: v.null(), handler: () => null });",
    },
    // test files are exempt
    {
      filename: TEST_FILE,
      code: "workspaceMutation({ args: {}, handler: () => {} });",
    },
    // plain mutation (not a workspace builder) is not covered by this rule
    {
      filename: CAP,
      code: "mutation({ args: {}, returns: v.null(), handler: () => null });",
    },
  ],
  invalid: [
    // workspaceMutation without minRole — the implicit-viewer trap
    {
      filename: CAP,
      code: "workspaceMutation({ args: {}, returns: v.id('batches'), handler: async (ctx) => {} });",
      errors: [{ messageId: "missing" }],
    },
    // workspaceAction without minRole
    {
      filename: CAP,
      code: "workspaceAction({ args: {}, returns: v.object({ slug: v.string() }), handler: (ctx) => ({ slug: ctx.workspaceSlug }) });",
      errors: [{ messageId: "missing" }],
    },
    // string-keyed config property is not a bypass for the minRole check
    {
      filename: CAP,
      code: "workspaceMutation({ 'args': {}, 'handler': async () => {} });",
      errors: [{ messageId: "missing" }],
    },
  ],
});

tester.run("workflow-policy-snapshot", workflowPolicySnapshot, {
  valid: [
    // getPolicyVersion (the pinned read) is the LEGAL workflow access
    {
      filename: WORKFLOW,
      code: 'import { getPolicyVersion } from "../policy/read";',
    },
    // a getPolicyVersion CALL is legal
    {
      filename: WORKFLOW,
      code: "export const f = (ctx, id) => getPolicyVersion(ctx, id);",
    },
    // getPolicy OUTSIDE workflows/ is fine (this rule is workflow-scoped only)
    {
      filename: CAP,
      code: 'import { getPolicy } from "../policy/read"; export const f = (ctx) => getPolicy(ctx);',
    },
    // a getPolicy*-prefixed name (getPolicyInWorkspace) is NOT the banned name
    {
      filename: WORKFLOW,
      code: "export const f = (ctx, id) => getPolicyInWorkspace(ctx, id);",
    },
    // tests are exempt — even an explicit getPolicy import
    {
      filename: WORKFLOW_TEST,
      code: 'import { getPolicy } from "../policy/read";',
    },
    // re-exporting the PINNED read getPolicyVersion from a workflow is fine
    {
      filename: WORKFLOW,
      code: 'export { getPolicyVersion } from "../policy/read";',
    },
  ],
  invalid: [
    // importing getPolicy into a workflow — banned at the door
    {
      filename: WORKFLOW,
      code: 'import { getPolicy } from "../policy/read";',
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // re-exporting getPolicy from a workflow is laundering — the downstream
    // caller then imports a renamed symbol, so the import/call arms can't see
    // it; caught at the re-export (the LOCAL/source name is the laundered symbol)
    {
      filename: WORKFLOW,
      code: 'export { getPolicy } from "../policy/read";',
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // aliasing the re-export does not hide the local source name
    {
      filename: WORKFLOW,
      code: 'export { getPolicy as readLive } from "../policy/read";',
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // `export *` re-exports getPolicy wholesale — caught
    {
      filename: WORKFLOW,
      code: 'export * from "../policy/read";',
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // calling getPolicy(...) inside a workflow
    {
      filename: WORKFLOW,
      code: "export const f = (ctx) => getPolicy(ctx, 'kind', s);",
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // aliasing the import does not launder the banned imported name
    {
      filename: WORKFLOW,
      code: 'import { getPolicy as g } from "../policy/read";',
      errors: [{ messageId: "latestInWorkflow" }],
    },
    // a member call x.getPolicy(...) is caught too
    {
      filename: WORKFLOW,
      code: "export const f = (api, ctx) => api.getPolicy(ctx);",
      errors: [{ messageId: "latestInWorkflow" }],
    },
  ],
});

tester.run("no-raw-scheduler", noRawScheduler, {
  valid: [
    // a component method call is NOT a ctx.scheduler hop — components
    // schedule internally
    {
      filename: OPS,
      code: "export const f = (ctx) => analytics.capture(ctx, { event: 'e' });",
    },
    // a component's own .limit (rate limiter) is not a scheduler hop
    {
      filename: OPS,
      code: "export const f = (ctx) => rateLimiter.limit(ctx, 'k', {});",
    },
    // `step.runAfter` is a workflow step name, not `.scheduler.runAfter` — the
    // .scheduler anchor is absent, so it is not flagged
    {
      filename: WORKFLOW,
      code: "export const f = (step) => step.runAfter(internal.x.y, {});",
    },
    // an unrelated `queue.runAt` (no .scheduler object) is not the hop
    {
      filename: CAP,
      code: "export const f = (queue) => queue.runAt(0, {});",
    },
    // the same scheduler hop in a TEST file is exempt
    {
      filename: TEST_FILE,
      code: "export const f = (ctx) => ctx.scheduler.runAfter(0, internal.x.y, {});",
    },
    // OUTSIDE the confect backend → out of scope
    {
      filename: "apps/web/src/adapters/x.ts",
      code: "export const f = (ctx) => ctx.scheduler.runAfter(0, {});",
    },
  ],
  invalid: [
    // ctx.scheduler.runAfter(0, …) in a capability — the canonical hop
    {
      filename: CAP,
      code: "export const f = (ctx) => ctx.scheduler.runAfter(0, internal.x.y, {});",
      errors: [{ messageId: "rawScheduler" }],
    },
    // ctx.scheduler.runAt(ts, …) is equally banned
    {
      filename: CAP,
      code: "export const f = (ctx, ts) => ctx.scheduler.runAt(ts, internal.x.y, {});",
      errors: [{ messageId: "rawScheduler" }],
    },
    // a non-ctx receiver still trips — the .scheduler.runAfter shape is the smell
    {
      filename: OPS,
      code: "export const f = (c) => c.scheduler.runAfter(0, {});",
      errors: [{ messageId: "rawScheduler" }],
    },
    // the string-computed member form `["scheduler"]["runAfter"]` is not a bypass
    {
      filename: CAP,
      code: 'export const f = (ctx) => ctx["scheduler"]["runAfter"](0, {});',
      errors: [{ messageId: "rawScheduler" }],
    },
  ],
});

tester.run("workflow-handler-determinism", workflowHandlerDeterminism, {
  valid: [
    // step.* calls + pure computation are the legal handler shape
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async (step, args) => { const r = await step.runMutation(m, args); return r; });",
    },
    // a step.runMutation inside the handler is fine
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runMutation(m, {}));",
    },
    // the SAME tokens in the kickoff mutation (OUTSIDE .handler) are fine — the
    // kickoff is a normal mutation, not a replayed body
    {
      filename: WORKFLOW,
      code: "export const start = workspaceMutation({ handler: async (ctx) => { const t = Date.now(); await ctx.db.insert('x', { t }); return start(ctx, run, {}); } });",
    },
    // a Date.now in a NON-handler call (not defineWorkflow().handler) is untouched
    {
      filename: WORKFLOW,
      code: "export const f = something(c).handler(() => Date.now());",
    },
    // out of workflows/ → out of scope
    {
      filename: CAP,
      code: "export const run = defineWorkflow(c, {}).handler(() => Date.now());",
    },
    // tests are exempt
    {
      filename: WORKFLOW_TEST,
      code: "export const run = defineWorkflow(c, {}).handler(() => Date.now());",
    },
    // Upstream patches these core globals for deterministic replay. Maestro
    // permits the normalized forms rather than misreporting an upstream gap.
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => [Date.now(), new Date(), Math.random()]);",
    },
    {
      filename: GENERATED_RUNNER,
      code: "export const run = defineMaestroWorkflow(c, {}).handler(() => [Date.now(), Math.random()]);",
    },
  ],
  invalid: [
    // ctx.db.get(...) inside a handler (a db read)
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async (step, ctx) => { return ctx.db.get(id); });",
      errors: [{ messageId: "nondeterministic" }],
    },
    {
      filename: GENERATED_RUNNER,
      code: "export const run = defineMaestroWorkflow(c, {}).handler(() => fetch('https://x'));",
      errors: [{ messageId: "nondeterministic" }],
    },
    // Locale/timezone-sensitive formatting is deliberately restricted because
    // the pinned runtime does not normalize Intl or Date locale methods.
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => new Intl.DateTimeFormat().format(new Date()));",
      errors: [{ messageId: "nondeterministic" }],
    },
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => new Date().toLocaleString());",
      errors: [{ messageId: "nondeterministic" }],
    },
    // crypto.randomUUID() inside a handler
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => crypto.randomUUID());",
      errors: [{ messageId: "nondeterministic" }],
    },
    // fetch(...) inside a handler — IO (bare identifier)
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async () => { await fetch('https://x'); });",
      errors: [{ messageId: "nondeterministic" }],
    },
    // globalThis.fetch(...) — a non-bare fetch via member access is IO too
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async () => { await globalThis.fetch('https://x'); });",
      errors: [{ messageId: "nondeterministic" }],
    },
    // window.fetch(...) — likewise caught by the .fetch member match
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async () => { await window.fetch('https://x'); });",
      errors: [{ messageId: "nondeterministic" }],
    },
    // process.env inside a handler — env access
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => process.env.KEY);",
      errors: [{ messageId: "nondeterministic" }],
    },
    // ctx.scheduler inside a handler — a scheduler hop (the .scheduler member is
    // the single banned token; .runAfter on it is not separately flagged here)
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step, ctx) => ctx.scheduler.runAfter(0, m, {}));",
      errors: [{ messageId: "nondeterministic" }],
    },
    // a banned token in a NESTED callback inside the handler still runs at replay
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step, xs) => xs.map(() => process.env.KEY));",
      errors: [{ messageId: "nondeterministic" }],
    },
  ],
});

tester.run("no-raw-workflow-primitives", noRawWorkflowPrimitives, {
  valid: [
    {
      filename:
        "packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts",
      code: 'import { WorkflowManager } from "@convex-dev/workflow"; const manager = new WorkflowManager(c);',
    },
    {
      filename: CAP,
      code: 'import { startGeneratedWorkflow } from "../workflows/_kit";',
    },
  ],
  invalid: [
    {
      filename: CAP,
      code: 'import { defineWorkflow } from "@convex-dev/workflow";',
      errors: [{ messageId: "raw" }],
    },
    {
      filename: PROJECTED_RUNNER,
      code: 'import { WorkflowManager } from "@convex-dev/workflow"; const manager = new WorkflowManager(c);',
      errors: [{ messageId: "raw" }, { messageId: "manager" }],
    },
    {
      filename:
        "packages/convex/confect/workflows/_kit/defineMaestroWorkflow.test.ts",
      code: 'import { WorkflowManager } from "@convex-dev/workflow"; const manager = new WorkflowManager(c);',
      errors: [{ messageId: "raw" }, { messageId: "manager" }],
    },
  ],
});

tester.run("workflow-steps-are-capabilities", workflowStepsAreCapabilities, {
  valid: [
    // a step that calls a capability — the legal shape
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runMutation(internal.capabilities.brief.draft, {}));",
    },
    // runQuery + runAction to capabilities are equally fine
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(async (step) => { const a = await step.runQuery(internal.capabilities.catalog.get, {}); return step.runAction(internal.capabilities.brief.publish, a); });",
    },
    // a handler with no steps (pure composition) — nothing to flag
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step, args) => ({ ...args }));",
    },
    // the kickoff calls start(ctx, internal.workflows.run) — not a step.run*, and
    // it's the kickoff, not the handler — untouched
    {
      filename: WORKFLOW,
      code: "export const start = workspaceMutation({ handler: (ctx) => start(ctx, internal.workflows.x.run, {}) });",
    },
    // a step nested in a .map still targets a capability — fine
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step, xs) => xs.map((x) => step.runMutation(internal.capabilities.brief.score, x)));",
    },
    // out of workflows/ → out of scope (the runtime seam may step elsewhere)
    {
      filename: CAP,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runAction(internal.adapters.llm.complete, {}));",
    },
    // the graph interpreter (runGraph.ts) is the one exempted dynamic seam
    {
      filename: INTERPRETER,
      code: "export const run = defineWorkflow(c, {}).handler((step, ref) => step.runAction(ref, {}));",
    },
    // tests are exempt
    {
      filename: WORKFLOW_TEST,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runAction(internal.adapters.llm.complete, {}));",
    },
  ],
  invalid: [
    // step targets an adapter — reach it THROUGH a capability
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runAction(internal.adapters.llm.complete, {}));",
      errors: [{ messageId: "notCapability" }],
    },
    // step targets another workflow's internals
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runMutation(internal.workflows.other.step, {}));",
      errors: [{ messageId: "notCapability" }],
    },
    // step targets the agent layer
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runQuery(internal.agents.x.y, {}));",
      errors: [{ messageId: "notCapability" }],
    },
    // step targets a policy-table internal (must go through a capability)
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => step.runQuery(internal.policy.kinds.read, {}));",
      errors: [{ messageId: "notCapability" }],
    },
    // first arg is a bare local ref, not an internal.capabilities.* literal
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step) => { const ref = internal.capabilities.brief.draft; return step.runMutation(ref, {}); });",
      errors: [{ messageId: "notCapability" }],
    },
    // a non-capability step nested in a .map is still caught (walk descends)
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler((step, xs) => xs.map((x) => step.runAction(internal.adapters.email.send, x)));",
      errors: [{ messageId: "notCapability" }],
    },
  ],
});

tester.run("no-cross-domain-value-import", noCrossDomainValueImport, {
  valid: [
    {
      // type-only import from a sibling module — allowed (shape contract)
      code: `import type { Channel } from "./batch.domain";`,
      filename: DOMAIN,
    },
    {
      // import from another layer — allowed (domain → shared is downward)
      code: `import { validateBatch } from "../shared/batch";`,
      filename: DOMAIN,
    },
    {
      // import from external package — not a sibling module
      code: `import { v } from "convex/values";`,
      filename: DOMAIN,
    },
    {
      // import from tables/ — allowed (domain → schema is downward)
      code: `import { batchFields } from "../tables/batches";`,
      filename: DOMAIN,
    },
    {
      // test file — exempt
      code: `import { buildBatch } from "./batch.domain";`,
      filename: DOMAIN_TEST,
    },
    {
      // plain capability file — this rule only scopes domain modules
      code: `import { buildBatch } from "./batch.domain";`,
      filename: CAP,
    },
  ],
  invalid: [
    {
      // value import from a sibling module — the god-file chaining anti-pattern
      code: `import { buildBatch } from "./other.domain";`,
      filename: DOMAIN,
      errors: [{ messageId: "valueImport" }],
    },
    {
      // the forward-guard domain/ directory form is covered too
      code: `import { buildPiece } from "./piece";`,
      filename: DOMAIN_DIR,
      errors: [{ messageId: "valueImport" }],
    },
    {
      // default import from a sibling — also a value import
      code: `import batch from "./other.domain";`,
      filename: DOMAIN,
      errors: [{ messageId: "valueImport" }],
    },
    {
      // namespace import from a sibling — also a value import
      code: `import * as batch from "./other.domain";`,
      filename: DOMAIN,
      errors: [{ messageId: "valueImport" }],
    },
    {
      // mixed: one type specifier + one value specifier — the value makes it bad
      code: `import { type Channel, buildBatch } from "./other.domain";`,
      filename: DOMAIN,
      errors: [{ messageId: "valueImport" }],
    },
    {
      // inline type specifiers — with verbatimModuleSyntax, compiles to
      // `import {} from "./other.domain"` which still evaluates the module at
      // runtime; only top-level `import type` is fully erased
      code: `import { type Channel, type Status } from "./other.domain";`,
      filename: DOMAIN,
      errors: [{ messageId: "valueImport" }],
    },
  ],
});

tester.run("frontend-route-thin", frontendRouteThin, {
  valid: [
    {
      filename: "apps/web/src/routes/briefs.tsx",
      code: "import { BriefsScreen } from '@/screens/briefs-screen'; export default function Page() { return BriefsScreen; }",
    },
    {
      filename: "apps/web/src/routes/callback.tsx",
      code: "'use client'; import { useEffect } from 'react'; export default function Page() { useEffect(() => window.location.replace('/'), []); return null; }",
    },
    {
      filename: "apps/web/src/routes/__root.tsx",
      code: "import { ConvexProviderWithAuth } from 'convex/react'; import type { ConvexReactClient } from 'convex/react'; export default function Root() { return ConvexProviderWithAuth; }",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/routes/reports.tsx",
      code: "'use client'; export default function Page() { return null; }",
      errors: [{ messageId: "client" }],
    },
    {
      filename: "apps/web/src/routes/reports.tsx",
      code: "import { useQuery } from 'convex/react'; export default function Page() { useQuery(api.x.y); return null; }",
      errors: [{ messageId: "import" }, { messageId: "hook" }],
    },
    {
      filename: "apps/web/src/routes/not-root.tsx",
      code: "import { ConvexProviderWithAuth } from 'convex/react'; export default function Page() { return ConvexProviderWithAuth; }",
      errors: [{ messageId: "import" }],
    },
    {
      filename: "apps/web/src/routes/reports.tsx",
      code: "export default function Page() { return Date.now(); }",
      errors: [{ messageId: "ambient" }],
    },
    {
      filename: "apps/web/src/routes/reports.tsx",
      code: "export default function Page() { return window.location.href; }",
      errors: [{ messageId: "browser" }],
    },
  ],
});

tester.run("frontend-route-server-boundary", frontendRouteServerBoundary, {
  valid: [
    {
      filename: "apps/web/src/routes/callback.tsx",
      code: "import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/callback')({ server: { handlers: { GET: handleCallbackRoute() } } });",
    },
    {
      filename: "apps/web/src/routes/sign-in.tsx",
      code: "import { getSignInUrl } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/sign-in')({ server: { handlers: { GET: () => getSignInUrl() } } });",
    },
    {
      filename: "apps/web/src/routes/sign-up.tsx",
      code: "import { getSignUpUrl } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/sign-up')({ server: { handlers: { GET: () => getSignUpUrl() } } });",
    },
    {
      filename: "apps/web/src/routes/_workspace.tsx",
      code: "export const Route = createFileRoute('/_workspace')({ loader: requireAuthenticatedRoute, component: Outlet });",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/routes/_workspace.briefs.tsx",
      code: "export const Route = createFileRoute('/briefs')({ server: { handlers: { GET: () => new Response() } } });",
      errors: [{ messageId: "server" }],
    },
    {
      filename: "apps/web/src/routes/_workspace.briefs.tsx",
      code: "export const Route = createFileRoute('/briefs')({ loader: async () => ({}) });",
      errors: [{ messageId: "loader" }],
    },
    {
      filename: "apps/web/src/routes/sign-up.tsx",
      code: "import { getSignInUrl } from '@workos/authkit-tanstack-react-start'; export const x = getSignInUrl;",
      errors: [{ messageId: "helper" }],
    },
    {
      filename: "apps/web/src/routes/callback.tsx",
      code: "import { getSignUpUrl } from '@workos/authkit-tanstack-react-start'; export const x = getSignUpUrl;",
      errors: [{ messageId: "helper" }],
    },
  ],
});
