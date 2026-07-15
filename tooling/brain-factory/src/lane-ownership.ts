const HAND_AUTHORED_CONVEX_FILES = new Set([
  "packages/convex/convex/auth.config.ts",
  "packages/convex/convex/convex.config.ts",
  "packages/convex/convex/http.ts",
  "packages/convex/convex/tsconfig.json",
]);

const isGeneratedNamespaceFile = (file: string): boolean =>
  file === "apps/web/src/routeTree.gen.ts" ||
  file === "packages/template-core/src/generated/confectManifest.ts" ||
  file.startsWith("packages/convex/confect/_generated/") ||
  (file.startsWith("packages/convex/convex/") &&
    !HAND_AUTHORED_CONVEX_FILES.has(file));

// This broad namespace check is only a lane-side prohibition. Integration
// authorization uses an exact allowlist plus reproducibility proof.
export const isIntegrationOwnedGeneratedFile = isGeneratedNamespaceFile;

const fixedGeneratedFiles = new Set([
  "apps/web/src/routeTree.gen.ts",
  "packages/template-core/src/generated/confectManifest.ts",
]);

export const integrationGeneratedFileAllowlist = (input: {
  readonly baseFiles: readonly string[];
  readonly laneFiles: readonly string[];
}): ReadonlySet<string> => {
  const allowed = new Set(
    input.baseFiles.filter((file) => isGeneratedNamespaceFile(file)),
  );
  for (const file of fixedGeneratedFiles) allowed.add(file);
  for (const file of input.laneFiles) {
    const implementation = /^packages\/convex\/confect\/(.+)\.impl\.ts$/.exec(
      file,
    );
    if (implementation?.[1]) {
      const relative = implementation[1];
      allowed.add(
        `packages/convex/confect/_generated/registeredFunctions/${relative}.ts`,
      );
      allowed.add(`packages/convex/convex/${relative}.ts`);
    }
    const table = /^packages\/convex\/confect\/tables\/([^/]+)\.ts$/.exec(file);
    if (table?.[1]) {
      allowed.add(`packages/convex/confect/_generated/tables/${table[1]}.ts`);
    }
  }
  return allowed;
};

export const laneFileOwnershipIssues = (
  changedFiles: readonly string[],
  fileLocks: readonly string[],
): string[] => {
  const exactLocks = new Set(fileLocks.filter((lock) => !lock.startsWith("@")));
  return changedFiles.flatMap((file) =>
    isGeneratedNamespaceFile(file)
      ? [`${file}: generated output is integration-owned`]
      : exactLocks.has(file)
        ? []
        : [`${file}: not declared in manifest fileLocks`],
  );
};

export const laneHistoryOwnershipIssues = (
  commits: readonly {
    readonly commit: string;
    readonly files: readonly string[];
  }[],
  fileLocks: readonly string[],
): string[] =>
  commits.flatMap(({ commit, files }) =>
    laneFileOwnershipIssues(files, fileLocks).map(
      (issue) => `${commit}: ${issue}`,
    ),
  );
