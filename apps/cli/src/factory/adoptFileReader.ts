import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const contained = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
};

export const readBoundedAdoptionPacket = async (
  root: string,
  path: string,
  maxBytes: number,
): Promise<string> => {
  const canonicalRoot = await realpath(root);
  const candidate = resolve(canonicalRoot, path);
  if (!contained(canonicalRoot, candidate))
    throw new Error("Adoption packet escapes the repository root.");

  const fromRoot = relative(canonicalRoot, candidate);
  let cursor = canonicalRoot;
  const parts = fromRoot === "" ? [] : fromRoot.split(sep);
  for (const [index, part] of parts.entries()) {
    cursor = resolve(cursor, part);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink())
      throw new Error("Adoption packet paths cannot contain symbolic links.");
    if (index < parts.length - 1 && !stats.isDirectory())
      throw new Error("Adoption packet parent is not a directory.");
  }

  const canonicalCandidate = await realpath(candidate);
  if (!contained(canonicalRoot, canonicalCandidate))
    throw new Error("Adoption packet resolves outside the repository root.");
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(candidate, constants.O_RDONLY | noFollow);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > maxBytes)
      throw new Error("Adoption packet is not a bounded regular file.");
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes + 1, 0);
    if (bytesRead > maxBytes)
      throw new Error("Adoption packet exceeds the bounded read limit.");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
};
