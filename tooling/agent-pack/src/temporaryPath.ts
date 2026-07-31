import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function isDirectTemporaryPath(path: string): Promise<boolean> {
  return isDirectPathWithinRoot(path, tmpdir());
}

export async function isDirectPathWithinRoot(
  path: string,
  root: string,
): Promise<boolean> {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  const relativePath = relative(resolvedRoot, resolvedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return false;
  }

  const canonicalRoot = await realpath(resolvedRoot);
  const canonicalPath = await realpath(resolvedPath);
  return canonicalPath === resolve(canonicalRoot, relativePath);
}
