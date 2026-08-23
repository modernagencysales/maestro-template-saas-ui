import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isDirectRun } from "./src/direct-run.mts";

export type DependencyTree = Readonly<{
  name?: string;
  version?: string;
  dependencies?: Readonly<Record<string, DependencyTree>>;
  devDependencies?: Readonly<Record<string, DependencyTree>>;
  optionalDependencies?: Readonly<Record<string, DependencyTree>>;
}>;

const testedVersions = {
  "@dnd-kit/sortable": "8.0.0",
  "@internationalized/date": "3.10.0",
  "@tiptap/core": "3.30.1",
  "@tiptap/pm": "3.30.1",
} as const;

const themeButtonVariants = [
  "glass",
  "primary",
  "secondary",
  "tertiary",
] as const;

export const missingButtonRecipeVariants = (
  source: string,
): readonly string[] =>
  themeButtonVariants.filter((variant) => !source.includes(`"${variant}"`));

const generatedPresetTypeImport =
  /import(?:\s+type)?\s*\{[^}]*\b(?:type\s+)?\w+VariantProps\b[^}]*\}\s*from\s*["']@saas-ui\/chakra-preset\/(?:slot-)?recipes\//u;

export const findGeneratedPresetTypeImports = (
  files: Readonly<Record<string, string>>,
): readonly string[] =>
  Object.entries(files)
    .flatMap(([path, source]) =>
      generatedPresetTypeImport.test(source)
        ? [
            `${path} imports an unpublished generated VariantProps type from @saas-ui/chakra-preset`,
          ]
        : [],
    )
    .sort();

export const collectResolvedVersions = (
  roots: readonly DependencyTree[],
): ReadonlyMap<string, ReadonlySet<string>> => {
  const versions = new Map<string, Set<string>>();
  const visit = (node: DependencyTree, fallbackName?: string): void => {
    const name = node.name ?? fallbackName;
    if (name && node.version) {
      const resolved = versions.get(name) ?? new Set<string>();
      resolved.add(node.version);
      versions.set(name, resolved);
    }
    for (const group of [
      node.dependencies,
      node.devDependencies,
      node.optionalDependencies,
    ]) {
      for (const [dependencyName, dependency] of Object.entries(group ?? {}))
        visit(dependency, dependencyName);
    }
  };
  for (const root of roots) visit(root);
  return versions;
};

export const assertFrontendDependencyContract = (
  roots: readonly DependencyTree[],
): readonly string[] => {
  const versions = collectResolvedVersions(roots);
  return Object.entries(testedVersions).flatMap(([name, expected]) => {
    const found = [...(versions.get(name) ?? [])].sort();
    return found.length === 1 && found[0] === expected
      ? []
      : [
          `${name} must resolve only to ${expected}; found ${found.join(", ") || "nothing"}`,
        ];
  });
};

const installedDependencyTree = (root: string): readonly DependencyTree[] => {
  const output = execFileSync(
    "pnpm",
    [
      "list",
      "@tiptap/core",
      "@tiptap/pm",
      "@dnd-kit/sortable",
      "@internationalized/date",
      "--recursive",
      "--depth",
      "Infinity",
      "--json",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output) as readonly DependencyTree[];
};

const frontendSources = (root: string): Readonly<Record<string, string>> => {
  const paths = execFileSync(
    "git",
    ["ls-files", "apps/web/src", "packages/ui/src"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  )
    .split("\n")
    .filter((path) => /\.[cm]?tsx?$/u.test(path));
  return Object.fromEntries(
    paths.map((path) => [path, readFileSync(resolve(root, path), "utf8")]),
  );
};

export const checkFrontendDependencyContract = (
  root = process.cwd(),
): readonly string[] => {
  const buttonTypes = readFileSync(
    resolve(
      root,
      "apps/web/node_modules/@chakra-ui/react/dist/types/styled-system/generated/recipes.gen.d.ts",
    ),
    "utf8",
  );
  const missingVariants = missingButtonRecipeVariants(buttonTypes);
  return [
    ...assertFrontendDependencyContract(installedDependencyTree(root)),
    ...findGeneratedPresetTypeImports(frontendSources(root)),
    ...(missingVariants.length > 0
      ? [
          `Chakra Button recipe types are missing theme variants: ${missingVariants.join(", ")}`,
        ]
      : []),
  ];
};

if (isDirectRun(import.meta.url)) {
  const errors = checkFrontendDependencyContract();
  if (errors.length > 0) {
    for (const error of errors)
      console.error(`check:frontend-dependency-contract: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("check:frontend-dependency-contract: ok");
  }
}
