import {
  isSaasUiRegistryReceiptFile,
  receiptOption,
} from "../saas-ui-registry-receipt.mjs";

/**
 * Keep shell compositions in the manifest-authorized upstream shell roots.
 * This is intentionally a name/import boundary, not a visual-style score.
 */
const SHELL_NAMES = new Set([
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
  if (specifier.type === "ImportDefaultSpecifier") return specifier.local.name;
  if (specifier.type === "ImportNamespaceSpecifier") return null;
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : String(specifier.imported.value);
}

function declaredName(node) {
  if (node.id?.type === "Identifier") return node.id.name;
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Keep the Saas UI shell under its authority root" },
    schema: [
      {
        type: "object",
        properties: { receiptPath: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      shellOnly:
        "`{{name}}` is shell-authority code and must stay in the manifest-authorized Saas UI shell root.",
    },
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (
      !inGuardedScope(filename) ||
      isSaasUiRegistryReceiptFile(filename, receiptOption(context)) ||
      isAuthorizedRoot(filename) ||
      isFixtureOrTest(filename)
    ) {
      return {};
    }

    const report = (node, name) =>
      context.report({ node, messageId: "shellOnly", data: { name } });

    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        for (const specifier of node.specifiers) {
          const name = importedName(specifier);
          if (!name || !SHELL_NAMES.has(name)) continue;
          if (OFFICIAL_SOURCES.has(source) || source.startsWith(".")) {
            report(specifier, name);
          }
        }
      },
      FunctionDeclaration(node) {
        const name = declaredName(node);
        if (name && SHELL_NAMES.has(name)) report(node.id, name);
      },
      ClassDeclaration(node) {
        const name = declaredName(node);
        if (name && SHELL_NAMES.has(name)) report(node.id, name);
      },
      VariableDeclarator(node) {
        const name = declaredName(node);
        if (name && SHELL_NAMES.has(name)) report(node.id, name);
      },
    };
  },
};
