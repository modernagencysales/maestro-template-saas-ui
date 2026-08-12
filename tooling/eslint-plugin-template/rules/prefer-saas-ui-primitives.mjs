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

function normalizedFilename(context) {
  return (context.filename ?? context.getFilename()).replace(/\\/g, "/");
}

function inGuardedScope(filename) {
  return (
    /(?:^|\/)(?:apps|packages)\/.*\.(?:ts|tsx)$/.test(filename) ||
    /tooling\/generators\/.*\.(?:ts|tsx)$/.test(filename) ||
    /generated\/.*\.(?:ts|tsx)$/.test(filename)
  );
}

function isAuthorizedRoot(filename) {
  return [
    "apps/web/src/features/common/",
    "apps/web/src/theme/",
    "apps/web/src/saas-ui/",
    "generated/fixtures/upstream/",
  ].some((root) => filename.includes(root));
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
      isAuthorizedRoot(filename) ||
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
    };
  },
};
