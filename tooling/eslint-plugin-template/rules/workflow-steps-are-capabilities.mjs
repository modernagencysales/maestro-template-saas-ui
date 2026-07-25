/**
 * workflow-steps-are-capabilities — a workflow is a thin COMPOSITION of
 * building blocks, and the building-block library is `capabilities/`. Every step
 * a workflow handler runs must call a capability:
 *   `step.run{Query,Mutation,Action}(internal.capabilities.<domain>.<verb>, …)`.
 * A step that targets another layer (`internal.adapters.*`, `internal.workflows.*`,
 * `internal.agents.*`, `internal.policy.*`) or a non-literal ref breaks the law —
 * adapters and other layers are reached THROUGH a capability, never wired into a
 * workflow directly. The payoff: a workflow reads top-to-bottom as a list of named
 * capability steps you can audit at a glance, and every step is an independently
 * testable / evaluable function in its right place (the prototype anti-pattern was
 * steps scattered across helper modules and logic buried in god-files).
 *
 * SCOPE — files under packages/convex/confect/workflows/** (NOT tests). Durable
 * `defineWorkflow` handlers do not exist in this repo yet, so this is largely a
 * forward-guard: its value is the RuleTester proof and that future workflow
 * templates compose capabilities. Pairs with workflow-handler-determinism
 * (which bans IO/db/time IN the handler) — that rule says "do effectful work in
 * a step", this one says "a step IS a capability".
 *
 * WHAT IT FLAGS — inside `defineWorkflow(…).handler(<fn>)` (callee is a `.handler`
 * member whose object is a `defineWorkflow(…)` call): any call whose callee is a
 * non-computed `.runQuery` / `.runMutation` / `.runAction` member (the step object,
 * any receiver), whose FIRST argument is not a member chain rooted at
 * `internal.capabilities.` (e.g. `internal.capabilities.brief.run`).
 *
 * KNOWN BOUNDARY — value-aliasing is not tracked: `const ref =
 * internal.capabilities.x.y; step.runQuery(ref)` slips, exactly like the
 * determinism rule's documented alias edge. Pass the `internal.capabilities.*`
 * reference directly — that is also what makes the step auditable.
 *
 * NOTE — unlike the upstream rule, `.spec.` files are NOT exempt here: in this
 * repo `*.spec.ts` files are confect function specs (production code), not tests.
 *
 * Allowlist-as-code: the graph interpreter (runGraph.ts) is exempt — it is the
 * one seam that dispatches steps dynamically by design. No per-project knob
 * beyond that.
 */

const WORKFLOWS_RE =
  /(?:^|\/)packages\/convex\/(?:confect\/(?:workflows|workflowRunners)|convex\/workflowRunners)\//;
const STEP_RUNNERS = new Set(["runQuery", "runMutation", "runAction"]);
const INTERPRETER_FILES = new Set([
  "packages/convex/confect/workflows/runGraph.ts",
]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Workflow steps call capabilities — step.run*(internal.capabilities.<domain>.<verb>, …)",
    },
    schema: [],
    messages: {
      notCapability:
        "A workflow step must call a capability from the building-block library — step.run*(internal.capabilities.<domain>.<verb>, …). Reach adapters/other layers THROUGH a capability so every step is an auditable, testable, evaluable building block in its right place.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    if (!WORKFLOWS_RE.test(filename)) return {};
    const isInterpreter = [...INTERPRETER_FILES].some(
      (path) => filename === path || filename.endsWith(`/${path}`),
    );
    if (isInterpreter) return {};
    if (filename.includes(".test.") || filename.includes("/__tests__/")) {
      return {};
    }
    const report = (node) =>
      context.report({ node, messageId: "notCapability" });

    return {
      // The handler fn is the argument to `defineWorkflow(…).handler(<fn>)`. Scan
      // its whole subtree (a step call nested in a `.map`/branch still runs at
      // replay time and must still target a capability).
      CallExpression(node) {
        const fn = handlerFnOf(node);
        if (fn === null) return;
        scanForSteps(fn.body ?? fn, report);
      },
    };
  },
};

/**
 * If `node` is a `defineWorkflow(…).handler(<fn>)` call, returns the handler
 * function node; else null. (Mirrors workflow-handler-determinism so both rules
 * agree on exactly which subtree is "the handler".)
 */
function handlerFnOf(node) {
  const callee = node.callee;
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier" ||
    callee.property.name !== "handler"
  ) {
    return null;
  }
  if (!isDefineWorkflowCall(callee.object)) return null;
  const fn = node.arguments[0];
  if (
    fn === undefined ||
    (fn.type !== "ArrowFunctionExpression" && fn.type !== "FunctionExpression")
  ) {
    return null;
  }
  return fn;
}

/** True if `node` is a call to `defineWorkflow` (bare or `x.defineWorkflow(…)`). */
function isDefineWorkflowCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type === "Identifier")
    return (
      callee.name === "defineWorkflow" ||
      callee.name === "defineMaestroWorkflow"
    );
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    (callee.property.name === "defineWorkflow" ||
      callee.property.name === "defineMaestroWorkflow")
  );
}

/** Walks the handler subtree; for every `<step>.run{Query,Mutation,Action}(…)`
 * call, checks the first argument is an `internal.capabilities.*` reference. */
function scanForSteps(root, report) {
  walk(root, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    if (
      callee.type !== "MemberExpression" ||
      callee.computed ||
      callee.property.type !== "Identifier" ||
      !STEP_RUNNERS.has(callee.property.name)
    ) {
      return;
    }
    if (!isCapabilityRef(node.arguments[0])) report(node);
  });
}

/**
 * True iff `arg` is a member chain rooted at `internal.capabilities.` — e.g.
 * `internal.capabilities.brief.run`. A non-member first arg (a variable, a
 * call) or a chain rooted anywhere else (`internal.adapters.x`,
 * `internal.workflows.x`, `components.x`) is not a capability reference.
 */
function isCapabilityRef(arg) {
  if (arg === undefined || arg.type !== "MemberExpression") return false;
  const segments = memberSegments(arg);
  return (
    segments !== null &&
    segments[0] === "internal" &&
    segments[1] === "capabilities"
  );
}

/**
 * Flattens a non-computed member chain to its identifier segments, base-first:
 * `internal.capabilities.brief.run` → ["internal","capabilities","brief","run"].
 * Returns null if the chain is computed or not rooted at a bare identifier.
 */
function memberSegments(node) {
  const out = [];
  let cur = node;
  while (cur.type === "MemberExpression") {
    if (cur.computed || cur.property.type !== "Identifier") return null;
    out.unshift(cur.property.name);
    cur = cur.object;
  }
  if (cur.type !== "Identifier") return null;
  out.unshift(cur.name);
  return out;
}

/** Depth-first visit of every node under `root` (including nested functions —
 * replay re-runs them). Skips `parent` to avoid cycles. */
function walk(root, visit) {
  if (root === null || typeof root.type !== "string") return;
  visit(root);
  for (const key of Object.keys(root)) {
    if (key === "parent") continue;
    const value = root[key];
    if (Array.isArray(value)) {
      for (const el of value) {
        if (
          el !== null &&
          typeof el === "object" &&
          typeof el.type === "string"
        )
          walk(el, visit);
      }
    } else if (
      value !== null &&
      typeof value === "object" &&
      typeof value.type === "string"
    ) {
      walk(value, visit);
    }
  }
}
