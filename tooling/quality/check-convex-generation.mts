import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDirectRun } from "./src/direct-run.mts";

export type GeneratedSnapshot = Readonly<Record<string, string>>;

const packageRoot = fileURLToPath(
  new URL("../../packages/convex/", import.meta.url),
);
const generatedRoots = ["confect/_generated", "convex/_generated"] as const;

export function compareGeneratedSnapshots(
  before: GeneratedSnapshot,
  after: GeneratedSnapshot,
): readonly string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path] !== after[path])
    .sort((left, right) => left.localeCompare(right));
}

export function snapshotConvexGeneration(): GeneratedSnapshot {
  return Object.fromEntries(
    generatedRoots.flatMap((root) => snapshotRoot(resolve(packageRoot, root))),
  );
}

function snapshotRoot(root: string): readonly [string, string][] {
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`Generated root must be a real directory: ${root}`);
  }
  const visit = (directory: string): readonly [string, string][] =>
    readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((entry) => {
        const path = resolve(directory, entry.name);
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) {
          throw new Error(
            `Generated snapshots do not follow symbolic links: ${path}`,
          );
        }
        if (stat.isDirectory()) return visit(path);
        if (!stat.isFile()) {
          throw new Error(`Generated snapshot entry is not a file: ${path}`);
        }
        const relativePath = relative(packageRoot, path).split(sep).join("/");
        if (
          !generatedRoots.some((root) => relativePath.startsWith(`${root}/`))
        ) {
          throw new Error(`Generated snapshot escaped its roots: ${path}`);
        }
        return [
          [
            relativePath,
            `sha256:${createHash("sha256")
              .update(readFileSync(path))
              .digest("hex")}`,
          ] as [string, string],
        ];
      });
  return visit(root);
}

if (isDirectRun(import.meta.url)) {
  const before = snapshotConvexGeneration();
  execFileSync("pnpm", ["exec", "confect", "codegen"], {
    cwd: packageRoot,
    stdio: "inherit",
  });
  const drift = compareGeneratedSnapshots(before, snapshotConvexGeneration());
  if (drift.length > 0) {
    process.stderr.write(
      `Codegen introduced generated drift:\n${drift.map((path) => `- ${path}`).join("\n")}\n`,
    );
    process.exitCode = 1;
  } else {
    process.stdout.write("Codegen introduced no generated drift.\n");
  }
}
