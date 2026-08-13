const prohibitedElements = new Set([
  "button",
  "dialog",
  "input",
  "select",
  "table",
  "textarea",
]);

const foundationalComponents = new Set([
  "AppShell",
  "Button",
  "DataGrid",
  "Dialog",
  "Drawer",
  "EmptyState",
  "Page",
  "Sidebar",
  "Table",
]);

const approvedComponentSource = (source) =>
  source === "@chakra-ui/react" ||
  source.startsWith("@chakra-ui/react/") ||
  source === "@saas-ui/react" ||
  source.startsWith("@saas-ui/react/") ||
  source === "@saas-ui-pro/react" ||
  source.startsWith("@saas-ui-pro/") ||
  source.includes("saas-ui/patterns");

const normalizedPath = (filename) => filename.split("\\").join("/");

const isWorkspaceExample = (filename) => {
  const path = normalizedPath(filename);
  return (
    path.includes("apps/web/src/saas-ui/") ||
    path.includes("apps/web/src/routes/_workspace")
  );
};

const isProductUi = (filename) => {
  const path = normalizedPath(filename);
  return (
    path.includes("apps/web/src/features/") ||
    path.includes("apps/web/src/screens/") ||
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
      foundationalSubstitute:
        "Import {{name}} from Saas UI, Chakra, or the checked-in Saas UI pattern shelf instead of defining or importing a substitute.",
    },
  },
  create(context) {
    const checkNativeControls =
      isWorkspaceExample(context.filename) || isProductUi(context.filename);
    const checkFoundationalComponents = isProductUi(context.filename);
    if (!checkNativeControls && !checkFoundationalComponents) return {};

    const reportFoundationalSubstitute = (node, name) => {
      if (!foundationalComponents.has(name)) return;
      context.report({
        node,
        messageId: "foundationalSubstitute",
        data: { name },
      });
    };

    return {
      ImportDeclaration(node) {
        if (!checkFoundationalComponents) return;
        const source = String(node.source.value);
        if (approvedComponentSource(source)) return;
        for (const specifier of node.specifiers) {
          reportFoundationalSubstitute(specifier.local, specifier.local.name);
        }
      },
      FunctionDeclaration(node) {
        if (!checkFoundationalComponents || node.id === null) return;
        reportFoundationalSubstitute(node.id, node.id.name);
      },
      VariableDeclarator(node) {
        if (!checkFoundationalComponents || node.id.type !== "Identifier")
          return;
        reportFoundationalSubstitute(node.id, node.id.name);
      },
      JSXOpeningElement(node) {
        if (!checkNativeControls) return;
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
