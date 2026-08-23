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

const starterRecipeVariants = {
  Badge: { variant: ["ghost"] },
  Menu: { variant: ["compact", "default"] },
  Tabs: { size: ["xs"], variant: ["pills"] },
} as const;

export const missingStarterRecipeVariants = (
  source: string,
): readonly string[] =>
  Object.entries(starterRecipeVariants).flatMap(([recipe, fields]) => {
    const body = new RegExp(
      `export interface ${recipe}Variant \\{([\\s\\S]*?)\\n\\}`,
      "u",
    ).exec(source)?.[1];
    return Object.entries(fields).flatMap(([field, variants]) =>
      variants.flatMap((variant) =>
        body?.includes(`"${variant}"`) ? [] : [`${recipe}.${field}:${variant}`],
      ),
    );
  });

export const hasMenuButtonValueOmission = (source: string): boolean =>
  /MenuButtonProps\s+extends\s+Omit<ButtonProps,\s*["']value["']>/u.test(
    source,
  );

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

const removedFrontendExports = [
  {
    module: "@chakra-ui/react",
    name: "TagProps",
    pattern:
      /import(?:\s+type)?\s*\{[^}]*\bTagProps\b[^}]*\}\s*from\s*["']@chakra-ui\/react["']/u,
  },
  {
    module: "@saas-ui/react",
    name: "HotkeysConfig",
    pattern:
      /import(?:\s+type)?\s*\{[^}]*\bHotkeysConfig\b[^}]*\}\s*from\s*["']@saas-ui\/react["']/u,
  },
  {
    module: "@saas-ui/react",
    name: "LoadingSpinner",
    pattern:
      /import(?:\s+type)?\s*\{[^}]*\bLoadingSpinner\b[^}]*\}\s*from\s*["']@saas-ui\/react["']/u,
  },
] as const;

export const findLegacyFrontendApiImports = (
  files: Readonly<Record<string, string>>,
): readonly string[] =>
  Object.entries(files)
    .flatMap(([path, source]) =>
      removedFrontendExports.flatMap(({ module, name, pattern }) =>
        pattern.test(source)
          ? [`${path} imports removed ${name} from ${module}`]
          : [],
      ),
    )
    .sort();

const materializedShellPrimitives = [
  {
    path: "apps/web/src/components/default-loader.tsx",
    name: "LoadingOverlay",
  },
  {
    path: "apps/web/src/features/common/layouts/app-layout.tsx",
    name: "Sidebar",
  },
  {
    path: "apps/web/src/features/common/components/app-sidebar.tsx",
    name: "Sidebar",
  },
  {
    path: "apps/web/src/features/common/components/app-sidebar.tsx",
    name: "useSidebar",
  },
  {
    path: "apps/web/src/features/reports/reports-page.tsx",
    name: "Sidebar",
  },
  {
    path: "apps/web/src/features/reports/reports-page.tsx",
    name: "useSidebar",
  },
  {
    path: "apps/web/src/features/settings/common/settings-sidebar.tsx",
    name: "Sidebar",
  },
] as const;

export const findUnmaterializedShellImports = (
  files: Readonly<Record<string, string>>,
): readonly string[] =>
  materializedShellPrimitives.flatMap(({ path, name }) => {
    const source = files[path];
    if (
      source === undefined ||
      !new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']@saas-ui/react["']`,
        "u",
      ).test(source)
    ) {
      return [];
    }
    return [`${path} must use the materialized ${name} registry primitive`];
  });

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
  const sources = frontendSources(root);
  const buttonTypes = readFileSync(
    resolve(
      root,
      "apps/web/node_modules/@chakra-ui/react/dist/types/styled-system/generated/recipes.gen.d.ts",
    ),
    "utf8",
  );
  const saasUiPatch = readFileSync(
    resolve(root, "patches/@saas-ui__react@3.0.0-next.51.patch"),
    "utf8",
  );
  const missingVariants = missingButtonRecipeVariants(buttonTypes);
  const missingRecipeVariants = missingStarterRecipeVariants(buttonTypes);
  return [
    ...assertFrontendDependencyContract(installedDependencyTree(root)),
    ...findGeneratedPresetTypeImports(sources),
    ...findLegacyFrontendApiImports(sources),
    ...findUnmaterializedShellImports(sources),
    ...(missingVariants.length > 0
      ? [
          `Chakra Button recipe types are missing theme variants: ${missingVariants.join(", ")}`,
        ]
      : []),
    ...(missingRecipeVariants.length > 0
      ? [
          `Chakra recipe types are missing Starter variants: ${missingRecipeVariants.join(", ")}`,
        ]
      : []),
    ...(!hasMenuButtonValueOmission(saasUiPatch)
      ? ["Saas UI Menu.Button patch must omit the conflicting value prop"]
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
