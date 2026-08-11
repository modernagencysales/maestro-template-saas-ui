import { posix } from "node:path";

const ACCEPTANCE_MARKER = "tests/acceptance/";
const ALLOWED_IMPORT = new Set(["@playwright/test"]);
const ANNOTATIONS = new Set(["skip", "fixme", "fail", "only"]);
const NETWORK_APIS = new Set(["route", "routeFromHAR"]);
const BROWSER_APIS = new Set(["evaluate", "addInitScript"]);

const pathInfo = (filename) => {
  const normalized = filename.replace(/\\/gu, "/");
  const marker = normalized.lastIndexOf(ACCEPTANCE_MARKER);
  if (marker < 0) return undefined;
  const acceptanceRoot = normalized.slice(
    0,
    marker + ACCEPTANCE_MARKER.length - 1,
  );
  return {
    filename: normalized,
    supportRoot: `${acceptanceRoot}/support`,
  };
};

const inside = (root, target) =>
  target === root || target.startsWith(`${root}/`);

const relativeTarget = (filename, source) =>
  posix.normalize(posix.join(posix.dirname(filename), source));

const sourceAllowed = (info, source) => {
  if (source.startsWith("."))
    return inside(info.supportRoot, relativeTarget(info.filename, source));
  return source.startsWith("node:") || ALLOWED_IMPORT.has(source);
};

const propertyNames = (node) => {
  const names = [];
  let current = node;
  while (current?.type === "MemberExpression") {
    const property = current.property;
    if (property.type === "Identifier") names.unshift(property.name);
    else if (current.computed && property.type === "Literal") {
      if (typeof property.value === "string") names.unshift(property.value);
    }
    current = current.object;
  }
  return names;
};

const memberRoot = (node) => {
  let current = node;
  while (current?.type === "MemberExpression") current = current.object;
  return current?.type === "Identifier" ? current.name : undefined;
};

const objectProperty = (object, name) =>
  object.properties.find((property) => {
    if (property.type !== "Property") return false;
    const key = property.key;
    return (
      (key.type === "Identifier" && key.name === name) ||
      (key.type === "Literal" && key.value === name)
    );
  });

const literalValue = (property) => {
  const value = property?.value;
  return value?.type === "Literal" ? value.value : undefined;
};

const safeSupportFulfill = (node) => {
  const argument = node.arguments[0];
  if (!argument || argument.type !== "ObjectExpression") return false;
  if (objectProperty(argument, "json")) return false;
  const status = objectProperty(argument, "status");
  if (!status) return false;
  const statusValue = literalValue(status);
  if (typeof statusValue === "number") {
    if (statusValue < 400 || statusValue >= 600) return false;
    return !["body", "contentType"].some((name) => {
      const property = objectProperty(argument, name);
      return property !== undefined && literalValue(property) !== undefined;
    });
  }
  return (
    objectProperty(argument, "body") !== undefined &&
    objectProperty(argument, "contentType") !== undefined
  );
};

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
        "Acceptance tests may import only @playwright/test, node:* modules, or support helpers that resolve below tests/acceptance/support.",
      annotation:
        "Acceptance tests must not use test.skip, test.fixme, test.fail, or test.only; required journeys must execute normally.",
      network:
        "Acceptance scenarios must not intercept or fulfill application network traffic; keep the audited proxy limited to support helpers.",
      browser:
        "Acceptance tests must not seed browser storage or alter page initialization; observe the real application boundary.",
      mock: "Acceptance tests must not mock product modules or providers.",
      synthetic:
        "The audited support proxy may forward backend bytes or return an explicit failure; synthetic success responses are forbidden.",
    },
  },
  create(context) {
    const info = pathInfo(
      (context.filename ?? context.getFilename()).replace(/\\/gu, "/"),
    );
    if (!info) return {};
    const reportImport = (node, source) => {
      if (!sourceAllowed(info, source))
        context.report({ node, messageId: "import" });
    };
    const reportDynamic = (node) => {
      const source = node.source;
      if (source?.type === "Literal" && typeof source.value === "string")
        reportImport(source, source.value);
      else context.report({ node, messageId: "import" });
    };
    const reportMemberBypass = (node) => {
      const names = propertyNames(node);
      const property = names.at(-1);
      if (names.some((name) => ANNOTATIONS.has(name)))
        context.report({ node, messageId: "annotation" });
      else if (property === "mock") context.report({ node, messageId: "mock" });
      else if (property === "fulfill") {
        const support = inside(info.supportRoot, info.filename);
        if (!support) context.report({ node, messageId: "network" });
        else context.report({ node, messageId: "synthetic" });
      } else if (NETWORK_APIS.has(property)) {
        if (
          !inside(info.supportRoot, info.filename) ||
          (property === "route" && memberRoot(node) === "page")
        )
          context.report({ node, messageId: "network" });
      } else if (BROWSER_APIS.has(property))
        context.report({ node, messageId: "browser" });
    };
    return {
      ImportDeclaration(node) {
        reportImport(node.source, String(node.source.value));
      },
      ExportNamedDeclaration(node) {
        if (node.source) reportImport(node.source, String(node.source.value));
      },
      ExportAllDeclaration(node) {
        reportImport(node.source, String(node.source.value));
      },
      ImportExpression: reportDynamic,
      TSImportEqualsDeclaration(node) {
        const reference = node.moduleReference;
        const source =
          reference.type === "TSExternalModuleReference"
            ? reference.expression
            : undefined;
        if (source?.type === "Literal" && typeof source.value === "string")
          reportImport(source, source.value);
        else context.report({ node, messageId: "import" });
      },
      VariableDeclarator(node) {
        if (node.init?.type === "MemberExpression")
          reportMemberBypass(node.init);
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          const source = node.arguments[0];
          if (source?.type === "Literal" && typeof source.value === "string")
            reportImport(source, source.value);
          else context.report({ node, messageId: "import" });
          return;
        }
        if (node.callee.type !== "MemberExpression") return;
        const names = propertyNames(node.callee);
        const property = names.at(-1);
        if (names.some((name) => ANNOTATIONS.has(name))) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (property === "mock") {
          context.report({ node: node.callee, messageId: "mock" });
          return;
        }
        if (property === "fulfill") {
          const support = inside(info.supportRoot, info.filename);
          if (!support)
            context.report({ node: node.callee, messageId: "network" });
          else if (!safeSupportFulfill(node))
            context.report({ node: node.callee, messageId: "synthetic" });
          return;
        }
        if (NETWORK_APIS.has(property)) {
          if (
            !inside(info.supportRoot, info.filename) ||
            (property === "route" && memberRoot(node.callee) === "page")
          )
            context.report({ node: node.callee, messageId: "network" });
          return;
        }
        if (BROWSER_APIS.has(property))
          context.report({ node: node.callee, messageId: "browser" });
      },
    };
  },
};
