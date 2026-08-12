import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSaasApplicationTargetPlan } from "../../tooling/generators/src/blueprints/saasApplication";
import { previewCommand } from "./golden-authority-command";

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

const referenceDigest = createHash("sha256")
  .update(`reference:${starterPin}`)
  .digest("hex");
const generated =
  authority === "generated" ? materializeGeneratedTarget() : undefined;
const targetRoot = generated?.targetRoot ?? starterRoot;
if (authority === "reference") verifyStarterPin();

const digest = authority === "reference" ? referenceDigest : generated?.digest;
if (!digest) {
  throw new Error("Generated golden authority did not produce a digest");
}
if (
  authority === "generated" &&
  (targetRoot === starterRoot || digest === referenceDigest)
) {
  throw new Error(
    "Generated golden authority must have a distinct root and digest",
  );
}
const evidenceRoot = resolve(repositoryRoot, "artifacts/saas-ui-golden");
mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(
  join(evidenceRoot, `authority-${authority}.json`),
  `${JSON.stringify({ authority, root: targetRoot, digest }, null, 2)}\n`,
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
const child = spawn(command.command, command.args, {
  cwd: command.cwd,
  env: {
    ...process.env,
    GOLDEN_AUTHORITY: authority,
    GOLDEN_AUTHORITY_ROOT: targetRoot,
    REFERENCE_SOURCE_MODE: authority === "reference" ? "1" : "0",
  },
  stdio: "inherit",
});

const stop = (signal: NodeJS.Signals) => child.kill(signal);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
