const prohibitedElements = new Set([
  "button",
  "dialog",
  "input",
  "select",
  "table",
  "textarea",
]);

const isWorkspaceExample = (filename) => {
  const path = filename.split("\\").join("/");
  return (
    path.includes("apps/web/src/saas-ui/") ||
    path.includes("apps/web/src/routes/_workspace")
  );
};

const attributeValue = (node, name) => {
  const attribute = node.attributes.find(
    (candidate) =>
      candidate.type === "JSXAttribute" && candidate.name.name === name,
  );
  const value = attribute?.value;
  if (value?.type === "Literal") return value.value;
  if (
    value?.type === "JSXExpressionContainer" &&
    value.expression.type === "Literal"
  ) {
    return value.expression.value;
  }
  return undefined;
};

const isApprovedNativeControl = (node, name) =>
  name === "input" &&
  ["checkbox", "file"].includes(attributeValue(node, "type"));

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Prefer Saas UI primitives in workspace examples",
    },
    schema: [],
    messages: {
      preferPrimitive:
        "Use the installed Saas UI or Chakra primitive instead of raw <{{name}}> in workspace examples.",
    },
  },
  create(context) {
    if (!isWorkspaceExample(context.filename)) return {};

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const name = node.name.name;
        if (
          !prohibitedElements.has(name) ||
          isApprovedNativeControl(node, name)
        ) {
          return;
        }
        context.report({
          node: node.name,
          messageId: "preferPrimitive",
          data: { name },
        });
      },
    };
  },
};
