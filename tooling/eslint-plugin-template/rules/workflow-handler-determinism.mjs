/**
 * workflow-handler-determinism — orchestration has one door, and the workflow
 * door has a hard constraint: the handler must be REPLAY-DETERMINISTIC.
 * @convex-dev/workflow re-executes the handler on every resume, replaying
 * journaled step results. The pinned component normalizes core `Date` and
 * seeds `Math.random`; ambient IO, database, scheduler, environment, crypto,
 * and locale/timezone-sensitive formatting remain forbidden. External work belongs in a STEP (a
 * capability invoked via `step.*`) whose result is journaled and passed back in.
 *
 * SCOPE — files under packages/convex/confect/workflows/** (NOT tests). Durable
 * `defineWorkflow` handlers do not exist in this repo yet, so this is a
 * forward-guard: its value is the RuleTester proof and that future workflow
 * handlers pass it.
 *
 * WHAT IT FLAGS — inside the function passed to `defineWorkflow(…).handler(<fn>)`
 * (the callee is a member `.handler` whose object is a `defineWorkflow(…)` call):
 *   - `crypto.randomUUID` (member or call) — ambient randomness;
 *   - `Intl.*` and `Date#toLocale*` — locale/timezone-dependent formatting;
 *   - `fetch(…)` (bare or member) — IO;
 *   - `ctx.db` (any `.db` member access) — a db read/write;
 *   - `ctx.scheduler` (any `.scheduler` member access) — a scheduler hop
 *     (also no-raw-scheduler, here scoped to the handler's determinism contract);
 *   - `process.env` (any `.env` member access on `process`) — env access.
 * Only `step.*` calls + pure computation survive — the handler journals step
 * results, never reads the world directly. Tokens OUTSIDE the handler (e.g. in
 * the kickoff mutation in the same file) are untouched: the kickoff is a normal
 * mutation, not a replayed body. `fetch` is matched both as a bare identifier
 * call AND as a `.fetch` member on any receiver (`globalThis.fetch`,
 * `window.fetch`), mirroring how `.db`/`.scheduler` are matched property-name-only.
 *
 * KNOWN BOUNDARY — value-aliasing a banned source is NOT tracked: a local
 * `const n = Date; n.now()` or `const f = fetch; f(…)` slips. Defeating these
 * needs dataflow analysis the repo's rules deliberately don't do; a local
 * value-alias is a documented edge, not a surprise.
 *
 * NOTE — unlike the upstream rule, `.spec.` files are NOT exempt here: in this
 * repo `*.spec.ts` files are confect function specs (production code), not tests.
 *
 * Core `Date` and seeded `Math.random` are deliberately allowed because the
 * pinned upstream runtime patches them. There is no per-project allowlist.
 */

const WORKFLOWS_RE =
  /(?:^|\/)packages\/convex\/(?:confect\/(?:workflows|workflowRunners)|convex\/workflowRunners)\//;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Workflow handlers use normalized Date/random and forbid ambient IO/db/env/crypto/locale effects",
    },
    schema: [],
    messages: {
      nondeterministic:
        "Workflow handlers must be replay-deterministic — use normalized Date/seeded random only; move IO/db/env/crypto/locale-sensitive work to a capability step.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    if (!WORKFLOWS_RE.test(filename)) return {};
    if (filename.includes(".test.") || filename.includes("/__tests__/")) {
      return {};
    }
    const report = (node) =>
      context.report({ node, messageId: "nondeterministic" });

    return {
      // The handler fn is the argument to `defineWorkflow(…).handler(<fn>)`.
      // Scan its whole subtree (nested callbacks inside the handler — e.g. a
      // `.map()` — still run at replay time, so a banned token anywhere under
      // the handler breaks determinism).
      CallExpression(node) {
        const fn = handlerFnOf(node);
        if (fn === null) return;
        scanForBanned(fn.body ?? fn, report);
      },
    };
  },
};

/**
 * If `node` is a `defineWorkflow(…).handler(<fn>)` call, returns the handler
 * function node; else null. The callee must be a non-computed `.handler` member
 * whose object is itself a CallExpression to `defineWorkflow` (bare or member —
 * `defineWorkflow(…)` and `x.defineWorkflow(…)`), and the first argument must be
 * a function.
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

/** True if `node` is a call to `defineWorkflow` (bare `defineWorkflow(…)` or a
 * member `x.defineWorkflow(…)`). */
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

// ─── Banned-token scan ─────────────────────────────────────────────────────────

// `.db`, `.scheduler`, `.fetch` member accesses are banned by the accessed
// property name (on any receiver: ctx.db / ctx.scheduler / globalThis.fetch /
// window.fetch). `.fetch` here complements the bare-`fetch(…)` identifier check
// so `globalThis.fetch(…)` / `window.fetch(…)` don't slip — IO is IO whatever
// the receiver, exactly like the .db/.scheduler replay hazards.
const BANNED_MEMBERS = new Set(["db", "scheduler", "fetch"]);

/**
 * Walks the handler subtree reporting each replay-breaking token. Unlike the
 * other rules this DOES descend into nested functions — a callback inside the
 * handler runs during replay too, so its non-determinism is equally fatal.
 */
function scanForBanned(root, report) {
  walk(root, (node) => {
    if (isBannedToken(node)) report(node);
  });
}

/**
 * The replay-breaking shapes:
 *   - `crypto.randomUUID` — ambient randomness;
 *   - `new Intl.*` and `Intl.*` — locale/timezone-dependent behavior;
 *   - `.toLocaleString`, `.toLocaleDateString`, `.toLocaleTimeString`;
 *   - `fetch(…)` — a CallExpression to a bare `fetch`;
 *   - `process.env` — a non-computed `.env` member on a `process` identifier;
 *   - any `.db` / `.scheduler` / `.fetch` member access (db read / scheduler hop
 *     / `globalThis.fetch`-style IO).
 */
function isBannedToken(node) {
  if (node.type === "NewExpression") {
    return isIntlMember(node.callee);
  }
  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "fetch"
  ) {
    return true;
  }
  if (node.type !== "MemberExpression" || node.computed) return false;
  if (node.property.type !== "Identifier") return false;
  const prop = node.property.name;
  if (
    prop === "toLocaleString" ||
    prop === "toLocaleDateString" ||
    prop === "toLocaleTimeString"
  ) {
    return true;
  }
  // `.db` / `.scheduler` on any receiver — a db touch or scheduler hop.
  if (BANNED_MEMBERS.has(prop)) return true;
  // `process.env` — env access.
  if (
    prop === "env" &&
    node.object.type === "Identifier" &&
    node.object.name === "process"
  ) {
    return true;
  }
  if (isIntlMember(node)) {
    return !(
      node.parent?.type === "NewExpression" && node.parent.callee === node
    );
  }
  return (
    node.object.type === "Identifier" &&
    node.object.name === "crypto" &&
    prop === "randomUUID"
  );
}

/** True for a non-computed member rooted directly at the global `Intl`. */
function isIntlMember(node) {
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "Intl"
  );
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
