import {
  isSaasUiStarterReceiptFile,
  isSaasUiRegistryReceiptFile,
  receiptOption,
} from "../saas-ui-registry-receipt.mjs";

/** Require semantic color roles in visible JSX instead of palette literals. */
const COLOR_PROPERTIES = new Set([
  "bg",
  "background",
  "backgroundColor",
  "borderColor",
  "boxShadow",
  "color",
  "fill",
  "outlineColor",
  "shadowColor",
  "stroke",
]);
function isRawColor(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("#") ||
    normalized.startsWith("rgb") ||
    normalized.startsWith("hsl") ||
    normalized.startsWith("oklch") ||
    /^[a-z][a-z-]*\.\d{2,3}$/.test(normalized)
  );
}

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

function propertyName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "JSXIdentifier") return node.name;
  return node.type === "Literal" && typeof node.value === "string"
    ? node.value
    : null;
}

function literalValue(node) {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return null;
}

function isInsideJsx(node) {
  let current = node.parent;
  while (current) {
    if (current.type === "JSXElement" || current.type === "JSXFragment") {
      return true;
    }
    current = current.parent;
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Require semantic Saas UI color roles" },
    schema: [
      {
        type: "object",
        properties: { receiptPath: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      semanticColor:
        "Use a semantic color role for visible UI; raw colors and palette slots are not permitted here.",
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

    return {
      JSXAttribute(node) {
        const name = propertyName(node.name);
        const value =
          node.value?.type === "Literal" ? String(node.value.value) : "";
        if (COLOR_PROPERTIES.has(name) && isRawColor(value)) {
          context.report({ node, messageId: "semanticColor" });
        }
      },
      Property(node) {
        const name = propertyName(node.key);
        const value = literalValue(node.value);
        if (
          COLOR_PROPERTIES.has(name) &&
          value &&
          isInsideJsx(node) &&
          isRawColor(value)
        ) {
          context.report({ node: node.value, messageId: "semanticColor" });
        }
      },
    };
  },
};
