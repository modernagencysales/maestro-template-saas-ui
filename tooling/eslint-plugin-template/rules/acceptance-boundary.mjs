import { posix } from "node:path";

const ACCEPTANCE_MARKER = "tests/acceptance/";
const ALLOWED_IMPORT = new Set(["@playwright/test"]);
const ANNOTATIONS = new Set(["skip", "fixme", "fail", "only"]);
const NETWORK_APIS = new Set([
  "route",
  "routeFromHAR",
  "routeWebSocket",
  "continue",
  "fallback",
  "abort",
]);
const BROWSER_APIS = new Set([
  "evaluate",
  "evaluateHandle",
  "addInitScript",
  "addScriptTag",
  "setContent",
  "addCookies",
  "waitForFunction",
  "newCDPSession",
]);
const PAGE_CREATION_APIS = new Set(["newContext", "newPage"]);
const DYNAMIC_CODE_NAMES = new Set(["eval", "Function", "AsyncFunction"]);
const SCENARIO_FIXTURES = new Set(["runtime", "scenario", "acceptancePage"]);
const BEHAVIOR_TAG_TOKEN = /@BHV-[A-Z0-9]+-[0-9]+-R[1-9][0-9]*/u;

const isAcceptanceConfig = (filename) =>
  /(?:^|\/)playwright\.acceptance\.config\.ts$/u.test(filename);

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

const isCanonicalRuntimeModule = (info) =>
  new RegExp(`${info.supportRoot}/runtime\\.[cm]?[jt]sx?$`, "u").test(
    info.filename,
  );

const isFixtureSource = (info, source) => {
  if (!source.startsWith(".")) return false;
  const target = relativeTarget(info.filename, source);
  return (
    target === `${info.supportRoot}/fixtures` ||
    new RegExp(`${info.supportRoot}/fixtures\\.[cm]?[jt]sx?$`, "u").test(target)
  );
};

const sourceAllowed = (info, source) => {
  if (source.startsWith("."))
    return inside(info.supportRoot, relativeTarget(info.filename, source));
  return (
    (source.startsWith("node:") && !isScenarioSpec(info)) ||
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

const isGlobalRoot = (node) =>
  node?.type === "Identifier" && ["global", "globalThis"].includes(node.name);

const memberIsComputed = (node) => {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (current.computed) return true;
    current = current.object;
  }
  return false;
};

const memberHasDynamicComputedProperty = (node) => {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (current.computed && current.property.type !== "Literal") return true;
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

const isScenarioWorkspaceSlug = (node) =>
  node?.type === "MemberExpression" &&
  !node.computed &&
  !node.optional &&
  node.object.type === "Identifier" &&
  node.object.name === "scenario" &&
  node.property.type === "Identifier" &&
  node.property.name === "workspaceSlug";

const isRuntimeRootedNavigation = (node) => {
  const target = node.arguments[0];
  if (!(
    propertyNames(node.callee).includes("goto") &&
    target?.type === "TemplateLiteral" &&
    target.quasis[0]?.value.cooked === "" &&
    isRuntimeWebUrl(target.expressions[0])
  ))
    return false;
  return (
    (target.expressions.length === 1 &&
      target.quasis.length === 2 &&
      (target.quasis[1]?.value.cooked === "" ||
        target.quasis[1]?.value.cooked?.startsWith("/"))) ||
    (target.expressions.length === 2 &&
      target.quasis.length === 3 &&
      target.quasis[1]?.value.cooked === "/" &&
      isScenarioWorkspaceSlug(target.expressions[1]) &&
      target.quasis[2]?.value.cooked?.startsWith("/"))
  );
};

const isTaggedScenarioRegistration = (node) => {
  if (node.callee.type === "CallExpression") return false;
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

const staticString = (node, computed = false) => {
  if (node?.type === "Identifier") return computed ? undefined : node.name;
  const literal = literalText(node);
  if (literal !== undefined) return literal;
  if (node?.type !== "BinaryExpression" || node.operator !== "+")
    return undefined;
  const left = staticString(node.left, true);
  const right = staticString(node.right, true);
  return left !== undefined && right !== undefined ? left + right : undefined;
};

const isBehaviorTitle = (node) =>
  typeof literalText(node) === "string" &&
  BEHAVIOR_TAG_TOKEN.test(literalText(node));

const propertyName = (property) => {
  if (property?.type !== "Property") return undefined;
  const key = property.key;
  if (key.type === "Identifier" && !property.computed) return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return undefined;
};

const isBehaviorTagOptions = (node) =>
  node?.type === "ObjectExpression" &&
  node.properties.some(
    (property) =>
      property.type === "Property" && propertyName(property) === "tag",
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

const isScenarioFixturePattern = (node, info, sourceCode) => {
  const callback = node.parent;
  const registration = callback?.parent;
  return (
    isScenarioSpec(info) &&
    isFunction(callback) &&
    callback.params.includes(node) &&
    registration?.type === "CallExpression" &&
    registration.arguments.at(-1) === callback &&
    isTaggedScenarioRegistration(registration) &&
    isCanonicalFixtureBinding(registration.callee, info, sourceCode)
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

const directCall = (node, object, method) =>
  node?.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === object &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === method;

const awaitedDirectCall = (node, object, method) =>
  node?.type === "AwaitExpression" && directCall(node.argument, object, method);

const isCanonicalRouteFetch = (node) => {
  if (!awaitedDirectCall(node, "route", "fetch")) return false;
  const call = node.argument;
  if (call.arguments.length !== 1) return false;
  const options = call.arguments[0];
  if (
    options?.type !== "ObjectExpression" ||
    options.properties.some(
      (entry) =>
        entry.type !== "Property" ||
        entry.computed ||
        entry.kind !== "init" ||
        entry.method,
    )
  )
    return false;
  const urlProperties = options.properties.filter(
    (entry) =>
      (entry.key.type === "Identifier" && entry.key.name === "url") ||
      (entry.key.type === "Literal" && entry.key.value === "url"),
  );
  return (
    urlProperties.length === 1 &&
    urlProperties[0]?.key.type === "Identifier" &&
    urlProperties[0]?.value.type === "Identifier" &&
    urlProperties[0].value.name === "targetUrl"
  );
};

const isCanonicalFetchedResponse = (node, fulfill, sourceCode) => {
  if (node.type !== "Identifier") return false;
  const variable = resolveVariable(node, sourceCode);
  const definition = variable?.defs?.[0];
  const declarationEnd = definition?.node?.range?.[1];
  const fulfillStart = fulfill.range?.[0];
  return (
    variable?.defs?.length === 1 &&
    definition?.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    definition.node.type === "VariableDeclarator" &&
    definition.node.id.type === "Identifier" &&
    definition.node.id.name === node.name &&
    typeof declarationEnd === "number" &&
    typeof fulfillStart === "number" &&
    declarationEnd < fulfillStart &&
    isCanonicalRouteFetch(definition.node.init)
  );
};

const isCanonicalRuntimeFixture = (runtime, sourceCode) => {
  if (runtime?.value?.type !== "ArrayExpression") return false;
  const [factory, options] = runtime.value.elements;
  if (!isFunction(factory) || options?.type !== "ObjectExpression")
    return false;
  if (options.properties.some((entry) => entry.type === "SpreadElement"))
    return false;
  const scope = property(options, "scope");
  const auto = property(options, "auto");
  if (scope?.value?.value !== "worker" || auto?.value?.value !== true)
    return false;
  if (factory.body.type !== "BlockStatement") return false;
  const controller = factory.body.body
    .find(
      (statement) =>
        statement.type === "VariableDeclaration" &&
        statement.declarations.some(
          (item) =>
            item.id.type === "Identifier" &&
            item.init?.type === "CallExpression" &&
            isImportedBinding(
              item.init.callee,
              sourceCode,
              "createContractsRuntimeController",
              "./runtime",
            ),
        ),
    )
    ?.declarations.find(
      (item) =>
        item.id.type === "Identifier" &&
        item.init?.type === "CallExpression" &&
        isImportedBinding(
          item.init.callee,
          sourceCode,
          "createContractsRuntimeController",
          "./runtime",
        ),
    )?.id;
  if (controller?.type !== "Identifier") return false;
  const started = factory.body.body
    .find(
      (statement) =>
        statement.type === "VariableDeclaration" &&
        statement.declarations.some(
          (item) =>
            item.id.type === "Identifier" &&
            awaitedDirectCall(item.init, controller.name, "start"),
        ),
    )
    ?.declarations.find(
      (item) =>
        item.id.type === "Identifier" &&
        awaitedDirectCall(item.init, controller.name, "start"),
    )?.id;
  if (started?.type !== "Identifier") return false;
  const use = factory.params[1];
  const lifecycle = factory.body.body.find(
    (statement) => statement.type === "TryStatement",
  );
  const useCall = lifecycle?.block.body.find(
    (statement) =>
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "AwaitExpression" &&
      statement.expression.argument.type === "CallExpression" &&
      statement.expression.argument.callee.type === "Identifier" &&
      statement.expression.argument.callee.name === use?.name &&
      statement.expression.argument.arguments.length === 1 &&
      statement.expression.argument.arguments[0]?.type === "Identifier" &&
      statement.expression.argument.arguments[0].name === started.name,
  );
  const stop = lifecycle?.finalizer?.body.find(
    (statement) =>
      statement.type === "ExpressionStatement" &&
      awaitedDirectCall(statement.expression, controller.name, "stop"),
  );
  return (
    use?.type === "Identifier" && useCall !== undefined && stop !== undefined
  );
};

const isFixtureParameter = (node, names) =>
  node?.type === "ObjectPattern" &&
  node.properties.length === names.length &&
  node.properties.every(
    (item) =>
      item.type === "Property" &&
      !item.computed &&
      item.key.type === "Identifier" &&
      item.value.type === "Identifier" &&
      item.key.name === item.value.name &&
      names.includes(item.key.name),
  );

const isAwaitedUse = (node, use, value) =>
  node?.type === "ExpressionStatement" &&
  node.expression.type === "AwaitExpression" &&
  node.expression.argument.type === "CallExpression" &&
  node.expression.argument.callee.type === "Identifier" &&
  node.expression.argument.callee.name === use &&
  node.expression.argument.arguments.length === 1 &&
  value(node.expression.argument.arguments[0]);

const isCanonicalScenarioFixture = (scenario) => {
  const value = scenario?.value;
  const [factory, options] = value?.elements ?? [];
  const [runtime, use] = factory?.params ?? [];
  const statement = factory?.body?.body?.[0];
  const timeout = options?.properties?.[0];
  return (
    value?.type === "ArrayExpression" &&
    value.elements.length === 2 &&
    isFunction(factory) &&
    factory.body.type === "BlockStatement" &&
    factory.body.body.length === 1 &&
    isFixtureParameter(runtime, ["runtime"]) &&
    use?.type === "Identifier" &&
    isAwaitedUse(statement, use.name, (value) =>
      awaitedDirectCall(value, "runtime", "provisionScenario"),
    ) &&
    options?.type === "ObjectExpression" &&
    options.properties.length === 1 &&
    propertyName(timeout) === "timeout" &&
    timeout.value?.type === "Identifier" &&
    timeout.value.name === "CONTRACTS_HOOK_TIMEOUT_MS"
  );
};

const isCanonicalPageFixture = (acceptancePage) => {
  const factory = acceptancePage?.value;
  const [fixtures, use] = factory?.params ?? [];
  const [contextDeclaration, lifecycle] = factory?.body?.body ?? [];
  const context = contextDeclaration?.declarations?.[0];
  const contextCall = context?.init?.argument;
  const authorized = lifecycle?.block?.body?.[0];
  const page = lifecycle?.block?.body?.[1];
  const closed = lifecycle?.finalizer?.body?.[0];
  return (
    isFunction(factory) &&
    factory.body.type === "BlockStatement" &&
    factory.body.body.length === 2 &&
    isFixtureParameter(fixtures, ["runtime", "scenario"]) &&
    use?.type === "Identifier" &&
    contextDeclaration?.type === "VariableDeclaration" &&
    contextDeclaration.declarations.length === 1 &&
    context?.id.type === "Identifier" &&
    context.init?.type === "AwaitExpression" &&
    contextCall?.type === "CallExpression" &&
    contextCall.arguments.length === 0 &&
    contextCall.callee.type === "MemberExpression" &&
    !contextCall.callee.computed &&
    contextCall.callee.property.type === "Identifier" &&
    contextCall.callee.property.name === "newContext" &&
    contextCall.callee.object.type === "MemberExpression" &&
    !contextCall.callee.object.computed &&
    contextCall.callee.object.object.type === "Identifier" &&
    contextCall.callee.object.object.name === "runtime" &&
    contextCall.callee.object.property.type === "Identifier" &&
    contextCall.callee.object.property.name === "browser" &&
    lifecycle?.type === "TryStatement" &&
    lifecycle.block.body.length === 2 &&
    authorized?.type === "ExpressionStatement" &&
    awaitedDirectCall(
      authorized.expression,
      "runtime",
      "authorizeBrowserContext",
    ) &&
    authorized.expression.argument.arguments.length === 2 &&
    authorized.expression.argument.arguments[0]?.type === "Identifier" &&
    authorized.expression.argument.arguments[0].name === "scenario" &&
    authorized.expression.argument.arguments[1]?.type === "Identifier" &&
    authorized.expression.argument.arguments[1].name === context.id.name &&
    isAwaitedUse(page, use.name, (value) =>
      awaitedDirectCall(value, context.id.name, "newPage"),
    ) &&
    lifecycle.finalizer?.body.length === 1 &&
    closed?.type === "ExpressionStatement" &&
    awaitedDirectCall(closed.expression, context.id.name, "close")
  );
};

const isCanonicalFixtureShape = (declaration, sourceCode) => {
  const fixtureObject = declaration?.init?.arguments?.[0];
  if (
    fixtureObject?.type !== "ObjectExpression" ||
    fixtureObject.properties.length !== SCENARIO_FIXTURES.size ||
    fixtureObject.properties.some(
      (entry) =>
        entry.type !== "Property" ||
        entry.computed ||
        entry.kind !== "init" ||
        entry.method,
    )
  )
    return false;
  const fixture = (name) => {
    const matches = fixtureObject.properties.filter(
      (entry) => propertyName(entry) === name,
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const runtime = fixture("runtime");
  const scenario = fixture("scenario");
  const acceptancePage = fixture("acceptancePage");
  return (
    fixtureObject.properties.every((entry) =>
      SCENARIO_FIXTURES.has(propertyName(entry)),
    ) &&
    isCanonicalRuntimeFixture(runtime, sourceCode) &&
    isCanonicalScenarioFixture(scenario) &&
    isCanonicalPageFixture(acceptancePage)
  );
};

const isCanonicalConfig = (node, sourceCode) => {
  if (
    node?.type !== "CallExpression" ||
    !isImportedBinding(
      node.callee,
      sourceCode,
      "defineConfig",
      "@playwright/test",
    ) ||
    node.arguments.length !== 1 ||
    node.arguments[0]?.type !== "ObjectExpression"
  )
    return false;
  const config = node.arguments[0];
  if (config.properties.some((entry) => entry.type === "SpreadElement"))
    return false;
  const value = (name) => property(config, name)?.value;
  const literal = (name, expected) => value(name)?.value === expected;
  const projects = value("projects");
  const project =
    projects?.type === "ArrayExpression" ? projects.elements[0] : undefined;
  const use =
    project?.type === "ObjectExpression"
      ? property(project, "use")?.value
      : undefined;
  return (
    config.properties.length === 9 &&
    literal("testDir", "./tests/acceptance") &&
    literal("testMatch", "**/*.spec.ts") &&
    literal("forbidOnly", true) &&
    literal("retries", 0) &&
    literal("workers", 1) &&
    literal("fullyParallel", false) &&
    literal("repeatEach", 1) &&
    value("testIgnore")?.type === "ArrayExpression" &&
    value("testIgnore").elements.length === 0 &&
    projects?.type === "ArrayExpression" &&
    projects.elements.length === 1 &&
    project?.type === "ObjectExpression" &&
    project.properties.length === 2 &&
    property(project, "name")?.value?.value === "acceptance-chromium" &&
    use?.type === "ObjectExpression" &&
    use.properties.length === 1 &&
    property(use, "browserName")?.value?.value === "chromium"
  );
};

const isCanonicalConfigModule = (program, sourceCode) => {
  if (program.body.length !== 2) return false;
  const [importDeclaration, exportDeclaration] = program.body;
  if (
    importDeclaration?.type !== "ImportDeclaration" ||
    importDeclaration.source.value !== "@playwright/test" ||
    importDeclaration.specifiers.length !== 1
  )
    return false;
  const specifier = importDeclaration.specifiers[0];
  return (
    specifier.type === "ImportSpecifier" &&
    specifier.imported.type === "Identifier" &&
    specifier.imported.name === "defineConfig" &&
    specifier.local.name === "defineConfig" &&
    exportDeclaration?.type === "ExportDefaultDeclaration" &&
    isCanonicalConfig(exportDeclaration.declaration, sourceCode)
  );
};

const isCanonicalFixtureExport = (node, sourceCode) => {
  const declaration = node?.declaration?.declarations?.find(
    (item) => item.id?.type === "Identifier" && item.id.name === "test",
  );
  return (
    node?.declaration?.declarations?.length === 1 &&
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
    isCanonicalFixtureShape(declaration, sourceCode)
  );
};

const isCanonicalFixtureExpectExport = (node, sourceCode) => {
  const specifier = node?.specifiers?.[0];
  return (
    node?.source === null &&
    node.specifiers.length === 1 &&
    specifier?.type === "ExportSpecifier" &&
    specifier.local.type === "Identifier" &&
    specifier.local.name === "expect" &&
    specifier.exported.type === "Identifier" &&
    specifier.exported.name === "expect" &&
    isImportedBinding(specifier.local, sourceCode, "expect", "@playwright/test")
  );
};

const isTypeOnlyExport = (node) =>
  node?.exportKind === "type" ||
  (node?.type === "ExportDefaultDeclaration" &&
    ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"].includes(
      node.declaration?.type,
    )) ||
  (node?.specifiers?.length > 0 &&
    node.specifiers.every((specifier) => specifier.exportKind === "type"));

const isCanonicalScenarioFixtureImport = (specifier) =>
  specifier.type === "ImportSpecifier" &&
  specifier.imported.type === "Identifier" &&
  specifier.local.type === "Identifier" &&
  ["test", "expect"].includes(specifier.imported.name) &&
  specifier.local.name === specifier.imported.name;

const isCanonicalFixtureExtend = (node, info, sourceCode) => {
  const call = node.parent;
  const declaration = call?.parent;
  const statement = declaration?.parent;
  return (
    isCanonicalFixturesModule(info) &&
    !node.computed &&
    node.property.type === "Identifier" &&
    node.property.name === "extend" &&
    call?.type === "CallExpression" &&
    call.callee === node &&
    declaration?.type === "VariableDeclarator" &&
    declaration.init === call &&
    declaration.id.type === "Identifier" &&
    declaration.id.name === "test" &&
    statement?.type === "VariableDeclaration" &&
    statement.parent?.type === "ExportNamedDeclaration" &&
    isImportedBinding(node.object, sourceCode, "test", "@playwright/test")
  );
};

const isCanonicalPageCreation = (node, info) => {
  const callee = node.callee;
  if (
    !isCanonicalFixturesModule(info) ||
    node.arguments.length !== 0 ||
    node.optional ||
    callee?.type !== "MemberExpression" ||
    callee.computed ||
    callee.optional ||
    callee.property.type !== "Identifier"
  )
    return false;
  if (
    callee.property.name === "newPage" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "context"
  )
    return true;
  return (
    callee.property.name === "newContext" &&
    callee.object.type === "MemberExpression" &&
    !callee.object.computed &&
    !callee.object.optional &&
    callee.object.property.type === "Identifier" &&
    callee.object.property.name === "browser" &&
    callee.object.object.type === "Identifier" &&
    callee.object.object.name === "runtime"
  );
};

const objectPatternSource = (node) => {
  if (node.parent?.type === "VariableDeclarator" && node.parent.id === node)
    return node.parent.init;
  if (node.parent?.type === "AssignmentExpression" && node.parent.left === node)
    return node.parent.right;
  return undefined;
};

const safeSupportFulfill = (node, sourceCode) => {
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
    return isCanonicalFetchedResponse(property.value, node, sourceCode);
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
      config:
        "The acceptance Playwright config must remain the canonical one-project Chromium configuration without execution hooks.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/gu,
      "/",
    );
    const info = pathInfo(filename);
    const configFile = isAcceptanceConfig(filename);
    if (!info && !configFile) return {};
    const testAliases = new Set(["test"]);
    const globalAliases = new Set();
    const processAliases = new Set(["process"]);
    const requireAliases = new Set();
    const reportedRequireAliases = new Set();
    const createRequireAliases = new Set();
    const reportedCreateRequireAliases = new Set();
    const invalidFixtureBindings = new Set();
    const moduleAliases = new Set();
    const scenarioFixtureAliases = new Set();
    let canonicalFixtureExport = false;
    let invalidCanonicalFixtureExport = false;
    const reportImport = (node, source) => {
      if (source === "@playwright/test" && isScenarioSpec(info))
        context.report({ node, messageId: "fixture" });
      else if (!sourceAllowed(info, source))
        context.report({ node, messageId: "import" });
    };
    const isProcessObject = (node) => {
      if (node?.type === "Identifier") return processAliases.has(node.name);
      return (
        node?.type === "MemberExpression" &&
        !node.optional &&
        (isGlobalRoot(node.object) ||
          globalAliases.has(memberRoot(node.object))) &&
        staticString(node.property, node.computed) === "process"
      );
    };
    const reportMemberBypass = (node) => {
      const names = propertyNames(node);
      if (names.some((name) => ANNOTATIONS.has(name)))
        context.report({ node, messageId: "annotation" });
      else if (names.includes("configure") && testAliases.has(memberRoot(node)))
        context.report({ node, messageId: "annotation" });
      else if (names.includes("describe") && testAliases.has(memberRoot(node)))
        context.report({ node, messageId: "annotation" });
      else if (names.includes("mock"))
        context.report({ node, messageId: "mock" });
      else if (names.includes("fulfill")) {
        const support = inside(info.supportRoot, info.filename);
        if (!support) context.report({ node, messageId: "network" });
        else context.report({ node, messageId: "synthetic" });
      } else if (names.some((name) => NETWORK_APIS.has(name)))
        context.report({ node, messageId: "network" });
      else if (names.some((name) => PAGE_CREATION_APIS.has(name)))
        context.report({ node, messageId: "browser" });
      else if (names.includes("use") && testAliases.has(memberRoot(node)))
        context.report({ node, messageId: "browser" });
      else if (names.some((name) => BROWSER_APIS.has(name)))
        context.report({ node, messageId: "browser" });
      else if (names.includes("goto"))
        context.report({ node, messageId: "browser" });
      else if (memberRoot(node) === "route" && names.includes("fetch"))
        context.report({ node, messageId: "network" });
      else if (
        memberRoot(node) === "route" &&
        memberHasDynamicComputedProperty(node)
      )
        context.report({
          node,
          messageId: "network",
        });
    };
    const reportObjectPattern = (node) => {
      const pattern = node?.type === "AssignmentPattern" ? node.left : node;
      if (pattern?.type !== "ObjectPattern") return;
      const scenarioFixturePattern = isScenarioFixturePattern(
        pattern,
        info,
        context.sourceCode,
      );
      const source = objectPatternSource(pattern);
      const sourceRoot = memberRoot(source);
      const globalObject =
        isGlobalRoot(source) || globalAliases.has(sourceRoot);
      const processObject = isProcessObject(source);
      for (const property of pattern.properties) {
        if (property.type === "RestElement") {
          if (globalObject || processObject)
            context.report({ node: property, messageId: "import" });
          continue;
        }
        if (property.type !== "Property") continue;
        const name = staticString(property.key, property.computed);
        if (name === "process" && globalObject) {
          const value = property.value;
          if (value.type === "Identifier") processAliases.add(value.name);
          else if (
            value.type === "AssignmentPattern" &&
            value.left.type === "Identifier"
          )
            processAliases.add(value.left.name);
          continue;
        }
        if (
          name === "getBuiltinModule" ||
          name === "require" ||
          name === "createRequire"
        ) {
          context.report({ node: property, messageId: "import" });
          continue;
        }
        if (property.computed) {
          context.report({ node: property, messageId: "network" });
          continue;
        }
        const key = property.key;
        const propertyName =
          key.type === "Identifier"
            ? key.name
            : key.type === "Literal" && typeof key.value === "string"
              ? key.value
              : undefined;
        if (propertyName === undefined) continue;
        if (scenarioFixturePattern && SCENARIO_FIXTURES.has(propertyName)) {
          const value = property.value;
          if (value.type === "Identifier")
            scenarioFixtureAliases.add(value.name);
          else if (
            value.type === "AssignmentPattern" &&
            value.left.type === "Identifier"
          )
            scenarioFixtureAliases.add(value.left.name);
        } else if (
          scenarioFixturePattern &&
          !SCENARIO_FIXTURES.has(propertyName)
        )
          context.report({ node: property, messageId: "fixture" });
        else if (propertyName === "extend")
          context.report({ node: property, messageId: "fixture" });
        else if (propertyName === "describe" && testAliases.has(sourceRoot))
          context.report({ node: property, messageId: "annotation" });
        else if (PAGE_CREATION_APIS.has(propertyName))
          context.report({ node: property, messageId: "browser" });
        else if (propertyName === "use")
          context.report({ node: property, messageId: "browser" });
        else if (
          DYNAMIC_CODE_NAMES.has(propertyName) &&
          property.key.type !== "Identifier"
        )
          context.report({ node: property, messageId: "import" });
        else if (ANNOTATIONS.has(propertyName))
          context.report({ node: property, messageId: "annotation" });
        else if (propertyName === "mock")
          context.report({ node: property, messageId: "mock" });
        else if (
          NETWORK_APIS.has(propertyName) ||
          propertyName === "fulfill" ||
          propertyName === "fetch"
        )
          context.report({ node: property, messageId: "network" });
        else if (BROWSER_APIS.has(propertyName))
          context.report({ node: property, messageId: "browser" });
        else if (propertyName === "goto")
          context.report({ node: property, messageId: "browser" });
      }
    };
    const isScenarioFixtureTarget = (node) =>
      isScenarioSpec(info) && scenarioFixtureAliases.has(memberRoot(node));
    const reportFixtureMutation = (node, target) => {
      if (isScenarioFixtureTarget(target))
        context.report({ node, messageId: "fixture" });
    };
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (configFile) return;
        const forbiddenNodeImport =
          source.startsWith("node:") && isScenarioSpec(info);
        if (forbiddenNodeImport)
          context.report({ node: node.source, messageId: "import" });
        else reportImport(node.source, source);
        if (source === "node:vm" && !forbiddenNodeImport)
          context.report({ node: node.source, messageId: "import" });
        if (source === "node:module") {
          if (
            !forbiddenNodeImport &&
            node.specifiers.some(
              (specifier) =>
                specifier.type === "ImportDefaultSpecifier" ||
                specifier.type === "ImportNamespaceSpecifier",
            )
          )
            context.report({ node: node.source, messageId: "import" });
          for (const specifier of node.specifiers)
            moduleAliases.add(specifier.local.name);
        }
        for (const specifier of node.specifiers) {
          if (
            isScenarioSpec(info) &&
            isFixtureSource(info, source) &&
            !isCanonicalScenarioFixtureImport(specifier)
          ) {
            if (specifier.local.type === "Identifier")
              invalidFixtureBindings.add(specifier.local.name);
            context.report({ node: specifier, messageId: "fixture" });
            continue;
          }
          if (
            source === "@playwright/test" &&
            inside(info.supportRoot, info.filename) &&
            (specifier.type === "ImportDefaultSpecifier" ||
              specifier.type === "ImportNamespaceSpecifier")
          )
            context.report({ node: specifier, messageId: "fixture" });
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
            if (!forbiddenNodeImport)
              context.report({ node: specifier, messageId: "import" });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (isCanonicalFixturesModule(info)) {
          if (isCanonicalFixtureExport(node, context.sourceCode))
            canonicalFixtureExport = true;
          else if (
            !isCanonicalFixtureExpectExport(node, context.sourceCode) &&
            !isTypeOnlyExport(node)
          ) {
            invalidCanonicalFixtureExport = true;
            context.report({ node, messageId: "fixture" });
          }
        }
        if (node.source) {
          const source = String(node.source.value);
          reportImport(node.source, source);
          if (
            source === "@playwright/test" &&
            inside(info.supportRoot, info.filename)
          )
            context.report({ node: node.source, messageId: "fixture" });
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
      ExportDefaultDeclaration(node) {
        if (
          info &&
          isCanonicalFixturesModule(info) &&
          !isTypeOnlyExport(node)
        ) {
          invalidCanonicalFixtureExport = true;
          context.report({ node, messageId: "fixture" });
        }
      },
      ExportAllDeclaration(node) {
        const source = String(node.source.value);
        reportImport(node.source, source);
        if (
          info &&
          isCanonicalFixturesModule(info) &&
          !isTypeOnlyExport(node)
        ) {
          invalidCanonicalFixtureExport = true;
          context.report({ node, messageId: "fixture" });
        }
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
          if (
            node.id.type === "Identifier" &&
            scenarioFixtureAliases.has(node.init.name)
          )
            scenarioFixtureAliases.add(node.id.name);
          if (
            node.id.type === "Identifier" &&
            (isGlobalRoot(node.init) || globalAliases.has(node.init.name))
          )
            globalAliases.add(node.id.name);
          if (node.id.type === "Identifier" && isProcessObject(node.init))
            processAliases.add(node.id.name);
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
          if (node.id.type === "Identifier" && isProcessObject(node.init))
            processAliases.add(node.id.name);
          if (
            propertyNames(node.init).some(
              (name) => name === "require" || name === "createRequire",
            ) ||
            memberRoot(node.init) === "require" ||
            memberRoot(node.init) === "createRequire"
          )
            context.report({ node: node.init, messageId: "import" });
        }
      },
      AssignmentExpression(node) {
        reportFixtureMutation(node, node.left);
        if (node.left.type === "Identifier" && isProcessObject(node.right))
          processAliases.add(node.left.name);
        if (node.right.type === "Identifier") {
          if (
            node.left.type === "Identifier" &&
            scenarioFixtureAliases.has(node.right.name)
          )
            scenarioFixtureAliases.add(node.left.name);
          if (
            node.left.type === "Identifier" &&
            (isGlobalRoot(node.right) || globalAliases.has(node.right.name))
          )
            globalAliases.add(node.left.name);
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
      ObjectPattern(node) {
        reportObjectPattern(node);
      },
      UnaryExpression(node) {
        if (node.operator === "delete")
          reportFixtureMutation(node, node.argument);
      },
      UpdateExpression(node) {
        reportFixtureMutation(node, node.argument);
      },
      Identifier(node) {
        if (!configFile && DYNAMIC_CODE_NAMES.has(node.name)) {
          context.report({ node, messageId: "import" });
          return;
        }
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
      MemberExpression(node) {
        if (
          !configFile &&
          !(
            node.parent?.type === "CallExpression" &&
            node.parent.callee === node
          ) &&
          isProcessObject(node.object) &&
          staticString(node.property, node.computed) === "getBuiltinModule"
        ) {
          context.report({ node, messageId: "import" });
          return;
        }
        if (
          !configFile &&
          node.computed &&
          ((node.property.type === "Literal" &&
            typeof node.property.value === "string" &&
            DYNAMIC_CODE_NAMES.has(node.property.value)) ||
            ((isGlobalRoot(node.object) ||
              globalAliases.has(memberRoot(node))) &&
              node.property.type !== "Literal"))
        ) {
          context.report({ node, messageId: "import" });
          return;
        }
        if (
          propertyNames(node).at(-1) === "extend" &&
          !isCanonicalFixtureExtend(node, info, context.sourceCode)
        )
          context.report({ node, messageId: "fixture" });
        if (configFile) return;
        if (
          node.parent?.type === "MemberExpression" &&
          node.parent.object === node
        )
          return;
        if (
          node.parent?.type === "CallExpression" &&
          node.parent.callee === node
        )
          return;
        if (memberHasDynamicComputedProperty(node)) {
          const root = memberRoot(node);
          if (testAliases.has(root)) {
            context.report({ node, messageId: "annotation" });
            return;
          }
          if (["page", "context", "route", "runtime"].includes(root)) {
            context.report({
              node,
              messageId: root === "page" ? "browser" : "network",
            });
            return;
          }
        }
        reportMemberBypass(node);
      },
      CallExpression(node) {
        if (configFile) return;
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "Object" &&
          [
            "assign",
            "defineProperty",
            "defineProperties",
            "setPrototypeOf",
          ].includes(staticString(node.callee.property, node.callee.computed))
        ) {
          reportFixtureMutation(node, node.arguments[0]);
          return;
        }
        if (
          node.callee.type === "MemberExpression" &&
          isProcessObject(node.callee.object) &&
          staticString(node.callee.property, node.callee.computed) ===
            "getBuiltinModule"
        ) {
          context.report({ node: node.callee, messageId: "import" });
          return;
        }
        if (
          isScenarioSpec(info) &&
          isTaggedScenarioRegistration(node) &&
          (node.callee.type !== "Identifier" ||
            !invalidFixtureBindings.has(node.callee.name)) &&
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
        if (moduleAliases.has(root)) {
          context.report({ node: node.callee, messageId: "import" });
          return;
        }
        if (names.includes("use") && testAliases.has(root)) {
          context.report({ node: node.callee, messageId: "browser" });
          return;
        }
        if (names.includes("configure") && testAliases.has(root)) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (names.includes("describe") && names.includes("configure")) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (
          names.includes("describe") &&
          names.includes("parallel") &&
          testAliases.has(root)
        ) {
          context.report({ node: node.callee, messageId: "annotation" });
          return;
        }
        if (
          names.some((name) => PAGE_CREATION_APIS.has(name)) &&
          !isCanonicalPageCreation(node, info)
        ) {
          context.report({ node: node.callee, messageId: "browser" });
          return;
        }
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
            !isCanonicalRuntimeModule(info) ||
            !isDirectMemberCall(node, "route", "fulfill") ||
            !safeSupportFulfill(node, context.sourceCode)
          )
            context.report({ node: node.callee, messageId: "synthetic" });
          return;
        }
        if (root === "route" && names.includes("fetch")) {
          if (
            !isCanonicalRuntimeModule(info) ||
            !isDirectMemberCall(node, "route", "fetch") ||
            !isCanonicalRouteFetch(node.parent)
          )
            context.report({ node: node.callee, messageId: "network" });
          return;
        }
        if (names.some((name) => NETWORK_APIS.has(name))) {
          if (
            !inside(info.supportRoot, info.filename) ||
            !isCanonicalRuntimeModule(info) ||
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
        if (configFile && !isCanonicalConfigModule(node, context.sourceCode))
          context.report({ node, messageId: "config" });
        if (
          info &&
          isCanonicalFixturesModule(info) &&
          !canonicalFixtureExport &&
          !invalidCanonicalFixtureExport
        )
          context.report({ node, messageId: "fixture" });
      },
    };
  },
};
