import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type ProviderBoundaryFinding = {
  readonly file: string;
  readonly line: number;
  readonly module: string;
  readonly message: string;
};

export type ProviderBoundaryResult = {
  readonly ok: boolean;
  readonly findings: readonly ProviderBoundaryFinding[];
};

const scannedRoots = ["apps", "packages"] as const;

const allowedProviderBoundaryPrefixes = [
  "packages/integrations/src/",
  "packages/observability/src/",
  "packages/notifications/src/",
  "packages/storage/src/",
  "packages/search/src/",
] as const;

const allowedProviderBoundaryFiles = new Set([
  "apps/web/src/lib/auth/route-auth.ts",
  "apps/web/src/lib/auth/workos-auth-catch-all.ts",
  "apps/web/src/lib/auth/workos-auth-entry.ts",
  "apps/web/src/lib/auth/workos-auth-loader.ts",
  "apps/web/src/lib/auth/workos-auth.ts",
  "apps/web/src/lib/auth/workos-cookie-session-storage.ts",
  "apps/web/src/lib/auth/workos-logout.ts",
  "apps/web/src/routes/__root.tsx",
  "apps/web/src/routes/api/auth/callback.tsx",
  "apps/web/src/routes/api/auth/sign-in.tsx",
  "apps/web/src/routes/api/auth/sign-up.tsx",
  "apps/web/src/start.ts",
  "packages/convex/convex/convex.config.ts",
  "packages/convex/confect/agents/assistantModel.ts",
  "packages/convex/confect/observability/posthog.ts",
]);

const providerModulePatterns = [
  /^@ai-sdk(?:\/|$)/,
  /^@aws-sdk(?:\/|$)/,
  /^@cloudflare(?:\/|$)/,
  /^@posthog(?:\/|$)/,
  /^@sentry(?:\/|$)/,
  /^@workos(?:\/|$)/,
  /^ai$/,
  /^cloudflare(?:\/|$)/,
  /^dodo(?:\/|$)/,
  /^mailersend(?:\/|$)/,
  /^openai(?:\/|$)/,
  /^posthog(?:-|\/|$)/,
  /^resend(?:\/|$)/,
  /^sentry(?:\/|$)/,
  /^stripe(?:\/|$)/,
  /^workos(?:\/|$)/,
] as const;

const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"];

const importPatterns = [
  /\bimport\s+(?:type\s+)?(?:[^"']+\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?(?:[^"']+\s+from\s+)["']([^"']+)["']/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
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

const lineNumberFor = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

const isProviderModule = (moduleName: string): boolean =>
  providerModulePatterns.some((pattern) => pattern.test(moduleName));

const isAllowedProviderBoundary = (file: string): boolean =>
  allowedProviderBoundaryFiles.has(file) ||
  allowedProviderBoundaryPrefixes.some((prefix) => file.startsWith(prefix));

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

export function evaluateProviderBoundarySource(
  file: string,
  source: string,
): readonly ProviderBoundaryFinding[] {
  const findings: ProviderBoundaryFinding[] = [];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const moduleName = match[1];
      if (moduleName === undefined || !isProviderModule(moduleName)) continue;
      if (isAllowedProviderBoundary(file)) continue;

      findings.push({
        file,
        line: lineNumberFor(source, match.index ?? 0),
        module: moduleName,
        message:
          "Provider SDK imports must stay in approved adapter, provider, or runtime config boundary files.",
      });
    }
  }

  return findings;
}

export async function evaluateProviderBoundary(
  repoRoot = process.cwd(),
): Promise<ProviderBoundaryResult> {
  const files = (
    await Promise.all(scannedRoots.map((root) => listFiles(repoRoot, root)))
  )
    .flat()
    .map(toRepoPath)
    .filter(isSourceFile);

  const findings = (
    await Promise.all(
      files.map(async (file) =>
        evaluateProviderBoundarySource(
          file,
          await readFile(join(repoRoot, file), "utf8"),
        ),
      ),
    )
  ).flat();

  return { ok: findings.length === 0, findings };
}

export async function runProviderBoundaryCheck(
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateProviderBoundary(repoRoot);

  if (result.ok) {
    console.log("check:provider-boundary passed");
    return;
  }

  for (const finding of result.findings) {
    console.error(
      `${finding.file}:${finding.line}: ${finding.message} (${finding.module})`,
    );
  }
  process.exitCode = 1;
}

if (isDirectRun(import.meta.url)) await runProviderBoundaryCheck();
