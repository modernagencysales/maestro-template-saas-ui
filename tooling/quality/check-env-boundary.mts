import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type EnvBoundaryFinding = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export type EnvBoundaryResult = {
  readonly ok: boolean;
  readonly findings: readonly EnvBoundaryFinding[];
};

const scannedRoots = ["apps", "packages"] as const;

const allowedEnvBoundaryFiles = new Set([
  "apps/cli/src/index.ts",
  "apps/web/src/components/default-error-page.tsx",
  "apps/web/src/env.ts",
  "apps/web/src/start.ts",
  "apps/web/src/features/common/util/get-base-url.ts",
  "apps/web/vite.config.ts",
  "packages/convex/convex/auth.config.ts",
  "packages/convex/confect/email/env.ts",
  "packages/convex/confect/shared/env.ts",
  "packages/i18n/src/provider.tsx",
]);

const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"];

const envAccessPatterns = [
  {
    pattern: /\bprocess\.env\b/g,
    message:
      "Product code must read process.env only through the approved env boundary files.",
  },
  {
    pattern: /\bimport\.meta\.env\b/g,
    message:
      "Product code must read import.meta.env only through the approved web env boundary.",
  },
  {
    pattern: /\bDeno\.env\b/g,
    message:
      "Product code must read Deno.env only through an approved env boundary file.",
  },
] as const;

const toRepoPath = (path: string): string => path.split(sep).join("/");

const isSourceFile = (path: string): boolean =>
  sourceExtensions.some((extension) => path.endsWith(extension)) &&
  !path.endsWith(".d.ts") &&
  !path.includes(".test.") &&
  !path.includes(".spec.") &&
  !path.includes("/__tests__/") &&
  !path.includes("/_generated/") &&
  !path.includes("/dist/");

async function listFiles(repoRoot: string, dir: string): Promise<string[]> {
  const fullDir = join(repoRoot, dir);
  if (!existsSync(fullDir)) return [];

  const entries = await readdir(fullDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".output"
      )
        continue;
      files.push(...(await listFiles(repoRoot, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const lineNumberFor = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

export function evaluateEnvBoundarySource(
  file: string,
  source: string,
): readonly EnvBoundaryFinding[] {
  if (allowedEnvBoundaryFiles.has(file)) return [];

  const findings: EnvBoundaryFinding[] = [];

  for (const { pattern, message } of envAccessPatterns) {
    for (const match of source.matchAll(pattern)) {
      findings.push({
        file,
        line: lineNumberFor(source, match.index ?? 0),
        message,
      });
    }
  }

  return findings;
}

export async function evaluateEnvBoundary(
  repoRoot = process.cwd(),
): Promise<EnvBoundaryResult> {
  const files = (
    await Promise.all(scannedRoots.map((root) => listFiles(repoRoot, root)))
  )
    .flat()
    .map(toRepoPath)
    .filter(isSourceFile);

  const findings = (
    await Promise.all(
      files.map(async (file) =>
        evaluateEnvBoundarySource(
          file,
          await readFile(join(repoRoot, file), "utf8"),
        ),
      ),
    )
  ).flat();

  return { ok: findings.length === 0, findings };
}

export async function runEnvBoundaryCheck(
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateEnvBoundary(repoRoot);

  if (result.ok) {
    console.log("check:env-boundary passed");
    return;
  }

  for (const finding of result.findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.message}`);
  }
  process.exitCode = 1;
}

if (isDirectRun(import.meta.url)) await runEnvBoundaryCheck();
