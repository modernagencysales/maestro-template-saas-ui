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
import acceptanceBoundary from "../acceptance-boundary.mjs";
import shellAuthority from "../saas-ui-shell-authority.mjs";
import officialPrimitives from "../prefer-saas-ui-primitives.mjs";
import semanticColors from "../saas-ui-semantic-colors.mjs";

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
    // workflow planners are not client-callable boundaries
    {
      filename: WORKFLOW,
      code: "export function validate() { throw new Error('invariant'); }",
    },
  ],
  invalid: [
    {
      filename: CAP,
      code: "export const f = mutation({ handler: () => { throw new Error('bad'); } });",
      errors: [{ messageId: "typed" }],
    },
    {
      filename: CAP,
      code: "const handler = () => { throw new Error('bad'); }; export const f = mutation({ handler });",
      errors: [{ messageId: "typed" }],
    },
    {
      filename: CAP,
      code: "const original = () => { throw new Error('bad'); }; const handler = original; export const f = mutation({ handler });",
      errors: [{ messageId: "typed" }],
    },
    {
      filename: CAP,
      code: "import { mutation as registerMutation } from './_generated/server'; const handler = () => { throw new Error('bad'); }; export const f = registerMutation({ handler });",
      errors: [{ messageId: "typed" }],
    },
    {
      filename: CAP,
      code: "const registerMutation = mutation; const handler = () => { throw new Error('bad'); }; export const f = registerMutation({ handler });",
      errors: [{ messageId: "typed" }],
    },
    // the confect HTTP router (confect/http.ts) is a boundary layer too
    {
      filename: HTTP,
      code: "export const f = httpAction(() => { throw new Error('bad'); });",
      errors: [{ messageId: "typed" }],
    },
    {
      filename: WORKFLOW,
      code: "export const run = defineWorkflow(c, {}).handler(() => { throw new Error('bad'); });",
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
      filename: "packages/convex/confect/workflows/_kit/ownership.ts",
      code: 'import { start, WorkflowId } from "@convex-dev/workflow";',
    },
    {
      filename: "packages/convex/confect/workflows/_kit/status.ts",
      code: 'import type { WorkflowStatus } from "@convex-dev/workflow";',
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
    {
      filename: "packages/convex/confect/workflows/_kit/graphRunner.ts",
      code: 'import { WorkflowId } from "@convex-dev/workflow";',
      errors: [{ messageId: "raw" }],
    },
    {
      filename: "packages/convex/confect/workflows/_kit/ownership.ts",
      code: 'import { WorkflowManager } from "@convex-dev/workflow"; const manager = new WorkflowManager(c);',
      errors: [{ messageId: "manager" }],
    },
    {
      filename: "packages/convex/confect/workflows/_kit/status.ts",
      code: 'import { WorkflowManager } from "@convex-dev/workflow"; const manager = new WorkflowManager(c);',
      errors: [{ messageId: "manager" }],
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
      filename: "apps/web/src/routes/api/auth/callback.tsx",
      code: "import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/api/auth/callback')({ server: { handlers: { GET: handleCallbackRoute() } } });",
    },
    {
      filename: "apps/web/src/routes/api/auth/sign-in.tsx",
      code: "import { getSignInUrl } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/api/auth/sign-in')({ server: { handlers: { GET: () => getSignInUrl() } } });",
    },
    {
      filename: "apps/web/src/routes/api/auth/sign-up.tsx",
      code: "import { getSignUpUrl } from '@workos/authkit-tanstack-react-start'; export const Route = createFileRoute('/api/auth/sign-up')({ server: { handlers: { GET: () => getSignUpUrl() } } });",
    },
    {
      filename: "apps/web/src/routes/_app.tsx",
      code: "export const Route = createFileRoute('/_app')({ loader: requireAuthenticatedRoute, component: Outlet });",
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
      filename: "apps/web/src/routes/api/auth/sign-up.tsx",
      code: "import { getSignInUrl } from '@workos/authkit-tanstack-react-start'; export const x = getSignInUrl;",
      errors: [{ messageId: "helper" }],
    },
    {
      filename: "apps/web/src/routes/api/auth/callback.tsx",
      code: "import { getSignUpUrl } from '@workos/authkit-tanstack-react-start'; export const x = getSignUpUrl;",
      errors: [{ messageId: "helper" }],
    },
  ],
});

const ACCEPTANCE = "tests/acceptance/records.spec.ts";
const ACCEPTANCE_SUPPORT = "tests/acceptance/support/proxy.ts";
const ACCEPTANCE_RUNTIME = "tests/acceptance/support/runtime.ts";
const SEED_ACCEPTANCE =
  "examples/saas-application/seed/source/tests/acceptance/records.spec.ts";
const SEED_SUPPORT =
  "examples/saas-application/seed/source/tests/acceptance/support/proxy.ts";

tester.run("acceptance-boundary", acceptanceBoundary, {
  valid: [
    {
      filename: ACCEPTANCE,
      code: `import { test, expect } from "./support/fixtures";
import { readFixture } from "./support/fixture";
test("record appears in the web app", { tag: "@BHV-REC-001-R1" }, async ({ acceptancePage: page, runtime }) => { await page.goto(\`\${runtime.webUrl}/records\`); expect(await readFixture("fixture")).toBeTruthy(); });`,
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test("record appears in the workspace", { tag: "@BHV-REC-001-R1" }, async ({ acceptancePage: page, runtime, scenario }) => { await page.goto(\`\${runtime.webUrl}/\${scenario.workspaceSlug}/records\`); });`,
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `import { join } from "node:path"; void join;`,
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const getBuiltinModule = "env";
const environment = process[getBuiltinModule];
const key = "KEY";
const value = process.env[key];
test("@BHV-REC-001-R1", async () => { void environment; void value; });`,
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test("record appears in the CLI", { tag: "@BHV-REC-002-R1" }, async ({ runtime, scenario }) => { await runtime.runCli(scenario, ["capability", "run", "records.list"]); });`,
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test("@BHV-REC-001-R1", async () => {});`,
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test.describe("records", () => {
  test("@BHV-REC-001-R1", async () => {});
});`,
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
import { proxy } from "./support/proxy";
test("record appears", async ({ acceptancePage: page }) => { await proxy(page); });`,
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `export async function proxy(context, route) {
  await context.route("**/api/**", handler);
  await route.fulfill({ status: 502 });
}`,
    },
    {
      filename:
        "examples/saas-application/seed/source/tests/acceptance/support/runtime.ts",
      code: `export async function proxy(context, route) {
  await context.route("**/api/**", handler);
  await route.fulfill({ status: 502 });
}`,
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `export async function proxy(context, targetUrl) {
  await context.route("**/api/**", async (route) => {
    const response = await route.fetch({ url: targetUrl });
    await route.fulfill({ response });
  });
}`,
    },
    {
      filename:
        "examples/saas-application/seed/source/tests/acceptance/support/runtime.ts",
      code: `export async function proxy(context, targetUrl) {
  await context.route("**/api/**", async (route) => {
    const response = await route.fetch({ url: targetUrl });
    await route.fulfill({ response });
  });
}`,
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `import { runtime } from "./runtime"; export { runtime };`,
    },
    {
      filename: SEED_SUPPORT,
      code: `import { runtime } from "./runtime"; export { runtime };`,
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { CONTRACTS_HOOK_TIMEOUT_MS, createContractsRuntimeController } from "./runtime";
export const test = base.extend({
  runtime: [async ({ playwright: _playwright }, use) => {
    void _playwright;
    const controller = createContractsRuntimeController();
    const activeRuntime = await controller.start();
    try { await use(activeRuntime); } finally { await controller.stop(); }
  }, { scope: "worker", auto: true }],
  scenario: [async ({ runtime }, use) => {
    await use(await runtime.provisionScenario());
  }, { timeout: CONTRACTS_HOOK_TIMEOUT_MS }],
  acceptancePage: async ({ runtime, scenario }, use) => {
    const context = await runtime.browser.newContext();
    try {
      await runtime.authorizeBrowserContext(scenario, context);
      await use(await context.newPage());
    } finally { await context.close(); }
  },
});`,
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/acceptance", testMatch: "**/*.spec.ts", forbidOnly: true, retries: 0, workers: 1, fullyParallel: false, repeatEach: 1, testIgnore: [], projects: [{ name: "acceptance-chromium", use: { browserName: "chromium" } }] });`,
    },
  ],
  invalid: [
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const make = globalThis["Fun" + "ction"];
test("record appears", { tag: "@BHV-REC-001-R1" }, async ({ runtime }) => {
  await make("return import('../../../apps/web/src/router.tsx')")();
  await runtime.runCli();
});`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({
  runtime: [async ({ playwright: _playwright }, use) => {
    void _playwright;
    const controller = createContractsRuntimeController();
    const activeRuntime = await controller.start();
    try { await use(activeRuntime); } finally { await controller.stop(); }
  }, { scope: "worker", auto: true }],
  scenario: async ({ runtime }, use) => {
    await use(await runtime.provisionScenario());
  },
  acceptancePage: async ({ runtime, scenario }, use) => {
    const context = await runtime.browser.newContext();
    try {
      await runtime.authorizeBrowserContext(scenario, context);
      await use(await context.newPage());
    } finally { await context.close(); }
  },
  canned: async ({ runtime }, use) => use("counterfeit"),
});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { expect, test } from "./support/fixtures";
test("record appears", { tag: "@BHV-REC-001-R1" }, async ({ runtime, canned }) => {
  void runtime;
  expect(canned).toBe("counterfeit");
});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const identity = (value) => value;
identity(route.continue);
identity(route[method]);
const controls = { redirect: route.continue };
identity(context.route);
identity(route.fulfill);
identity(page.evaluate);`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "synthetic" },
        { messageId: "browser" },
      ],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const { nested: { continue: nestedContinue } } = route;
try { throw route; } catch ({ continue: caughtContinue }) {}
const { route: intercept } = context;`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `await route.fetch({ url: arbitraryUrl });`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `route.fetch({ url: arbitraryUrl });`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test.describe.configure({ retries: 1 });`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test.describe.parallel("parallel", () => {});
const parallel = test.describe.parallel;
parallel("laundered parallel", () => {});`,
      errors: [{ messageId: "annotation" }, { messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const { describe, describe: groupedDescribe } = test;
describe.configure({ retries: 1 });
groupedDescribe.configure({ retries: 1 });`,
      errors: [{ messageId: "annotation" }, { messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const suites = test;
const configure = suites.describe.configure;
configure({ retries: 1 });`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const describe = test.describe;
describe.configure({ retries: 1 });
test("@BHV-REC-001-R1", async () => {});`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
identity(test).describe.configure({ retries: 1 });
test("@BHV-REC-001-R1", async () => {});`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `/* global route, targetUrl */
const redirect = route.continue;
await redirect({ url: targetUrl });`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: SEED_SUPPORT,
      code: `const { continue: redirect, fallback, abort } = route;
await redirect({ url: targetUrl });
await fallback();
await abort();`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `export async function proxy(context) {
  await context.route("**/__contracts/api/**", (route) =>
    route.continue({ url: targetUrl }));
}`,
      errors: [{ messageId: "network" }, { messageId: "network" }],
    },
    {
      filename: SEED_SUPPORT,
      code: `export async function proxy(context) {
  await context.route("**/__contracts/api/**", (route) =>
    route.continue({ url: targetUrl }));
}`,
      errors: [{ messageId: "network" }, { messageId: "network" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `export async function proxy(context) {
  await context.route("**/__contracts/api/**", (route) =>
    route.continue({ url: targetUrl }));
  await route.fallback();
  await route.abort();
}`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename:
        "examples/saas-application/seed/source/tests/acceptance/support/runtime.ts",
      code: `export async function proxy(context) {
  await context.route("**/__contracts/api/**", (route) =>
    route.continue({ url: targetUrl }));
  await route.fallback();
  await route.abort();
}`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      // A canonical fixture import is insufficient when a scenario can still
      // use the built-in page fixture to assert canned markup.
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test("canned record", { tag: "@BHV-REC-001-R1" }, async ({ page }) => {
  await page.setContent("<h1>Record</h1>");
  await page.goto("data:text/html,<h1>Record</h1>");
  await page.goto(\`data:text/html,<h1>Record</h1>\`);
  await page.goto("data:text/html," + "<h1>Record</h1>");
  const canned = "data:text/html,<h1>Record</h1>";
  await page.goto(canned);
  await page.goto("file:///tmp/record.html");
  await page.goto("https://example.com/records");
});`,
      errors: [
        { messageId: "fixture" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `import * as fixtures from "./support/fixtures";
const test = fixtures.test.extend({
  runtime: [async ({}, use) => use(undefined), { scope: "worker", auto: true }],
});

test("no runtime", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `import { raw as test } from "./support/fixtures";
test("no runtime", { "tag": "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import unsafeTest from "./support/fixtures.ts";
const options = { tag: "@BHV-REC-001-R1" };
unsafeTest("uses bare Playwright", options, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import * as fixtures from "./support/fixtures.ts";
fixtures.test("uses bare Playwright", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }, { messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { raw as test } from "./support/fixtures.ts";
test("uses bare Playwright", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
function nested(test) {
  test("no runtime", { tag: "@BHV-REC-001-R1" }, async () => {});
}`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // A tagged scenario must use the generated-customer fixture; bare
      // Playwright can pass admission against canned markup without startup.
      filename: ACCEPTANCE,
      code: `import { expect, test } from "@playwright/test";
test("uses bare Playwright", { tag: "@BHV-REC-001-R1" }, async () => {
  expect(true).toBe(true);
});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // The fixture import is direct so support cannot re-export a bare
      // Playwright test object around the generated-customer runtime.
      filename: SEED_ACCEPTANCE,
      code: `import { test } from "./support/playwright";
test("uses a re-export", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // Support may import bare Playwright only for the canonical extended
      // fixture, never to expose an alias that bypasses runtime startup.
      filename: "tests/acceptance/support/raw.ts",
      code: `import { test as base } from "@playwright/test";
const raw = base;
export { raw };`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { raw } from "./support/raw";
raw("uses a raw fixture alias", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // Specs nested under support are scenarios too and cannot register bare
      // Playwright under the support-directory exception.
      filename: "tests/acceptance/support/runtime.spec.ts",
      code: `import { test } from "@playwright/test";
test("uses bare Playwright", { tag: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { db } from "../../../packages/convex/confect/db";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import { model } from "../../../apps/web/src/features/records/model";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `test.skip("hidden", async () => {});
test.fixme(true, "hidden");
test.fail(true, "expected failure");
test.only("exclusive", async () => {});`,
      errors: [
        { messageId: "annotation" },
        { messageId: "annotation" },
        { messageId: "annotation" },
        { messageId: "annotation" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true } }));
await context.route("**/api/**", (route) => route.continue());
await route.fulfill({ json: { ok: true } });
await page.routeFromHAR("fixture.har");`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `await page.evaluate(() => localStorage.setItem("auth", "fake"));
await context.addInitScript(() => sessionStorage.setItem("auth", "fake"));`,
      errors: [{ messageId: "browser" }, { messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `const module = await import("./hidden-helper");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `vi.mock("product-module");`,
      errors: [{ messageId: "mock" }],
    },
    {
      // A support helper remains inside the acceptance tree and therefore
      // cannot launder a product import through the audited proxy exception.
      filename: ACCEPTANCE_SUPPORT,
      code: `import { model } from "../../../apps/web/src/features/records/model";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true } }));`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const goto = page.goto;
await goto.call(page, "data:text/html,<h1>Record</h1>");
Reflect.apply(context.route, context, ["**/*", handler]);
const proxy = new Proxy(route, {});
await proxy.fulfill({ body: "<h1>canned</h1>" });`,
      errors: [
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
export const test = base;`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
export const raw = base;`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // A canonical extended fixture cannot also export bare Playwright.
      // The paired scenario below uses this extra binding with dynamic options.
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { expect, test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({
  runtime: [async ({}, use) => {
    const controller = createContractsRuntimeController();
    const runtime = await controller.start();
    try { await use(runtime); } finally { await controller.stop(); }
  }, { scope: "worker", auto: true }],
});
export { expect };
export const unsafeTest = base;`,
      errors: [{ messageId: "fixture" }, { messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({
  runtime: [async ({}, use) => {
    const controller = createContractsRuntimeController();
    const runtime = await controller.start();
    try { await use(runtime); } finally { await controller.stop(); }
  }, { scope: "worker", auto: true }],
});
export default base;`,
      errors: [{ messageId: "fixture" }, { messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({
  runtime: [async ({}, use) => {
    const controller = createContractsRuntimeController();
    const runtime = await controller.start();
    try { await use(runtime); } finally { await controller.stop(); }
  }, { scope: "worker", auto: true }],
});
export * from "./runtime";`,
      errors: [{ messageId: "fixture" }, { messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { unsafeTest } from "./support/fixtures";
const options = { tag: "@BHV-REC-001-R1" };
unsafeTest("uses bare Playwright", options, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({ runtime: [async ({}, use) => { await use(undefined); }, { scope: "worker" }] });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({ runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); await use(undefined); }, { scope: "worker", auto: true }] });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({ runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); const other = createContractsRuntimeController(); await use(other.start()); }, { scope: "worker", auto: true }] });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
export const test = base.extend({ runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); await use(await controller.start()); await controller.stop(); }, { scope: "worker", auto: true }] });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
const override = {};
export const test = base.extend({ runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); const runtime = await controller.start(); try { await use(runtime); } finally { await controller.stop(); } }, { scope: "worker", auto: true }], ...override });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/raw.ts",
      code: `import * as raw from "@playwright/test"; export { raw };`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
const key = "runtime";
export const test = base.extend({
  runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); const runtime = await controller.start(); try { await use(runtime); } finally { await controller.stop(); } }, { scope: "worker", auto: true }],
  [key]: [async ({}, use) => use(undefined), { scope: "worker", auto: true }],
});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures"; test.extend({})("@BHV-REC-001-R1", async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const extend = test.extend;
const { extend: destructured } = test;
const computed = test["extend"];
test.extend({});`,
      errors: [
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
      ],
    },
    {
      // A parameter destructure can otherwise extract extend without a member
      // expression, then call the unstarted fixture as a tagged scenario.
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
(({ extend }) =>
  extend({
    runtime: [async ({}, use) => use(undefined), { scope: "worker", auto: true }],
  })("unstarted runtime", { tag: "@BHV-REC-001-R1" }, async () => {}))(test);`,
      errors: [{ messageId: "fixture" }],
    },
    {
      // Object-pattern extraction is forbidden in parameters and assignments,
      // not only in a variable declarator.
      filename: ACCEPTANCE_SUPPORT,
      code: `const extractControls = ({ continue: redirect, fallback, abort, fulfill }) => undefined;
({ continue: assignedRedirect, fulfill: assignedFulfill } = route);`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
      ],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const method = "continue";
const redirect = route[method];
await redirect({ url: targetUrl });`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const pageMethod = "evaluate";
const evaluate = page[pageMethod];
await evaluate(() => undefined);
const contextMethod = "route";
const intercept = context[contextMethod];
await intercept("**/*", handler);
const routeMethod = "fulfill";
const fulfill = route[routeMethod];
await fulfill({ status: 200 });
const testMethod = "describe";
const suite = test[testMethod];
suite.configure({ retries: 1 });`,
      errors: [
        { messageId: "browser" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "annotation" },
      ],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const method = "continue";
({ [method]: redirect } = route);
await redirect({ url: targetUrl });`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const fetch = route.fetch;
const response = await fetch({ url: targetUrl });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const { fetch } = route;
const response = await fetch({ url: targetUrl });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const response = await route.fetch({ url: arbitraryUrl });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const response = await route.fetch({ url: targetUrl, url: arbitraryUrl });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const response = await route.fetch({ url: targetUrl, "url": arbitraryUrl });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const response = await route.fetch({ ["url"]: targetUrl, ...overrides });
await route.fulfill({ response });`,
      errors: [{ messageId: "network" }, { messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_RUNTIME,
      code: `const response = await fetchResponse();
await route.fulfill({ response });`,
      errors: [{ messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "@playwright/test"; test("title", { tag: ["@BHV-REC-001-R1"] }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "@playwright/test"; test("title", { ["tag"]: "@BHV-REC-001-R1" }, async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "@playwright/test"; test("record @BHV-REC-001-R1 appears", async () => {});`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures"; test.use({ storageState: "state.json" });`,
      errors: [{ messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const options = { contextOptions: { storageState: "state.json" } };
test.use({ contextOptions: { storageState: "state.json" } });
test.use(options);`,
      errors: [{ messageId: "browser" }, { messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `const options = { storageState: "state.json" };
await browser.newContext(options);
await browser.newPage({ storageState: "state.json" });`,
      errors: [{ messageId: "browser" }, { messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `const createContext = runtime.browser.newContext;
const createPage = context["newPage"];
await createContext();
await createPage();`,
      errors: [{ messageId: "browser" }, { messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `await page.context().addCookies([]);`,
      errors: [{ messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `await page.waitForFunction(() => true);
await page.evaluateHandle(() => true);
await page.addScriptTag({ content: "window.injected = true" });
await context.newCDPSession(page);`,
      errors: [
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
        { messageId: "browser" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `Function("return import('x')")(); new Function("return 1"); eval("1");`,
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `const direct = eval;
const constructor = globalThis.Function;
const asyncConstructor = global["AsyncFunction"];
constructor("return import('x')")();`,
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `const root = globalThis;
const chained = root;
let assigned;
assigned = chained;
const make = assigned["Fun" + "ction"];
make("return 1")();`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import vm from "node:vm";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { writeFileSync } from "node:fs";
import { test } from "./support/fixtures";
writeFileSync("apps/web/src/routes/records.tsx", "/* canned product */");
test("poisoned runtime @BHV-REC-001-R1", async ({ runtime }) => {
  void runtime;
});`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import * as nodeModule from "node:module"; nodeModule["create" + "Require"](import.meta.url);`,
      errors: [{ messageId: "import" }, { messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test(
  "cannot replace runtime commands @BHV-REC-001-R1",
  { tag: "@BHV-REC-001-R1" },
  async ({ runtime, scenario, acceptancePage }) => {
    let calls = 0;
    Object.assign(runtime, {
      runCli: async () => {
        calls += 1;
        if (calls === 1) throw new Error("API_KEY_WORKSPACE_MISMATCH");
        return JSON.stringify({ result: [] });
      },
    });
    scenario = { workspaceId: "canned" };
    runtime.runCli = async () => undefined;
    const runtimeAlias = runtime;
    let chainedAlias;
    chainedAlias = runtimeAlias;
    chainedAlias.webUrl = "http://canned.invalid";
    delete scenario.workspaceId;
    acceptancePage.requestCount++;
    Object["define" + "Property"](runtimeAlias, "runCli", {
      value: async () => undefined,
    });
    Object.defineProperties(scenario, { workspaceId: { value: "canned" } });
    Object.setPrototypeOf(acceptancePage, {});
  },
);`,
      errors: [
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
        { messageId: "fixture" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `const { getBuiltinModule: builtin } = globalThis.process;
const processAlias = globalThis.process;
const { ["getBuiltin" + "Module"]: aliasedBuiltin } = processAlias;
const { createRequire: makeRequire } = builtin("node:module");
void aliasedBuiltin;
const load = makeRequire(import.meta.url);
const productInternals = load(
  "../../../../../../apps/web/src/features/records/records-surface",
);
void productInternals;`,
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `const { process: processAlias, ...globalRest } = globalThis;
const { ["getBuiltin" + "Module"]: builtin, ...processRest } = processAlias;
const { ["create" + "Require"]: makeRequire } = builtin("node:module");
const load = makeRequire(import.meta.url);
const product = load("../../../../apps/web/src/features/records/records-surface");
void globalRest;
void processRest;
void product;`,
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";

const builtin = globalThis.process.getBuiltinModule("node:module");
const create = builtin["create" + "Require"];
const load = create(import.meta.url);
const product = load("../../apps/web/src/adapters/records/http");
const root = globalThis;
let proc;
proc = root["pro" + "cess"];
proc["getBuiltin" + "Module"]("node:module");

test(
  "bypass @BHV-REC-001-R1",
  { tag: "@BHV-REC-001-R1" },
  async ({ acceptancePage: page, runtime }) => {
    void product;
    await page.goto(\`\${runtime.webUrl}/records\`);
  },
);`,
      errors: [
        { messageId: "import" },
        { messageId: "import" },
        { messageId: "import" },
      ],
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import { defineConfig } from "@playwright/test"; export default defineConfig({ globalSetup: "./setup" });`,
      errors: [{ messageId: "config" }],
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import { defineConfig } from "@playwright/test"; export default defineConfig({ webServer: {}, testDir: "./tests/acceptance" });`,
      errors: [{ messageId: "config" }],
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import { defineConfig } from "@playwright/test"; const hidden = { globalTeardown: "./teardown" }; export default defineConfig({ ...hidden });`,
      errors: [{ messageId: "config" }],
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import { defineConfig } from "@playwright/test"; export default defineConfig({ testDir: "./tests/acceptance", testMatch: "**/*.spec.ts", forbidOnly: true, retries: 0, workers: 1, fullyParallel: false, repeatEach: 1, testIgnore: [], projects: [{ name: "acceptance-chromium", dependencies: ["other"], teardown: "cleanup", use: { browserName: "chromium", storageState: "state.json" } }] });`,
      errors: [{ messageId: "config" }],
    },
    {
      filename: "playwright.acceptance.config.ts",
      code: `import "./side-effect";
import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/acceptance", testMatch: "**/*.spec.ts", forbidOnly: true, retries: 0, workers: 1, fullyParallel: false, repeatEach: 1, testIgnore: [], projects: [{ name: "acceptance-chromium", use: { browserName: "chromium" } }] });`,
      errors: [{ messageId: "config" }],
    },
    {
      filename: "tests/acceptance/support/fixtures.ts",
      code: `import { test as base } from "@playwright/test";
import { createContractsRuntimeController } from "./runtime";
const override = { auto: false };
export const test = base.extend({ runtime: [async ({}, use) => { const controller = createContractsRuntimeController(); const runtime = await controller.start(); try { await use(runtime); } finally { await controller.stop(); } }, { scope: "worker", auto: true, ...override }] });`,
      errors: [{ messageId: "fixture" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures"; await browser.newContext({ storageState: "state.json" });`,
      errors: [{ messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures"; const injected = { storageState: "state.json" }; test.use({ ...injected });`,
      errors: [{ messageId: "browser" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await route.fulfill({ json: { ok: true } });`,
      errors: [{ messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await route.fulfill({ status: 502 });`,
      errors: [{ messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await route.fulfill({ status: 200, body: "ok" });`,
      errors: [{ messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await route.fulfill({ body: "ok" });`,
      errors: [{ messageId: "synthetic" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `await import("./runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `const load = require; load("./support/runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `module.require("./support/runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_SUPPORT,
      code: `require["resolve"]("./runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { createRequire } from "node:module";
const load = createRequire(import.meta.url);`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import load = require("./support/runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `const pageAlias = page;
pageAlias.route("**/api/**", handler);`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: SEED_SUPPORT,
      code: `browser.route("**/api/**", handler);`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `fixture.context.route("**/api/**", handler);`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: SEED_SUPPORT,
      code: `context.routeFromHAR("fixture.har");`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE,
      code: `await page.routeWebSocket("**/socket", (route) => route.connectToServer());`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `page[method]("**/api/**", handler);`,
      errors: [{ messageId: "network" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { runtime } from "./support/../../apps/web/src/runtime";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `export { runtime } from "./support/../../apps/web/src/runtime";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `export * from "./../../apps/web/src/runtime";`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `const runtime = require("./support/../../apps/web/src/runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `const runtime = require(moduleName);`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `const runtime = await import(moduleName);`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import runtime = require("./support/../../apps/web/src/runtime");`,
      errors: [{ messageId: "import" }],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const scenario = test;
const journey = scenario;
scenario["skip"]("hidden", async () => {});
journey.describe.skip("hidden", async () => {});
journey["only"]("exclusive", async () => {});`,
      errors: [
        { messageId: "annotation" },
        { messageId: "annotation" },
        { messageId: "annotation" },
      ],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const scenario = test;
const browser = scenario;
await browser["route"]("**/api/**", handler);
await browser["evaluate"](fn);
browser["mock"]("product");`,
      errors: [
        { messageId: "network" },
        { messageId: "browser" },
        { messageId: "mock" },
      ],
    },
    {
      filename: ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
const { skip } = test;
skip("hidden", async () => {});`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: ACCEPTANCE_SUPPORT,
      code: `const extracted = context.route;
assigned = context.route;
await context.foo.route("**/api/**", handler);
await context.route.call(context, "**/api/**", handler);
await page.evaluate.call(page, fn);
await route.fulfill.call(route, { response });
await route.foo.fulfill({ response });
await context["route"]("**/api/**", handler);
await route["fulfill"]({ response });`,
      errors: [
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "network" },
        { messageId: "browser" },
        { messageId: "synthetic" },
        { messageId: "synthetic" },
        { messageId: "network" },
        { messageId: "synthetic" },
      ],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import { test } from "./support/fixtures";
test[method]("hidden", async () => {});`,
      errors: [{ messageId: "annotation" }],
    },
    {
      filename: SEED_ACCEPTANCE,
      code: `import { describe } from "vitest"; describe("hidden", () => undefined);`,
      errors: [{ messageId: "import" }],
    },
  ],
});

tester.run("saas-ui-shell-authority", shellAuthority, {
  valid: [
    {
      filename: "apps/web/src/features/common/components/app-sidebar.tsx",
      code: "import { Sidebar } from '@saas-ui/react'; export const AppSidebar = Sidebar;",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "import { AppShell } from '@saas-ui/react'; export const Orders = AppShell;",
      errors: [{ messageId: "shellOnly" }],
    },
  ],
});

tester.run("prefer-saas-ui-primitives", officialPrimitives, {
  valid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "import { Button } from '@saas-ui/react'; export const Save = Button;",
    },
    {
      filename:
        "apps/web/src/features/generatedFeatureSmoke/generated-feature-smoke-feature.tsx",
      code: "export const Upload = () => <input type='file' aria-label='Upload' />;",
    },
    {
      filename:
        "apps/web/src/features/generatedFeatureSmoke/generated-feature-smoke-feature.tsx",
      code: "export const Choice = () => <input type='checkbox' aria-label='Choose' />;",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "import { Button } from './button'; export const Save = Button;",
      errors: [{ messageId: "officialPrimitive" }],
    },
    {
      filename:
        "apps/web/src/features/generatedFeatureSmoke/generated-feature-smoke-feature.tsx",
      code: "export const Status = () => <select><option>Active</option></select>;",
      errors: [{ messageId: "officialPrimitive" }],
    },
    {
      filename:
        "apps/web/src/features/generatedFeatureSmoke/generated-feature-smoke-feature.tsx",
      code: "export const Upload = () => <input type='file' />;",
      errors: [{ messageId: "officialPrimitive" }],
    },
    {
      filename:
        "apps/web/src/features/generatedFeatureSmoke/generated-feature-smoke-feature.tsx",
      code: "export const Choice = ({ label }) => <input type='checkbox' aria-label={label} />;",
      errors: [{ messageId: "officialPrimitive" }],
    },
  ],
});

tester.run("saas-ui-semantic-colors", semanticColors, {
  valid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "export const Orders = () => <Box color='fg.muted' />;",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "export const Orders = () => <Box color='#123456' />;",
      errors: [{ messageId: "semanticColor" }],
    },
  ],
});
