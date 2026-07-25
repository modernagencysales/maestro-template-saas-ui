const RAW_WORKFLOW = "@convex-dev/workflow";
const GENERATED_RUNNER =
  /packages\/convex\/confect\/workflowRunners\/[A-Za-z][A-Za-z0-9]*\.ts$/;
const COMPATIBILITY_FIXTURE =
  /packages\/convex\/test\/workflow-conformance(?:-helpers)?\.test\.ts$/;
const WORKFLOW_KIT =
  /packages\/convex\/confect\/workflows\/_kit\/(?:ownership|status)\.ts$/;

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
    const allowed =
      GENERATED_RUNNER.test(filename) ||
      COMPATIBILITY_FIXTURE.test(filename) ||
      WORKFLOW_KIT.test(filename);
    return {
      ImportDeclaration(node) {
        if (!allowed && node.source.value === RAW_WORKFLOW) {
          context.report({ node, messageId: "raw" });
        }
      },
      NewExpression(node) {
        if (
          !allowed &&
          node.callee.type === "Identifier" &&
          node.callee.name === "WorkflowManager"
        ) {
          context.report({ node, messageId: "manager" });
        }
      },
    };
  },
};
