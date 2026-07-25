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
    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (
          isInsideConvexBoundary(node) &&
          arg.type === "NewExpression" &&
          arg.callee.type === "Identifier" &&
          arg.callee.name === "Error"
        ) {
          context.report({ node, messageId: "typed" });
        }
      },
    };
  },
};

const isInsideConvexBoundary = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current) && isConvexBoundaryCallback(current)) return true;
  }
  return false;
};

const isFunction = (node) =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

const isConvexBoundaryCallback = (node) => {
  const parent = node.parent;
  if (!parent) return false;
  if (
    parent.type === "Property" &&
    parent.value === node &&
    propertyName(parent.key) === "handler"
  ) {
    const object = parent.parent;
    return (
      object?.type === "ObjectExpression" &&
      object.parent?.type === "CallExpression" &&
      isConvexFactory(object.parent.callee)
    );
  }
  if (parent.type !== "CallExpression" || !parent.arguments.includes(node)) {
    return false;
  }
  return (
    isConvexFactory(parent.callee) ||
    (parent.callee.type === "MemberExpression" &&
      propertyName(parent.callee.property) === "handler")
  );
};

const isConvexFactory = (callee) => {
  const name =
    callee.type === "Identifier"
      ? callee.name
      : callee.type === "MemberExpression"
        ? propertyName(callee.property)
        : null;
  return (
    name !== null &&
    /(?:query|mutation|action|httpAction)(?:Generic)?$/i.test(name)
  );
};

const propertyName = (node) =>
  node.type === "Identifier"
    ? node.name
    : node.type === "Literal" && typeof node.value === "string"
      ? node.value
      : null;
