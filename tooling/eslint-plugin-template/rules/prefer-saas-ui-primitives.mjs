import {
  isSaasUiStarterReceiptFile,
  isSaasUiRegistryReceiptFile,
  receiptOption,
} from "../saas-ui-registry-receipt.mjs";

/** Require visible primitive components to come from the official Saas UI stack. */
const PRIMITIVE_NAMES = new Set([
  "Button",
  "Dialog",
  "Table",
  "DataGrid",
  "Page",
  "Sidebar",
  "Drawer",
  "EmptyState",
]);
const OFFICIAL_SOURCES = new Set([
  "@saas-ui/react",
  "@saas-ui-pro/react",
  "@chakra-ui/react",
]);
const RAW_CONTROLS = new Set([
  "button",
  "dialog",
  "input",
  "select",
  "table",
  "textarea",
]);

function normalizedFilename(context) {
  return (context.filename ?? context.getFilename()).replace(/\\/g, "/");
}

function inGuardedScope(filename) {
  return (
    /(?:^|\/)(?:apps|packages)\/.*\.(?:ts|tsx)$/.test(filename) ||
    /tooling\/generators\/.*\.(?:ts|tsx|txt)$/.test(filename) ||
    /generated\/.*\.(?:ts|tsx)$/.test(filename)
  );
}

function isFixtureOrTest(filename) {
  return /(?:\.test\.|__fixtures__|generated\/fixtures\/)/.test(filename);
}

function importedName(specifier) {
  if (specifier.type === "ImportNamespaceSpecifier") return null;
  if (specifier.type === "ImportDefaultSpecifier") return specifier.local.name;
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : String(specifier.imported.value);
}

function declaredName(node) {
  return node.id?.type === "Identifier" ? node.id.name : null;
}

function approvedNativeInput(node) {
  if (node.name.type !== "JSXIdentifier" || node.name.name !== "input")
    return false;
  const staticAttribute = (name) => {
    const value = node.attributes.find(
      (attribute) =>
        attribute.type === "JSXAttribute" && attribute.name.name === name,
    )?.value;
    return (
      value?.type === "Literal" &&
      typeof value.value === "string" &&
      value.value.trim().length > 0
    );
  };
  const type = node.attributes.find(
    (attribute) =>
      attribute.type === "JSXAttribute" && attribute.name.name === "type",
  )?.value;
  return (
    type?.type === "Literal" &&
    ["checkbox", "file"].includes(type.value) &&
    (staticAttribute("aria-label") || staticAttribute("aria-labelledby"))
  );
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Prefer official Saas UI primitives" },
    schema: [
      {
        type: "object",
        properties: { receiptPath: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      officialPrimitive:
        "`{{name}}` must use the official Saas UI or Chakra primitive; local substitutes are not permitted.",
    },
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (
      !inGuardedScope(filename) ||
      isSaasUiRegistryReceiptFile(filename, receiptOption(context)) ||
      isSaasUiStarterReceiptFile(filename, receiptOption(context)) ||
      isFixtureOrTest(filename)
    ) {
      return {};
    }

    const report = (node, name) =>
      context.report({ node, messageId: "officialPrimitive", data: { name } });

    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (OFFICIAL_SOURCES.has(source)) return;
        for (const specifier of node.specifiers) {
          const name = importedName(specifier);
          if (name && PRIMITIVE_NAMES.has(name)) report(specifier, name);
        }
      },
      FunctionDeclaration(node) {
        const name = declaredName(node);
        if (name && PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
      ClassDeclaration(node) {
        const name = declaredName(node);
        if (name && PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
      VariableDeclarator(node) {
        const name = declaredName(node);
        if (name && PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
      JSXOpeningElement(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          RAW_CONTROLS.has(node.name.name) &&
          !approvedNativeInput(node)
        ) {
          report(node.name, node.name.name);
        }
      },
    };
  },
};
