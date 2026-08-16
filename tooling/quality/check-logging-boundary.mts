import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type LoggingBoundaryFinding = {
  readonly file: string;
  readonly line: number;
  readonly method: string;
  readonly message: string;
};

export type LoggingBoundaryResult = {
  readonly ok: boolean;
  readonly findings: readonly LoggingBoundaryFinding[];
};

const scannedRoots = ["apps", "packages"] as const;
const upstreamLoggingFiles = new Set([
  "apps/web/src/components/invite-people-modal/invite-people-modal.tsx",
  "apps/web/src/components/manage-tags-modal/manage-tags.tsx",
  "apps/web/src/features/billing/components/pricing-table.tsx",
  "apps/web/src/features/common/components/invite-people.tsx",
  "apps/web/src/features/contacts/list/add-person-dialog.tsx",
  "apps/web/src/features/contacts/list/contact-bulk-actions.tsx",
  "apps/web/src/features/contacts/list/list-page.tsx",
  "apps/web/src/features/settings/billing/manage-billing-button.tsx",
  "apps/web/src/features/settings/billing/plans-page.tsx",
  "apps/web/src/features/settings/tags/manage-tags.tsx",
  "apps/web/src/features/workspaces/invite/accept-invite-page.tsx",
  "packages/i18n/src/provider.server.tsx",
  "packages/i18n/src/provider.tsx",
]);
const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"];
const consolePattern = /\bconsole\.(log|error|warn|info|debug|trace)\b/g;

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

export function evaluateLoggingBoundarySource(
  file: string,
  source: string,
): readonly LoggingBoundaryFinding[] {
  if (upstreamLoggingFiles.has(file)) return [];

  const findings: LoggingBoundaryFinding[] = [];

  for (const match of source.matchAll(consolePattern)) {
    findings.push({
      file,
      line: lineNumberFor(source, match.index ?? 0),
      method: match[1] ?? "unknown",
      message:
        "Product runtime code must not use console logging; route events through typed redacted observability or CLI output seams.",
    });
  }

  return findings;
}

export async function evaluateLoggingBoundary(
  repoRoot = process.cwd(),
): Promise<LoggingBoundaryResult> {
  const files = (
    await Promise.all(scannedRoots.map((root) => listFiles(repoRoot, root)))
  )
    .flat()
    .map(toRepoPath)
    .filter(isSourceFile);

  const findings = (
    await Promise.all(
      files.map(async (file) =>
        evaluateLoggingBoundarySource(
          file,
          await readFile(join(repoRoot, file), "utf8"),
        ),
      ),
    )
  ).flat();

  return { ok: findings.length === 0, findings };
}

export async function runLoggingBoundaryCheck(
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateLoggingBoundary(repoRoot);

  if (result.ok) {
    console.log("check:logging-boundary passed");
    return;
  }

  for (const finding of result.findings) {
    console.error(
      `${finding.file}:${finding.line}: ${finding.message} (console.${finding.method})`,
    );
  }
  process.exitCode = 1;
}

if (isDirectRun(import.meta.url)) await runLoggingBoundaryCheck();
