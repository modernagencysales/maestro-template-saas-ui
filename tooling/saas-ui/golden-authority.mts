import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSaasApplicationTargetPlan } from "../../tooling/generators/src/blueprints/saasApplication";
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
const port = process.env.PORT ?? process.argv[3] ?? "4173";
const authority = process.argv[2];

if (authority !== "reference" && authority !== "generated") {
  throw new Error("Usage: golden-authority.mts <reference|generated> <port>");
}

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

function readReferenceReceipt() {
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
    return {
      destination,
      content: readFileSync(resolve(repositoryRoot, destination)),
      sourceSha256,
      sha256,
      adapted,
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

function hashEntries(entries: readonly { path: string; content: string }[]) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(entry.content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function materializeGeneratedTarget() {
  const targetRoot = mkdtempSync(
    join(tmpdir(), "maestro-saas-ui-golden-generated-"),
  );
  const plan = buildSaasApplicationTargetPlan({
    name: "Golden customer target",
    firstOutcome: "Review the generated SaaS workspace",
  });
  const digest = hashEntries(plan.entries);
  for (const entry of plan.entries) {
    const target = join(targetRoot, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content);
  }
  writeFileSync(
    join(targetRoot, ".golden-authority.json"),
    `${JSON.stringify(
      {
        authority,
        materializedAt: new Date().toISOString(),
        source: "buildSaasApplicationTargetPlan",
        entries: plan.entries.length,
        digest,
      },
      null,
      2,
    )}\n`,
  );
  return { digest, targetRoot };
}

const generated =
  authority === "generated" ? materializeGeneratedTarget() : undefined;
const targetRoot = generated?.targetRoot ?? repositoryRoot;
const starterContentDigest =
  authority === "reference"
    ? verifyStarterPin()
    : readPinnedStarterContentDigest();

const digest =
  authority === "reference" ? starterContentDigest : generated?.digest;
if (!digest) {
  throw new Error("Generated golden authority did not produce a digest");
}
if (
  authority === "generated" &&
  (targetRoot === starterRoot || digest === starterContentDigest)
) {
  throw new Error(
    "Generated golden authority must have a distinct root and digest",
  );
}
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
        ...readReferenceReceipt(),
      })
    : createGeneratedAuthorityMetadata({ generatedDigest: digest });
writeFileSync(
  join(evidenceRoot, `authority-${authority}.json`),
  serializeAuthorityMetadata(metadata),
);

if (authority === "generated") {
  execFileSync("pnpm", ["install", "--frozen-lockfile"], {
    cwd: targetRoot,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["--dir", resolve(targetRoot, "apps/web"), "build"], {
    cwd: targetRoot,
    env: { ...process.env, REFERENCE_SOURCE_MODE: "0" },
    stdio: "inherit",
  });
}

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
child.on("error", (error) => {
  serverErrors.recordProcessError(error.message);
});

const stop = (signal: NodeJS.Signals) => child.kill(signal);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code, signal) => {
  serverErrors.close();
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
