import { isAbsolute, relative, resolve, sep } from "node:path";

export type RepositoryContext = {
  readonly schemaVersion: 1;
  readonly workingDirectory: string;
  readonly sourceRoot: string;
  readonly templateRoot: string;
  readonly targetRoot: string;
};

export type RepositoryContextInput = {
  readonly cwd: string;
  readonly sourceRoot?: string;
  readonly templateRoot?: string;
  readonly targetRoot?: string;
};

export class RepositoryContextError extends Error {
  readonly code = "AGENT_PACK_TARGET_PATH_UNSAFE";

  constructor(path: string) {
    super(`Target path must stay inside the target root: ${path}`);
    this.name = "RepositoryContextError";
  }
}

export function createRepositoryContext(
  input: RepositoryContextInput,
): RepositoryContext {
  const workingDirectory = resolve(input.cwd);
  const sourceRoot = resolve(workingDirectory, input.sourceRoot ?? ".");

  return {
    schemaVersion: 1,
    workingDirectory,
    sourceRoot,
    templateRoot: resolve(workingDirectory, input.templateRoot ?? sourceRoot),
    targetRoot: resolve(workingDirectory, input.targetRoot ?? "."),
  };
}

export function resolveTargetPath(
  context: RepositoryContext,
  path: string,
): string {
  if (path.trim() === "" || isAbsolute(path)) {
    throw new RepositoryContextError(path);
  }

  const targetPath = resolve(context.targetRoot, path);
  const relativeTarget = relative(context.targetRoot, targetPath);
  if (
    relativeTarget === "" ||
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)
  ) {
    throw new RepositoryContextError(path);
  }

  return targetPath;
}
