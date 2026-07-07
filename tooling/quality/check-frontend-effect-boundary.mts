import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type FrontendEffectBoundaryFinding = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export type FrontendEffectBoundaryResult = {
  readonly ok: boolean;
  readonly findings: readonly FrontendEffectBoundaryFinding[];
};

const scannedRoots = [
  "apps/web/src",
  "packages/frontend-effect",
  "packages/editor-react/src",
  "packages/workflow-ui/src",
] as const;

const approvedEffectRuntimeFile = "apps/web/src/adapters/effectBoundary.ts";
const approvedEffectAtomPrefixes = [
  "apps/web/src/effect-atom/",
  "packages/frontend-effect/",
] as const;

const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"];

const toRepoPath = (path: string): string => path.split(sep).join("/");

const isSourceFile = (path: string): boolean =>
  sourceExtensions.some((extension) => path.endsWith(extension)) &&
  !path.includes(".test.") &&
  !path.includes(".spec.") &&
  !path.includes("/__tests__/") &&
  !path.includes("/_generated/");

async function listFiles(repoRoot: string, dir: string): Promise<string[]> {
  const fullDir = join(repoRoot, dir);
  if (!existsSync(fullDir)) return [];

  const entries = await readdir(fullDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(repoRoot, path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const lineNumberFor = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

function collectPatternFindings(
  source: string,
  pattern: RegExp,
  file: string,
  message: string,
): FrontendEffectBoundaryFinding[] {
  const findings: FrontendEffectBoundaryFinding[] = [];

  for (const match of source.matchAll(pattern)) {
    findings.push({
      file,
      line: lineNumberFor(source, match.index ?? 0),
      message,
    });
  }

  return findings;
}

export function evaluateFrontendEffectBoundarySource(
  file: string,
  source: string,
): readonly FrontendEffectBoundaryFinding[] {
  const findings: FrontendEffectBoundaryFinding[] = [];

  if (file !== approvedEffectRuntimeFile) {
    findings.push(
      ...collectPatternFindings(
        source,
        /\bEffect\.run(?:Promise|PromiseExit|Sync|SyncExit|Fork|Callback)\b/g,
        file,
        "Effect runtime execution is only allowed in apps/web/src/adapters/effectBoundary.ts.",
      ),
    );
  }

  findings.push(
    ...collectPatternFindings(
      source,
      /\bfrom\s+["']effect["']/g,
      file,
      'Client code must import Effect submodules such as "effect/Effect", not the effect barrel.',
    ),
  );

  const effectAtomAllowed = approvedEffectAtomPrefixes.some((prefix) =>
    file.startsWith(prefix),
  );
  if (!effectAtomAllowed) {
    findings.push(
      ...collectPatternFindings(
        source,
        /\bfrom\s+["']@effect-atom\/[^"']+["']/g,
        file,
        "@effect-atom/* imports are only allowed under apps/web/src/effect-atom/ or packages/frontend-effect/.",
      ),
    );
  }

  return findings;
}

export async function evaluateFrontendEffectBoundary(
  repoRoot = process.cwd(),
): Promise<FrontendEffectBoundaryResult> {
  const files = (
    await Promise.all(scannedRoots.map((root) => listFiles(repoRoot, root)))
  )
    .flat()
    .map(toRepoPath)
    .filter(isSourceFile);

  const findings = (
    await Promise.all(
      files.map(async (file) =>
        evaluateFrontendEffectBoundarySource(
          file,
          await readFile(join(repoRoot, file), "utf8"),
        ),
      ),
    )
  ).flat();

  return { ok: findings.length === 0, findings };
}

export async function runFrontendEffectBoundaryCheck(
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateFrontendEffectBoundary(repoRoot);

  if (result.ok) {
    console.log("check:frontend-effect-boundary passed");
    return;
  }

  for (const finding of result.findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.message}`);
  }
  process.exitCode = 1;
}

if (isDirectRun(import.meta.url)) await runFrontendEffectBoundaryCheck();
