/**
 * typed-convex-errors — at a Convex function boundary, throw a typed
 * `ConvexError({ code, message })`, never a bare `Error`. Non-UI clients
 * (CLI/MCP) branch on `code`. Pure layers (domain modules, shared helpers) may
 * throw plain Error — it gets wrapped at the boundary.
 *
 * SCOPE — actual Convex handler callbacks inside the configured backend
 * layers. Pure constructors, validators, and planners in those directories
 * remain ordinary TypeScript and may throw invariant `Error`s which the
 * callable boundary translates.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Convex function layers throw ConvexError, not bare Error",
    },
    schema: [
      {
        type: "object",
        properties: { layers: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      typed:
        "Throw a typed `ConvexError({ code, message })` at the function boundary, not a bare `Error` — non-UI clients branch on `code`.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    const layers = context.options[0]?.layers ?? [
      "/capabilities/",
      "/workflows/",
      "/agents/",
      "/http.",
    ];
    if (!layers.some((l) => filename.includes(l))) return {};
    if (filename.includes(".test.") || filename.includes("/__tests__/"))
      return {};
    const calls = [];
    const bareErrorThrows = [];
    return {
      CallExpression(node) {
        calls.push(node);
      },
      ThrowStatement(node) {
        const arg = node.argument;
        if (
          arg.type === "NewExpression" &&
          arg.callee.type === "Identifier" &&
          arg.callee.name === "Error"
        ) {
          bareErrorThrows.push(node);
        }
      },
      "Program:exit"() {
        const boundaryFunctions = collectBoundaryFunctions(
          calls,
          context.sourceCode,
        );
        for (const node of bareErrorThrows) {
          if (isInsideBoundaryFunction(node, boundaryFunctions)) {
            context.report({ node, messageId: "typed" });
          }
        }
      },
    };
  },
};

const collectBoundaryFunctions = (calls, sourceCode) => {
  const functions = new Set();
  for (const call of calls) {
    const chainedHandler =
      call.callee.type === "MemberExpression" &&
      propertyName(call.callee.property) === "handler";
    if (chainedHandler) {
      for (const argument of call.arguments) {
        addResolvedFunction(functions, argument, sourceCode);
      }
      continue;
    }
    if (!isConvexFactory(call.callee, sourceCode)) continue;
    for (const argument of call.arguments) {
      addResolvedFunction(functions, argument, sourceCode);
      if (argument.type !== "ObjectExpression") continue;
      for (const property of argument.properties) {
        if (
          property.type === "Property" &&
          propertyName(property.key) === "handler"
        ) {
          addResolvedFunction(functions, property.value, sourceCode);
        }
      }
    }
  }
  return functions;
};

const addResolvedFunction = (functions, node, sourceCode) => {
  const resolved = resolveFunction(node, sourceCode);
  if (resolved) functions.add(resolved);
};

const resolveFunction = (node, sourceCode, seen = new Set()) => {
  if (isFunction(node)) return node;
  if (node.type !== "Identifier") return null;
  const variable = resolveVariable(node, sourceCode);
  if (!variable || seen.has(variable)) return null;
  seen.add(variable);
  for (const definition of variable?.defs ?? []) {
    if (definition.type === "FunctionName" && isFunction(definition.node)) {
      return definition.node;
    }
    if (
      definition.type === "Variable" &&
      definition.node.type === "VariableDeclarator" &&
      definition.node.init
    ) {
      const resolved = resolveFunction(definition.node.init, sourceCode, seen);
      if (resolved) return resolved;
    }
  }
  return null;
};

const isInsideBoundaryFunction = (node, boundaryFunctions) => {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current) && boundaryFunctions.has(current)) return true;
  }
  return false;
};

const isFunction = (node) =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

const CONVEX_FACTORIES = new Set([
  "query",
  "mutation",
  "action",
  "httpAction",
  "internalQuery",
  "internalMutation",
  "internalAction",
  "queryGeneric",
  "mutationGeneric",
  "actionGeneric",
  "internalQueryGeneric",
  "internalMutationGeneric",
  "internalActionGeneric",
]);

const isConvexFactory = (callee, sourceCode, seen = new Set()) => {
  if (callee.type === "MemberExpression") {
    return CONVEX_FACTORIES.has(propertyName(callee.property));
  }
  if (callee.type !== "Identifier") return false;
  if (CONVEX_FACTORIES.has(callee.name)) return true;
  const variable = resolveVariable(callee, sourceCode);
  if (!variable || seen.has(variable)) return false;
  seen.add(variable);
  for (const definition of variable.defs) {
    if (definition.type === "ImportBinding") {
      const imported = definition.node.imported;
      if (
        imported &&
        CONVEX_FACTORIES.has(propertyName(imported)) &&
        isConvexFactoryImport(definition.parent?.source?.value)
      ) {
        return true;
      }
    }
    if (
      definition.type === "Variable" &&
      definition.node.type === "VariableDeclarator" &&
      definition.node.init &&
      isConvexFactory(definition.node.init, sourceCode, seen)
    ) {
      return true;
    }
  }
  return false;
};

const isConvexFactoryImport = (source) =>
  typeof source === "string" &&
  (source === "convex/server" || /(?:^|\/)_generated\/server$/.test(source));

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

const propertyName = (node) =>
  node.type === "Identifier"
    ? node.name
    : node.type === "Literal" && typeof node.value === "string"
      ? node.value
      : null;
