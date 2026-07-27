import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

export function hashSourceFiles(
  repoRoot: string,
  sourceCommit: string,
  paths: readonly string[],
): Readonly<Record<string, string>> {
  const result = spawnSync("git", ["cat-file", "--batch"], {
    cwd: repoRoot,
    input: `${paths.map((path) => `${sourceCommit}:${path}`).join("\n")}\n`,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Unable to read immutable source files: ${result.stderr.toString("utf8")}`,
    );
  }

  const hashes: Record<string, string> = {};
  let offset = 0;
  for (const path of paths) {
    const headerEnd = result.stdout.indexOf(10, offset);
    if (headerEnd < 0) throw new Error(`Missing git object header: ${path}`);
    const header = result.stdout.toString("utf8", offset, headerEnd);
    const [, kind, rawSize] = header.split(" ");
    const size = Number(rawSize);
    if (kind !== "blob" || !Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Invalid git object for immutable source path: ${path}`);
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (result.stdout[contentEnd] !== 10) {
      throw new Error(
        `Truncated git object for immutable source path: ${path}`,
      );
    }
    hashes[path] = `sha256:${createHash("sha256")
      .update(result.stdout.subarray(contentStart, contentEnd))
      .digest("hex")}`;
    offset = contentEnd + 1;
  }
  return hashes;
}
