import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative, resolve } from "node:path";

import postcss from "postcss";

export interface SemanticColorAssetFinding {
  readonly path: string;
  readonly value: string;
  readonly field?: string;
  readonly attribute?: string;
  readonly property?: string;
}

const allowedPaintValues = new Set([
  "currentColor",
  "inherit",
  "initial",
  "none",
  "revert",
  "revert-layer",
  "transparent",
  "unset",
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

const cssNamedColors = new Set(
  Object.keys(
    createRequire(import.meta.url)("color-name") as Record<
      string,
      readonly number[]
    >,
  ),
);

const containsRawColor = (value: string, allowNamedColor = true): boolean => {
  const normalized = value.trim();
  if (allowedPaintValues.has(normalized)) return false;
  if (rawColorPrefixes.some((prefix) => normalized.includes(prefix)))
    return true;
  if (!allowNamedColor) return false;
  const withoutSemanticTokens = normalized
    .toLowerCase()
    .replaceAll(/var\(--chakra-colors-[^)]+\)/g, "");
  return withoutSemanticTokens
    .split(/[^a-z]+/)
    .some((token) => cssNamedColors.has(token));
};

const cssPaintProperty =
  /^(?:accent-color|background(?:-.+)?|border(?:-.+)?|box-shadow|caret-color|color|column-rule(?:-.+)?|fill|flood-color|outline(?:-.+)?|scrollbar-color|stop-color|stroke|text-decoration(?:-.+)?|text-emphasis(?:-.+)?|text-shadow)$/;

export const inspectAuthoredCss = (
  source: string,
  path: string,
): readonly SemanticColorAssetFinding[] => {
  const findings: SemanticColorAssetFinding[] = [];
  postcss.parse(source, { from: path }).walkDecls((declaration) => {
    if (
      containsRawColor(
        declaration.value,
        cssPaintProperty.test(declaration.prop),
      )
    ) {
      findings.push({
        path,
        property: declaration.prop,
        value: declaration.value,
      });
    }
  });
  return findings;
};

const manifestColorFields = new Set([
  "background_color",
  "theme_color",
  "theme_color_override",
]);

export const inspectManifest = (
  source: string,
  path: string,
): readonly SemanticColorAssetFinding[] => {
  const manifest: unknown = JSON.parse(source);
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    Array.isArray(manifest)
  ) {
    return [];
  }
  return Object.entries(manifest).flatMap(([field, value]) =>
    manifestColorFields.has(field) &&
    typeof value === "string" &&
    containsRawColor(value)
      ? [{ path, field, value }]
      : [],
  );
};

const svgPaintAttributes = new Set([
  "color",
  "fill",
  "flood-color",
  "stop-color",
  "stroke",
]);

const parseTagAttributes = (tag: string): readonly [string, string][] => {
  const attributes = tag.matchAll(/\s([:\w-]+)\s*=\s*(["'])(.*?)\2/gs);
  return [...attributes].map((match) => [match[1], match[3]]);
};

export const inspectSvg = (
  source: string,
  path: string,
): readonly SemanticColorAssetFinding[] => {
  const findings: SemanticColorAssetFinding[] = [];
  let cursor = source.indexOf("<");
  while (cursor >= 0) {
    const end = source.indexOf(">", cursor + 1);
    if (end < 0) break;
    const tag = source.slice(cursor, end + 1);
    for (const [attribute, value] of parseTagAttributes(tag)) {
      if (svgPaintAttributes.has(attribute) && containsRawColor(value)) {
        findings.push({ path, attribute, value });
      }
    }
    cursor = source.indexOf("<", end + 1);
  }
  return findings;
};

const filesUnder = (directory: string): readonly string[] =>
  existsSync(directory)
    ? readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name))
    : [];

export const checkSemanticColorAssets = (
  repoRoot = process.cwd(),
): readonly SemanticColorAssetFinding[] => {
  const webRoot = resolve(repoRoot, "apps/web");
  const files = [
    ...filesUnder(join(webRoot, "src")).filter(
      (path) => extname(path) === ".css",
    ),
    ...filesUnder(join(webRoot, "public")).filter((path) =>
      [".svg", ".webmanifest"].includes(extname(path)),
    ),
  ];
  return files.flatMap((file) => {
    const path = relative(repoRoot, file);
    const source = readFileSync(file, "utf8");
    if (extname(file) === ".css") return inspectAuthoredCss(source, path);
    if (extname(file) === ".svg") return inspectSvg(source, path);
    return inspectManifest(source, path);
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = checkSemanticColorAssets();
  if (findings.length > 0) {
    console.error(JSON.stringify(findings, undefined, 2));
    process.exitCode = 1;
  } else {
    console.log("Semantic color assets passed.");
  }
}
