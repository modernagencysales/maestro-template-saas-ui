import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { isDirectRun } from "./src/direct-run.mts";

export type SecurityFixtureFiles = Record<string, string>;

export type SecurityPostureResult = {
  readonly ok: boolean;
  readonly failures: readonly string[];
};

const skippedPathParts = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "repos",
  "test-results",
  "vendor",
]);

const runtimeSourceRoots = ["apps", "packages"];
const sourceExtensions = [".ts", ".tsx", ".mts", ".cts"];

const authBypassPatterns = [
  /\bAUTH_BYPASS\b/i,
  /\bDISABLE_AUTH\b/i,
  /\bSKIP_AUTH\b/i,
  /\bauthBypass\b/,
  /\bskipAuth\b/,
  /\bbypassAuth\b/,
  /\ballowUnauthenticated\b/,
];

const isSourceFile = (path: string): boolean =>
  sourceExtensions.some((extension) => path.endsWith(extension));

const isRuntimeFile = (path: string): boolean =>
  runtimeSourceRoots.some((root) => path.startsWith(`${root}/`)) &&
  isSourceFile(path) &&
  !path.includes(".test.") &&
  !path.includes("/__tests__/") &&
  !path.includes("/test/") &&
  !path.includes("/_generated/");

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (skippedPathParts.has(entry.name)) continue;

    const fullPath = join(current, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, fullPath)));
    } else if (entry.isFile()) {
      files.push(relative(root, fullPath));
    }
  }

  return files;
}

async function readRepoFile(repoRoot: string, path: string): Promise<string> {
  return await readFile(join(repoRoot, path), "utf8");
}

function checkAuthBypass(
  files: readonly { readonly path: string; readonly content: string }[],
): string[] {
  const failures: string[] = [];

  for (const file of files) {
    const matched = authBypassPatterns.find((pattern) =>
      pattern.test(file.content),
    );

    if (matched) {
      failures.push(
        `${file.path}: runtime code contains an auth bypass marker (${matched.source}). Keep fake auth explicit, but do not ship bypass switches.`,
      );
    }
  }

  return failures;
}

function checkWorkspaceMemberGuards(
  files: readonly { readonly path: string; readonly content: string }[],
): string[] {
  const failures: string[] = [];

  for (const file of files) {
    if (!file.content.includes('table("workspaceMembers")')) continue;

    const hasWorkspaceGuard =
      file.content.includes('q.eq("workspaceId"') ||
      file.content.includes("q.eq('workspaceId'");

    if (!hasWorkspaceGuard) {
      failures.push(
        `${file.path}: workspaceMembers access must include a workspace guard before joining or returning membership rows.`,
      );
    }
  }

  return failures;
}

const admissionReaders = new Set([
  "apps/web/src/navigation/admitted-action.ts",
  "packages/convex/confect/capabilities/_kit/admissionGuard.ts",
]);

function checkAdmissionProjectionReaders(
  files: readonly { readonly path: string; readonly content: string }[],
): string[] {
  return files.flatMap((file) =>
    file.content.includes("generated/admittedJourneys") &&
    !admissionReaders.has(file.path)
      ? [
          `${file.path}: generated admission may only be read by the UI registration and server admission guard adapters.`,
        ]
      : [],
  );
}

function checkHttpFailClosedOrder(httpSource: string): string[] {
  const apiEntryIndex = httpSource.indexOf("const apiEntry");
  const operationIndex =
    apiEntryIndex === -1
      ? -1
      : httpSource.indexOf("runTemplateApiOperation(", apiEntryIndex);
  const notFoundIndex = httpSource.indexOf("Unknown template HTTP route");

  if (apiEntryIndex === -1 || operationIndex === -1 || notFoundIndex === -1) {
    return [
      "packages/convex/confect/http.ts: HTTP handler must dispatch docs/API routes and return typed not-found errors.",
    ];
  }

  if (notFoundIndex < apiEntryIndex || notFoundIndex < operationIndex) {
    return [
      "packages/convex/confect/http.ts: HTTP handler must fail closed after docs and generated API route dispatch.",
    ];
  }

  return [];
}

function checkSourceMaps(viteConfig: string): string[] {
  if (/\bsourcemap\s*:\s*true\b/.test(viteConfig)) {
    return [
      "apps/web/vite.config.ts: production source maps must not be public.",
    ];
  }

  if (!/\bsourcemap\s*:\s*false\b/.test(viteConfig)) {
    return [
      "apps/web/vite.config.ts: set build.sourcemap to false so production source maps stay private by default.",
    ];
  }

  return [];
}

export async function evaluateTemplateSecurityPosture(
  repoRoot: string,
): Promise<SecurityPostureResult> {
  const paths = await listFiles(repoRoot);
  const runtimeFiles = await Promise.all(
    paths.filter(isRuntimeFile).map(async (path) => ({
      path,
      content: await readRepoFile(repoRoot, path),
    })),
  );
  const failures: string[] = [];

  failures.push(...checkAuthBypass(runtimeFiles));
  failures.push(...checkWorkspaceMemberGuards(runtimeFiles));
  failures.push(...checkAdmissionProjectionReaders(runtimeFiles));
  failures.push(
    ...checkHttpFailClosedOrder(
      await readRepoFile(repoRoot, "packages/convex/confect/http.ts"),
    ),
  );
  failures.push(
    ...checkSourceMaps(await readRepoFile(repoRoot, "apps/web/vite.config.ts")),
  );

  return { ok: failures.length === 0, failures };
}

export async function runTemplateSecurityPostureCheck(
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateTemplateSecurityPosture(repoRoot);

  if (result.ok) {
    console.log("check:auth-demo-bypass: ok");
    return;
  }

  for (const failure of result.failures) {
    console.error(`check:auth-demo-bypass: ${failure}`);
  }

  process.exitCode = 1;
}

if (isDirectRun(import.meta.url)) await runTemplateSecurityPostureCheck();
