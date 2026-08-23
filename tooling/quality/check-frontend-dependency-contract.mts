import { execFileSync } from "node:child_process";

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
  "@tiptap/core": "3.30.1",
  "@tiptap/pm": "3.30.1",
} as const;

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
      "--recursive",
      "--depth",
      "Infinity",
      "--json",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output) as readonly DependencyTree[];
};

export const checkFrontendDependencyContract = (
  root = process.cwd(),
): readonly string[] =>
  assertFrontendDependencyContract(installedDependencyTree(root));

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
