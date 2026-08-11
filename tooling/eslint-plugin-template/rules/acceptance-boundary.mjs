const ACCEPTANCE_FILE = /(?:^|\/)tests\/acceptance\//u;
const SUPPORT_FILE = /(?:^|\/)tests\/acceptance\/support\//u;
const ALLOWED_IMPORT = (source) =>
  source === "@playwright/test" ||
  source.startsWith("node:") ||
  source.startsWith("./support/");

const memberName = (node) => {
  if (node.type !== "MemberExpression" || node.computed) return undefined;
  return node.property.type === "Identifier" ? node.property.name : undefined;
};

const memberObject = (node) =>
  node.type === "MemberExpression" &&
  !node.computed &&
  node.object.type === "Identifier"
    ? node.object.name
    : undefined;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep Playwright acceptance tests black-box and forbid hidden or non-deterministic execution paths",
    },
    schema: [],
    messages: {
      import:
        "Acceptance tests may import only @playwright/test, node:* modules, or ./support/* helpers; keep product modules behind the black-box UI boundary.",
      annotation:
        "Acceptance tests must not use test.skip, test.fixme, test.fail, or test.only; required journeys must execute normally.",
      network:
        "Acceptance scenarios must not intercept or fulfill application network traffic; keep the audited proxy limited to support helpers.",
      browser:
        "Acceptance tests must not seed browser storage or alter page initialization; observe the real application boundary.",
      mock: "Acceptance tests must not mock product modules or providers.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/gu,
      "/",
    );
    if (!ACCEPTANCE_FILE.test(filename)) return {};
    const support = SUPPORT_FILE.test(filename);

    return {
      ImportDeclaration(node) {
        if (!ALLOWED_IMPORT(String(node.source.value)))
          context.report({ node: node.source, messageId: "import" });
      },
      ImportExpression(node) {
        context.report({ node, messageId: "import" });
      },
      CallExpression(node) {
        const object = memberObject(node.callee);
        const property = memberName(node.callee);
        if (
          object === "test" &&
          new Set(["skip", "fixme", "fail", "only"]).has(property)
        ) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (object === "vi" && property === "mock") {
          context.report({ node: node.callee, messageId: "mock" });
          return;
        }
        if (
          (object === "context" && property === "route") ||
          (object === "route" && property === "fulfill")
        ) {
          if (!support)
            context.report({ node: node.callee, messageId: "network" });
          return;
        }
        if (
          (object === "page" &&
            new Set(["route", "routeFromHAR"]).has(property)) ||
          (object === "context" && property === "routeFromHAR")
        ) {
          context.report({ node: node.callee, messageId: "network" });
          return;
        }
        if (
          (object === "page" && property === "evaluate") ||
          (object === "context" && property === "addInitScript")
        ) {
          context.report({ node: node.callee, messageId: "browser" });
        }
      },
    };
  },
};
