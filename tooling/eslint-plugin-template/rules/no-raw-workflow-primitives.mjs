const RAW_WORKFLOW = "@convex-dev/workflow";
const RAW_IMPORT_BOUNDARY =
  /packages\/convex\/confect\/workflows\/_kit\/(?:defineMaestroWorkflow|ownership|status)\.ts$/;
const MANAGER_CONSTRUCTION_BOUNDARY =
  /packages\/convex\/confect\/workflows\/_kit\/defineMaestroWorkflow\.ts$/;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Raw Convex Workflow primitives stay behind generated runners and compatibility fixtures",
    },
    schema: [],
    messages: {
      raw: "WF-RAW-IMPORT: use the generated workflow kit; raw @convex-dev/workflow imports are path-exact and have no inline escape. Rerun pnpm check:workflow:fast.",
      manager:
        "WF-RAW-MANAGER: use the generated WorkflowManager boundary; application code cannot instantiate a second manager. Rerun pnpm check:workflow:fast.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    const rawImportAllowed = RAW_IMPORT_BOUNDARY.test(filename);
    const managerConstructionAllowed =
      MANAGER_CONSTRUCTION_BOUNDARY.test(filename);
    return {
      ImportDeclaration(node) {
        if (!rawImportAllowed && node.source.value === RAW_WORKFLOW) {
          context.report({ node, messageId: "raw" });
        }
      },
      NewExpression(node) {
        if (
          !managerConstructionAllowed &&
          node.callee.type === "Identifier" &&
          node.callee.name === "WorkflowManager"
        ) {
          context.report({ node, messageId: "manager" });
        }
      },
    };
  },
};
