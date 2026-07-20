import type { AuthorityRepairTransition } from "./manifest.js";

export const validateAuthorityRepairRewrite = (input: {
  readonly changedFiles: readonly string[];
  readonly fileLocks: readonly string[];
  readonly transition: AuthorityRepairTransition;
}): void => {
  const changed = new Set(input.changedFiles);
  const owned = new Set(input.fileLocks);
  for (const mapping of input.transition.supersededPaths) {
    if (changed.has(mapping.path)) {
      throw new Error(
        `authority-repair superseded path remains: ${mapping.path}`,
      );
    }
    if (!changed.has(mapping.replacementPath)) {
      throw new Error(
        `authority-repair replacement path is absent: ${mapping.replacementPath}`,
      );
    }
  }
  const unowned = input.changedFiles.filter((path) => !owned.has(path));
  if (unowned.length > 0) {
    throw new Error(
      `authority-repair paths not declared in current manifest fileLocks: ${unowned.join(", ")}`,
    );
  }
};
