import {
  isSaasUiStarterReceiptFile,
  isSaasUiRegistryReceiptFile,
  receiptOption,
} from "../saas-ui-registry-receipt.mjs";

/**
 * Keep shell compositions in the manifest-authorized upstream shell roots.
 * This is intentionally a name/import boundary, not a visual-style score.
 */
const TOP_LEVEL_SHELL_NAMES = new Set(["AppShell", "Sidebar"]);
const LOCAL_PRIMITIVE_NAMES = new Set([
  "AppShell",
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
    /tooling\/generators\/.*\.(?:ts|tsx|txt)$/.test(filename) ||
    /generated\/.*\.(?:ts|tsx)$/.test(filename)
  );
}

function isFixtureOrTest(filename) {
  return /(?:\.test\.|__fixtures__|generated\/fixtures\/)/.test(filename);
}

function isShellAuthorityRoot(filename) {
  return /apps\/web\/src\/features\/common\//.test(filename);
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
      isSaasUiStarterReceiptFile(filename, receiptOption(context)) ||
      isShellAuthorityRoot(filename) ||
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
          const names = OFFICIAL_SOURCES.has(source)
            ? TOP_LEVEL_SHELL_NAMES
            : source.startsWith(".")
              ? LOCAL_PRIMITIVE_NAMES
              : null;
          if (name && names?.has(name)) {
            report(specifier, name);
          }
        }
      },
      FunctionDeclaration(node) {
        const name = declaredName(node);
        if (name && LOCAL_PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
      ClassDeclaration(node) {
        const name = declaredName(node);
        if (name && LOCAL_PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
      VariableDeclarator(node) {
        const name = declaredName(node);
        if (name && LOCAL_PRIMITIVE_NAMES.has(name)) report(node.id, name);
      },
    };
  },
};
