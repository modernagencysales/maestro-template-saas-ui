import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSaasUiFoundation } from "../quality/saas-ui-foundation";
import { previewCommand } from "./golden-authority-command";
import {
  createGoldenServerErrorRecorder,
  createGeneratedAuthorityMetadata,
  proveReferenceServedFiles,
  serializeAuthorityMetadata,
} from "./golden-authority-runtime";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const starterRoot =
  process.env.SAAS_UI_STARTER_ROOT ??
  "/Users/headless/.tmp/saas-ui-tanstack-pro";
const starterPin = "b76cb4514b9ab47f7db87901cb9b593b4adc3129";
const referenceCompatibilityPaths = new Set([
  "apps/web/src/theme/semantic-tokens/colors.ts",
  "apps/web/src/features/auth/auth-provider.tsx",
  "apps/web/src/features/common/components/app-sidebar.tsx",
  "apps/web/src/features/common/components/billing-status.tsx",
  "apps/web/src/features/common/hooks/use-current-user.ts",
  "apps/web/src/features/common/hooks/use-current-workspace.ts",
  "apps/web/src/features/common/hooks/use-tags.ts",
  "apps/web/src/features/common/hooks/use-workspaces.ts",
  "apps/web/src/features/common/providers/app-provider.tsx",
  "apps/web/src/features/common/layouts/app-layout.tsx",
  "apps/web/src/features/common/layouts/dashboard-layout.tsx",
  "apps/web/src/features/contacts/inbox/inbox-layout.tsx",
  "apps/web/src/features/contacts/inbox/inbox-list.tsx",
  "apps/web/src/features/contacts/inbox/inbox-view-page.tsx",
  "apps/web/src/features/contacts/list/list-page.tsx",
  "apps/web/src/features/contacts/list/contact-filters.tsx",
  "apps/web/src/features/contacts/view/activities-panel.tsx",
  "apps/web/src/features/contacts/view/activity-timeline.tsx",
  "apps/web/src/features/contacts/view/contact-page.tsx",
  "apps/web/src/features/contacts/view/contact-sidebar.tsx",
  "apps/web/src/features/reports/reports-page.tsx",
  "apps/web/src/features/getting-started/getting-started-page.tsx",
  "apps/web/src/features/auth/login-page.tsx",
  "apps/web/src/features/settings/billing/manage-billing-button.tsx",
  "apps/web/src/features/search/search-page.tsx",
  "apps/web/src/features/settings/common/settings-sidebar.tsx",
]);
function verifyStarterPin() {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: starterRoot,
    encoding: "utf8",
  }).trim();
  if (actual !== starterPin) {
    throw new Error(
      `Pinned Starter checkout is ${actual}; expected ${starterPin}`,
    );
  }
  return readPinnedStarterContentDigest();
}

function readPinnedStarterContentDigest() {
  const archive = execFileSync("git", ["archive", starterPin, "apps/web"], {
    cwd: starterRoot,
  });
  return createHash("sha256").update(archive).digest("hex");
}

function readReferenceReceipt(servedRoot: string) {
  const receiptPath = resolve(
    repositoryRoot,
    "docs/template/saas-ui-starter-files.json",
  );
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
    sourceCommit?: unknown;
    files?: unknown;
  };
  if (receipt.sourceCommit !== starterPin || !Array.isArray(receipt.files))
    throw new Error("Saas UI starter receipt is not bound to the starter pin");
  // eslint-disable-next-line complexity -- validates each fixed receipt entry.
  const files = receipt.files.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`Saas UI starter receipt entry ${index} is invalid`);
    const file = value as Record<string, unknown>;
    const receiptString = (key: string) => {
      const entry = file[key];
      if (typeof entry !== "string")
        throw new Error(`Saas UI starter receipt entry ${index} is invalid`);
      return entry;
    };
    const destination = receiptString("destination");
    const source = receiptString("source");
    const sourceSha256 = receiptString("sourceSha256");
    const sha256 = receiptString("sha256");
    const adapted = file.adapted;
    if (typeof adapted !== "boolean")
      throw new Error(`Saas UI starter receipt entry ${index} is invalid`);
    const sourceMarker = "apps/web/";
    const sourceMarkerIndex = source.lastIndexOf(sourceMarker);
    if (sourceMarkerIndex < 0)
      throw new Error(`Saas UI starter receipt source is invalid: ${source}`);
    const starterPath = source.slice(sourceMarkerIndex);
    const pinnedSource = execFileSync(
      "git",
      ["show", `${starterPin}:${starterPath}`],
      { cwd: starterRoot },
    );
    const actualSourceSha256 = createHash("sha256")
      .update(pinnedSource)
      .digest("hex");
    if (actualSourceSha256 !== sourceSha256)
      throw new Error(
        `Saas UI starter receipt source hash mismatch: ${starterPath}`,
      );
    const content = readFileSync(resolve(servedRoot, destination));
    const servedSha256 = createHash("sha256").update(content).digest("hex");
    if (
      servedRoot !== repositoryRoot &&
      servedSha256 !== sourceSha256 &&
      servedSha256 !== sha256
    )
      throw new Error(`Pinned starter source mismatch: ${destination}`);
    return {
      destination,
      content,
      sourceSha256,
      sha256: servedRoot === repositoryRoot ? sha256 : servedSha256,
      adapted:
        servedRoot === repositoryRoot ? adapted : servedSha256 !== sourceSha256,
    };
  });
  return {
    receiptPath: "docs/template/saas-ui-starter-files.json" as const,
    receiptDigest: createHash("sha256")
      .update(readFileSync(receiptPath))
      .digest("hex"),
    files,
  };
}

function hashLocalTarget(root: string): string {
  const files: string[] = [];
  const visit = (directory: string, relative = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "artifacts"
      )
        continue;
      const path = relative ? join(relative, entry.name) : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  files.sort((left, right) => left.localeCompare(right, "en"));
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(join(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function materializeAuthorityTarget(
  authority: "reference" | "generated",
) {
  if (
    existsSync(
      resolve(
        repositoryRoot,
        "tooling/generators/src/blueprints/saasApplication.ts",
      ),
    )
  ) {
    const factory = await import("./golden-authority-factory.mts");
    return factory.materializeGoldenAuthorityTarget({
      authority,
      repositoryRoot,
      starterRoot,
      starterPin,
      referenceCompatibilityPaths,
    });
  }
  return {
    targetRoot: repositoryRoot,
    digest: hashLocalTarget(repositoryRoot),
  };
}

// eslint-disable-next-line complexity -- coordinates the two golden authorities and launcher lifecycle.
async function main() {
  const authority = process.argv[2];
  if (authority !== "reference" && authority !== "generated")
    throw new Error("Usage: golden-authority.mts <reference|generated> <port>");
  const port = process.env.PORT ?? process.argv[3] ?? "4173";
  const materialized = await materializeAuthorityTarget(authority);
  const targetRoot = materialized.targetRoot;
  const starterContentDigest =
    authority === "reference"
      ? verifyStarterPin()
      : readPinnedStarterContentDigest();
  const digest =
    authority === "reference" ? starterContentDigest : materialized.digest;
  if (!digest)
    throw new Error("Generated golden authority did not produce a digest");
  if (
    authority === "generated" &&
    (targetRoot === starterRoot || digest === starterContentDigest)
  )
    throw new Error(
      "Generated golden authority must have a distinct root and digest",
    );

  const evidenceRoot = resolve(repositoryRoot, "artifacts/saas-ui-golden");
  mkdirSync(evidenceRoot, { recursive: true });
  const foundationErrors = checkSaasUiFoundation(repositoryRoot);
  if (foundationErrors.length > 0)
    throw new Error(
      `Saas UI foundation check failed:\n${foundationErrors.join("\n")}`,
    );
  const metadata =
    authority === "reference"
      ? proveReferenceServedFiles({
          starterPin,
          starterContentDigest: digest,
          ...readReferenceReceipt(targetRoot),
        })
      : createGeneratedAuthorityMetadata({ generatedDigest: digest });
  writeFileSync(
    join(evidenceRoot, `authority-${authority}.json`),
    serializeAuthorityMetadata(metadata),
  );

  execFileSync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: targetRoot,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["--dir", resolve(targetRoot, "apps/web"), "build"], {
    cwd: targetRoot,
    env: {
      ...process.env,
      REFERENCE_SOURCE_MODE: authority === "reference" ? "1" : "0",
    },
    stdio: "inherit",
  });

  const command = previewCommand({
    repositoryRoot,
    targetRoot,
    authority,
    port,
  });
  const serverErrors = createGoldenServerErrorRecorder({
    evidenceRoot,
    authority,
  });
  const child = spawn(command.command, command.args, {
    cwd: command.cwd,
    env: {
      ...process.env,
      GOLDEN_AUTHORITY: authority,
      GOLDEN_AUTHORITY_ROOT: targetRoot,
      REFERENCE_SOURCE_MODE: authority === "reference" ? "1" : "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    serverErrors.recordChunk("stdout", chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
    serverErrors.recordChunk("stderr", chunk);
  });
  child.on("error", (error) => serverErrors.recordProcessError(error.message));

  const stop = (signal: NodeJS.Signals) => child.kill(signal);
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  child.on("exit", (code, signal) => {
    serverErrors.close();
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
