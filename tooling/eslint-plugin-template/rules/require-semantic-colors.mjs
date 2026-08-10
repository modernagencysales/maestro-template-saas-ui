const colorProperties = new Set([
  "background",
  "backgroundColor",
  "bg",
  "borderColor",
  "caretColor",
  "color",
  "colorPalette",
  "fill",
  "floodColor",
  "outlineColor",
  "stopColor",
  "stroke",
  "textDecorationColor",
]);

const allowedExactValues = new Set([
  "currentColor",
  "inherit",
  "none",
  "transparent",
  "unset",
]);

const semanticRoots = new Set([
  "accent",
  "bg",
  "border",
  "chart",
  "fg",
  "focusRing",
  "sidebar",
]);

const rawColorPrefixes = [
  "#",
  "color(",
  "hsl(",
  "hsla(",
  "hwb(",
  "lab(",
  "lch(",
  "oklab(",
  "oklch(",
  "rgb(",
  "rgba(",
];

const namedUtilityColors = new Set([
  "amber",
  "black",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "gray",
  "green",
  "grey",
  "indigo",
  "lime",
  "neutral",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "slate",
  "stone",
  "teal",
  "violet",
  "white",
  "yellow",
  "zinc",
]);

const colorUtilityPrefixes = new Set([
  "accent",
  "bg",
  "border",
  "caret",
  "fill",
  "from",
  "outline",
  "ring",
  "shadow",
  "stroke",
  "text",
  "to",
  "via",
]);

const propertyName = (node) => {
  if (node.computed) return undefined;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value;
  }
  return undefined;
};

const literalString = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value.trim();
  }
  if (node?.type === "JSXExpressionContainer") {
    return literalString(node.expression);
  }
  return undefined;
};

const isRawColorLiteral = (value) =>
  rawColorPrefixes.some((prefix) => value.includes(prefix));

const hasNamedColorUtility = (value) =>
  value.split(" ").some((token) => {
    const utility = token.split(":").at(-1) ?? "";
    const [prefix, color] = utility.split("-");
    return colorUtilityPrefixes.has(prefix) && namedUtilityColors.has(color);
  });

const isSemanticColor = (value) => {
  if (allowedExactValues.has(value)) return true;
  if (value.startsWith("var(--chakra-colors-")) return true;
  if (value.startsWith("{colors.") && value.endsWith("}")) return true;
  const root = value.split(".")[0];
  return semanticRoots.has(root);
};

const reportLiteral = (context, node, name, value) => {
  if (name !== "colorPalette" && isSemanticColor(value)) return;
  context.report({
    node,
    messageId: "semanticColor",
    data: { name, value },
  });
};

export default {
  meta: {
    type: "problem",
    docs: { description: "Require semantic color sources in application code" },
    schema: [],
    messages: {
      semanticColor:
        "Use a declared semantic color role or currentColor for {{name}} instead of {{value}}.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const name = node.name.name;
        const value = literalString(node.value);
        if (name === "className" && value !== undefined) {
          if (isRawColorLiteral(value) || hasNamedColorUtility(value)) {
            reportLiteral(context, node, name, value);
          }
          return;
        }
        if (!colorProperties.has(name)) return;
        if (value !== undefined) reportLiteral(context, node, name, value);
      },
      Property(node) {
        const name = propertyName(node);
        const value = literalString(node.value);
        if (
          name === "value" &&
          value !== undefined &&
          isRawColorLiteral(value)
        ) {
          reportLiteral(context, node, name, value);
          return;
        }
        if (name === undefined || !colorProperties.has(name)) return;
        if (value !== undefined) reportLiteral(context, node, name, value);
      },
    };
  },
};
