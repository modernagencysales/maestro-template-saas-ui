/**
 * workflow-policy-snapshot — a workflow pins a policy snapshot at kickoff and
 * reads ONLY version-pinned ids thereafter; it must NEVER read latest-active
 * mid-run. Mixing policy versions across the steps of one long-running artifact
 * is the bug this forbids: the version that produced step 1 must produce step N.
 * The latest-active resolver is `getPolicy` (the policy read layer); the
 * version-pinned read is `getPolicyVersion` (the only legal workflow access —
 * it reads an exact id the workflow carried from kickoff in its args).
 *
 * SCOPE — files under packages/convex/confect/workflows/** (NOT tests). The
 * policy resolver pair does not exist in this repo yet (intended home:
 * packages/convex/confect/policy/**), so this is a forward-guard for the naming
 * convention it enforces.
 *
 * WHAT IT FLAGS — any reference to the EXACT identifier `getPolicy`:
 *   - an import specifier importing `getPolicy` (in any form: `{ getPolicy }`,
 *     `{ getPolicy as g }`, the ES2022 string form `{ "getPolicy" as g }`);
 *   - a RE-EXPORT of `getPolicy` from another module (`export { getPolicy } from
 *     "…"`, `export { getPolicy as readLive } from "…"`, `export * from "…"`) —
 *     laundering: the re-export renames the symbol, so a downstream import sees a
 *     name the import/call arms can't recognize; caught here at the source name;
 *   - a call whose callee is `getPolicy` (`getPolicy(ctx, …)`) or a member call
 *     `x.getPolicy(…)`.
 * `getPolicyVersion` (and any other `getPolicy*` name) is NOT flagged — the match
 * is the exact name, never a prefix, so the one legal pinned read stays legal.
 *
 * NOTE — unlike the upstream rule, `.spec.` files are NOT exempt here: in this
 * repo `*.spec.ts` files are confect function specs (production code), not tests.
 *
 * Message: workflows pin policy at kickoff and read version-pinned ids via
 * getPolicyVersion. Allowlist-as-code (no options).
 */

const WORKFLOWS_RE =
  /(?:^|\/)packages\/convex\/(?:confect\/(?:workflows|workflowRunners)|convex\/workflowRunners)\//;

// The exact banned name — the latest-active resolver. Matched by identity, never
// as a prefix, so `getPolicyVersion` / `getPolicyInWorkspace` are unaffected.
const BANNED = "getPolicy";

/** The local name of an import/export specifier in identifier or ES2022 string
 * form (`{ getPolicy }` and `{ "getPolicy" as g }` both resolve to "getPolicy"). */
function specifierName(node) {
  if (node.type === "Identifier") return node.name;
  return typeof node.value === "string" ? node.value : null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Workflows read version-pinned policy ids (getPolicyVersion), never latest-active (getPolicy)",
    },
    schema: [],
    messages: {
      latestInWorkflow:
        "Workflows pin policy at kickoff and read version-pinned ids via getPolicyVersion — getPolicy (latest-active) mid-run mixes versions across one artifact.",
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
      context.report({ node, messageId: "latestInWorkflow" });

    return {
      // Importing the latest-active resolver into a workflow — banned at the door.
      // The IMPORTED name is what's checked (a local alias does not launder it).
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          if (specifierName(spec.imported) === BANNED) report(spec);
        }
      },

      // Re-exporting getPolicy from another module is laundering — a downstream
      // import then sees a renamed symbol the arms above can't match. Only a
      // re-export (node.source present) is the laundering shape; a bare
      // `export { getPolicy }` of a local binding is caught by the import arm.
      // The LOCAL/source name is the re-exported symbol; type-only is erased.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.exportKind === "type") return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ExportSpecifier" || spec.exportKind === "type") {
            continue;
          }
          if (specifierName(spec.local) === BANNED) report(spec);
        }
      },

      // `export * from "../policy/read"` re-exports getPolicy wholesale.
      // Barrel exports are already discouraged repo-wide; belt and suspenders.
      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        report(node);
      },

      // Calling getPolicy(…) directly, or x.getPolicy(…) as a member call.
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === "Identifier" && callee.name === BANNED) {
          report(callee);
          return;
        }
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === BANNED
        ) {
          report(callee.property);
        }
      },
    };
  },
};
