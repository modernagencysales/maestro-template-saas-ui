import { posix } from "node:path";

const ACCEPTANCE_MARKER = "tests/acceptance/";
const ALLOWED_IMPORT = new Set(["@playwright/test"]);
const ANNOTATIONS = new Set(["skip", "fixme", "fail", "only"]);
const NETWORK_APIS = new Set(["route", "routeFromHAR"]);
const BROWSER_APIS = new Set(["evaluate", "addInitScript", "setContent"]);
const BEHAVIOR_TAG = /^@BHV-[A-Z0-9]+-[0-9]+-R[1-9][0-9]*$/u;

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

const isScenarioSpec = (info) => /\.spec\.[cm]?[jt]sx?$/u.test(info.filename);

const isCanonicalFixturesModule = (info) =>
  new RegExp(`${info.supportRoot}/fixtures\\.[cm]?[jt]sx?$`, "u").test(
    info.filename,
  );

const isFixtureSource = (info, source) =>
  source.startsWith(".") &&
  relativeTarget(info.filename, source) === `${info.supportRoot}/fixtures`;

const sourceAllowed = (info, source) => {
  if (source.startsWith("."))
    return inside(info.supportRoot, relativeTarget(info.filename, source));
  return (
    source.startsWith("node:") ||
    (ALLOWED_IMPORT.has(source) && inside(info.supportRoot, info.filename))
  );
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
  if (current?.type === "ChainExpression") current = current.expression;
  while (current?.type === "MemberExpression") current = current.object;
  if (current?.type === "ChainExpression") current = current.expression;
  return current?.type === "Identifier" ? current.name : undefined;
};

const memberIsComputed = (node) => {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (current.computed) return true;
    current = current.object;
  }
  return false;
};

const memberIsOptional = (node) => {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (current.optional) return true;
    current = current.object;
  }
  return current?.type === "ChainExpression";
};

const isDirectMemberCall = (node, objectName, propertyName) => {
  const member = node.callee;
  return (
    member?.type === "MemberExpression" &&
    !node.optional &&
    !member.optional &&
    !memberIsComputed(member) &&
    member.object.type === "Identifier" &&
    member.object.name === objectName &&
    member.property.type === "Identifier" &&
    member.property.name === propertyName
  );
};

const isRuntimeWebUrl = (node) =>
  node?.type === "MemberExpression" &&
  !node.computed &&
  !node.optional &&
  node.object.type === "Identifier" &&
  node.object.name === "runtime" &&
  node.property.type === "Identifier" &&
  node.property.name === "webUrl";

const isRuntimeRootedNavigation = (node) => {
  const target = node.arguments[0];
  return (
    propertyNames(node.callee).includes("goto") &&
    target?.type === "TemplateLiteral" &&
    target.expressions.length === 1 &&
    target.quasis.length === 2 &&
    target.quasis[0]?.value.cooked === "" &&
    isRuntimeWebUrl(target.expressions[0]) &&
    (target.quasis[1]?.value.cooked === "" ||
      target.quasis[1]?.value.cooked?.startsWith("/"))
  );
};

const isTaggedScenarioRegistration = (node) => {
  if (node.callee.type !== "Identifier") return false;
  const title = node.arguments[0];
  const callback = node.arguments.at(-1);
  return (
    isFunction(callback) &&
    (isBehaviorTitle(title) || node.arguments.some(isBehaviorTagOptions))
  );
};

const isFunction = (node) =>
  node?.type === "ArrowFunctionExpression" ||
  node?.type === "FunctionExpression";

const literalText = (node) =>
  node?.type === "Literal" && typeof node.value === "string"
    ? node.value
    : node?.type === "TemplateLiteral" && node.expressions.length === 0
      ? node.quasis[0]?.value.cooked
      : undefined;

const isBehaviorTitle = (node) =>
  typeof literalText(node) === "string" && BEHAVIOR_TAG.test(literalText(node));

const isBehaviorTagOptions = (node) =>
  node?.type === "ObjectExpression" &&
  node.properties.some(
    (property) =>
      property.type === "Property" &&
      !property.computed &&
      ((property.key.type === "Identifier" && property.key.name === "tag") ||
        (property.key.type === "Literal" && property.key.value === "tag")) &&
      typeof literalText(property.value) === "string" &&
      BEHAVIOR_TAG.test(literalText(property.value)),
  );

const resolveVariable = (identifier, sourceCode) => {
  for (
    let scope = sourceCode.getScope(identifier);
    scope;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    if (variable) return variable;
  }
  return null;
};

const isCanonicalFixtureBinding = (node, info, sourceCode) => {
  if (node.type !== "Identifier" || node.name !== "test") return false;
  const variable = resolveVariable(node, sourceCode);
  const definition = variable?.defs?.[0];
  return (
    variable?.defs?.length === 1 &&
    definition?.type === "ImportBinding" &&
    definition.node.type === "ImportSpecifier" &&
    definition.node.imported.type === "Identifier" &&
    definition.node.imported.name === "test" &&
    definition.node.local.name === "test" &&
    isFixtureSource(info, definition.parent?.source?.value)
  );
};

const isImportedBinding = (node, sourceCode, imported, source) => {
  if (node?.type !== "Identifier") return false;
  const definition = resolveVariable(node, sourceCode)?.defs?.[0];
  return (
    definition?.type === "ImportBinding" &&
    definition.node.type === "ImportSpecifier" &&
    definition.node.imported.type === "Identifier" &&
    definition.node.imported.name === imported &&
    definition.parent?.source?.value === source
  );
};

const property = (object, name) =>
  object?.properties?.find(
    (entry) =>
      entry.type === "Property" &&
      !entry.computed &&
      ((entry.key.type === "Identifier" && entry.key.name === name) ||
        (entry.key.type === "Literal" && entry.key.value === name)),
  );

const isCanonicalRuntimeFixture = (declaration, sourceCode) => {
  const runtime = property(declaration?.init?.arguments?.[0], "runtime");
  if (runtime?.value?.type !== "ArrayExpression") return false;
  const [factory, options] = runtime.value.elements;
  if (!isFunction(factory) || options?.type !== "ObjectExpression")
    return false;
  const scope = property(options, "scope");
  const auto = property(options, "auto");
  if (scope?.value?.value !== "worker" || auto?.value?.value !== true)
    return false;
  const calls = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression") calls.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (["parent", "tokens", "comments", "loc", "range"].includes(key))
        continue;
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(factory.body);
  return calls.some((call) =>
    isImportedBinding(
      call.callee,
      sourceCode,
      "createContractsRuntimeController",
      "./runtime",
    ),
  );
};

const isCanonicalFixtureExport = (node, sourceCode) => {
  const declaration = node?.declaration?.declarations?.find(
    (item) => item.id?.type === "Identifier" && item.id.name === "test",
  );
  return (
    declaration?.init?.type === "CallExpression" &&
    declaration.init.callee.type === "MemberExpression" &&
    !declaration.init.callee.computed &&
    declaration.init.callee.property.type === "Identifier" &&
    declaration.init.callee.property.name === "extend" &&
    isImportedBinding(
      declaration.init.callee.object,
      sourceCode,
      "test",
      "@playwright/test",
    ) &&
    isCanonicalRuntimeFixture(declaration, sourceCode)
  );
};

const safeSupportFulfill = (node) => {
  const argument = node.arguments[0];
  if (
    !argument ||
    argument.type !== "ObjectExpression" ||
    argument.properties.length !== 1
  )
    return false;
  const property = argument.properties[0];
  if (
    property.type !== "Property" ||
    property.computed ||
    property.kind !== "init" ||
    property.method
  )
    return false;
  const key = property.key;
  if (key.type === "Identifier" && key.name === "response")
    return property.value.type === "Identifier";
  if (key.type !== "Identifier" || key.name !== "status") return false;
  return (
    property.value.type === "Literal" &&
    typeof property.value.value === "number" &&
    property.value.value >= 400 &&
    property.value.value <= 599
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
      fixture:
        "Acceptance scenarios must import test from ./support/fixtures so the generated-customer runtime starts.",
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
    const testAliases = new Set(["test"]);
    const requireAliases = new Set();
    const reportedRequireAliases = new Set();
    const createRequireAliases = new Set();
    const reportedCreateRequireAliases = new Set();
    const invalidFixtureBindings = new Set();
    let canonicalFixtureExport = false;
    const reportImport = (node, source) => {
      if (source === "@playwright/test" && isScenarioSpec(info))
        context.report({ node, messageId: "fixture" });
      else if (!sourceAllowed(info, source))
        context.report({ node, messageId: "import" });
    };
    const reportMemberBypass = (node) => {
      const names = propertyNames(node);
      if (names.some((name) => ANNOTATIONS.has(name)))
        context.report({ node, messageId: "annotation" });
      else if (names.includes("mock"))
        context.report({ node, messageId: "mock" });
      else if (names.includes("fulfill")) {
        const support = inside(info.supportRoot, info.filename);
        if (!support) context.report({ node, messageId: "network" });
        else context.report({ node, messageId: "synthetic" });
      } else if (names.some((name) => NETWORK_APIS.has(name)))
        context.report({ node, messageId: "network" });
      else if (names.some((name) => BROWSER_APIS.has(name)))
        context.report({ node, messageId: "browser" });
      else if (names.includes("goto"))
        context.report({ node, messageId: "browser" });
    };
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        reportImport(node.source, source);
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "test"
          ) {
            testAliases.add(specifier.local.name);
            if (isScenarioSpec(info) && source === "@playwright/test")
              invalidFixtureBindings.add(specifier.local.name);
            if (
              isScenarioSpec(info) &&
              source !== "@playwright/test" &&
              (!isFixtureSource(info, source) ||
                specifier.local.name !== "test")
            ) {
              invalidFixtureBindings.add(specifier.local.name);
              context.report({ node: specifier, messageId: "fixture" });
            } else if (
              source === "@playwright/test" &&
              inside(info.supportRoot, info.filename) &&
              !isCanonicalFixturesModule(info) &&
              !isScenarioSpec(info)
            )
              context.report({ node: specifier, messageId: "fixture" });
          }
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "createRequire"
          ) {
            createRequireAliases.add(specifier.local.name);
            reportedCreateRequireAliases.add(specifier.local.name);
            context.report({ node: specifier, messageId: "import" });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (
          isCanonicalFixturesModule(info) &&
          isCanonicalFixtureExport(node, context.sourceCode)
        )
          canonicalFixtureExport = true;
        if (node.source) {
          const source = String(node.source.value);
          reportImport(node.source, source);
          if (
            source === "@playwright/test" &&
            inside(info.supportRoot, info.filename) &&
            !isScenarioSpec(info) &&
            node.specifiers.some(
              (specifier) =>
                specifier.local.type === "Identifier" &&
                specifier.local.name === "test",
            )
          )
            context.report({ node: node.source, messageId: "fixture" });
        }
      },
      ExportAllDeclaration(node) {
        const source = String(node.source.value);
        reportImport(node.source, source);
        if (
          source === "@playwright/test" &&
          inside(info.supportRoot, info.filename)
        )
          context.report({ node: node.source, messageId: "fixture" });
      },
      ImportExpression(node) {
        context.report({ node, messageId: "import" });
      },
      TSImportEqualsDeclaration(node) {
        context.report({ node, messageId: "import" });
      },
      VariableDeclarator(node) {
        if (node.init?.type === "Identifier") {
          if (node.init.name === "require") {
            if (node.id.type === "Identifier") {
              requireAliases.add(node.id.name);
              reportedRequireAliases.add(node.id.name);
            }
            context.report({ node: node.init, messageId: "import" });
          } else if (
            node.init.name === "createRequire" &&
            !createRequireAliases.has(node.init.name)
          ) {
            if (node.id.type === "Identifier")
              createRequireAliases.add(node.id.name);
            if (node.id.type === "Identifier")
              reportedCreateRequireAliases.add(node.id.name);
            context.report({ node: node.init, messageId: "import" });
          } else if (
            node.id.type === "Identifier" &&
            requireAliases.has(node.init.name)
          ) {
            requireAliases.add(node.id.name);
            reportedRequireAliases.add(node.id.name);
            context.report({ node: node.init, messageId: "import" });
          } else if (
            node.id.type === "Identifier" &&
            createRequireAliases.has(node.init.name)
          ) {
            createRequireAliases.add(node.id.name);
            if (!reportedCreateRequireAliases.has(node.init.name)) {
              reportedCreateRequireAliases.add(node.id.name);
              context.report({ node: node.init, messageId: "import" });
            } else reportedCreateRequireAliases.add(node.id.name);
          } else if (
            node.id.type === "Identifier" &&
            testAliases.has(node.init.name)
          ) {
            testAliases.add(node.id.name);
          }
        }
        if (node.init?.type === "MemberExpression") {
          reportMemberBypass(node.init);
          if (
            propertyNames(node.init).some(
              (name) => name === "require" || name === "createRequire",
            ) ||
            memberRoot(node.init) === "require" ||
            memberRoot(node.init) === "createRequire"
          )
            context.report({ node: node.init, messageId: "import" });
        }
        if (node.id.type === "ObjectPattern") {
          for (const property of node.id.properties) {
            if (property.type !== "Property") continue;
            const key = property.key;
            const name =
              key.type === "Identifier"
                ? key.name
                : key.type === "Literal" && typeof key.value === "string"
                  ? key.value
                  : undefined;
            if (name === undefined) continue;
            if (ANNOTATIONS.has(name))
              context.report({ node: property, messageId: "annotation" });
            else if (name === "mock")
              context.report({ node: property, messageId: "mock" });
            else if (NETWORK_APIS.has(name) || name === "fulfill")
              context.report({ node: property, messageId: "network" });
            else if (BROWSER_APIS.has(name))
              context.report({ node: property, messageId: "browser" });
            else if (name === "goto")
              context.report({ node: property, messageId: "browser" });
          }
        }
      },
      AssignmentExpression(node) {
        if (node.right.type === "MemberExpression")
          reportMemberBypass(node.right);
        if (node.right.type === "Identifier") {
          if (node.right.name === "require") {
            if (node.left.type === "Identifier") {
              requireAliases.add(node.left.name);
              reportedRequireAliases.add(node.left.name);
            }
            context.report({ node: node.right, messageId: "import" });
          } else if (node.right.name === "createRequire") {
            if (node.left.type === "Identifier") {
              createRequireAliases.add(node.left.name);
              reportedCreateRequireAliases.add(node.left.name);
            }
            context.report({ node: node.right, messageId: "import" });
          }
        }
      },
      Identifier(node) {
        if (node.name === "Reflect" || node.name === "Proxy") {
          if (
            node.parent?.type !== "MemberExpression" ||
            node.parent.property !== node
          )
            context.report({ node, messageId: "network" });
          return;
        }
        if (node.name !== "require") return;
        const parent = node.parent;
        if (
          (parent.type === "CallExpression" && parent.callee === node) ||
          (parent.type === "MemberExpression" &&
            (parent.object === node || parent.property === node)) ||
          (parent.type === "VariableDeclarator" && parent.init === node) ||
          (parent.type === "AssignmentExpression" && parent.right === node)
        )
          return;
        context.report({ node, messageId: "import" });
      },
      CallExpression(node) {
        if (
          isScenarioSpec(info) &&
          isTaggedScenarioRegistration(node) &&
          !invalidFixtureBindings.has(node.callee.name) &&
          !isCanonicalFixtureBinding(node.callee, info, context.sourceCode)
        ) {
          context.report({ node: node.callee, messageId: "fixture" });
          return;
        }
        if (
          node.callee.type === "Identifier" &&
          (node.callee.name === "require" ||
            (requireAliases.has(node.callee.name) &&
              !reportedRequireAliases.has(node.callee.name)) ||
            (node.callee.name === "createRequire" &&
              !createRequireAliases.has(node.callee.name)) ||
            (createRequireAliases.has(node.callee.name) &&
              node.callee.name !== "createRequire" &&
              !reportedCreateRequireAliases.has(node.callee.name)))
        ) {
          context.report({ node, messageId: "import" });
          return;
        }
        if (node.callee.type !== "MemberExpression") return;
        const names = propertyNames(node.callee);
        const root = memberRoot(node.callee);
        if (
          names.some(
            (name) => name === "require" || name === "createRequire",
          ) ||
          root === "require" ||
          root === "createRequire"
        ) {
          context.report({ node: node.callee, messageId: "import" });
          return;
        }
        if (names.some((name) => ANNOTATIONS.has(name))) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (names.includes("mock")) {
          context.report({ node: node.callee, messageId: "mock" });
          return;
        }
        if (names.includes("fulfill")) {
          const support = inside(info.supportRoot, info.filename);
          if (!support)
            context.report({ node: node.callee, messageId: "network" });
          else if (
            !isDirectMemberCall(node, "route", "fulfill") ||
            !safeSupportFulfill(node)
          )
            context.report({ node: node.callee, messageId: "synthetic" });
          return;
        }
        if (names.some((name) => NETWORK_APIS.has(name))) {
          if (
            !inside(info.supportRoot, info.filename) ||
            !isDirectMemberCall(node, "context", "route")
          )
            context.report({ node: node.callee, messageId: "network" });
          return;
        }
        if (
          names.some((name) => ["call", "apply", "bind"].includes(name)) ||
          names.includes("Reflect") ||
          names.includes("Proxy")
        ) {
          context.report({ node: node.callee, messageId: "browser" });
          return;
        }
        if (
          names.some((name) => BROWSER_APIS.has(name)) ||
          (names.includes("goto") && !isRuntimeRootedNavigation(node))
        )
          context.report({ node: node.callee, messageId: "browser" });
        else if (
          memberIsComputed(node.callee) ||
          memberIsOptional(node.callee) ||
          (node.callee.computed &&
            !(
              node.callee.property.type === "Literal" &&
              typeof node.callee.property.value === "string"
            ))
        ) {
          context.report({
            node: node.callee,
            messageId: testAliases.has(root) ? "annotation" : "network",
          });
        }
      },
      "Program:exit"(node) {
        if (isCanonicalFixturesModule(info) && !canonicalFixtureExport)
          context.report({ node, messageId: "fixture" });
      },
    };
  },
};
