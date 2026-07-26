import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";

const MANIFEST_PATH = "docs/template/convex-ai-files.manifest.json";
const MANIFEST_SHA256 =
  "2827a060d8f249ecd240cdbbf86ed44c7162350b4b04ffc2cefaa28cbb3f88d9";
const START_MARKER = "<!-- convex-ai-start -->";
const END_MARKER = "<!-- convex-ai-end -->";

export async function checkConvexAiFiles(
  repoRoot: string,
): Promise<readonly string[]> {
  const bytes = await optionalRead(join(repoRoot, MANIFEST_PATH));
  if (bytes === undefined) return ["installed:missing-manifest"];
  if (sha256(bytes) !== MANIFEST_SHA256) return ["installed:manifest-checksum"];
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return ["installed:invalid-manifest"];
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.files)
  )
    return ["installed:invalid-manifest"];
  const findings: string[] = [];
  for (const item of value.files) {
    if (
      !isRecord(item) ||
      typeof item.sha256 !== "string" ||
      !Array.isArray(item.targets)
    ) {
      findings.push("installed:invalid-entry");
      continue;
    }
    for (const target of item.targets) {
      if (typeof target !== "string" || !safeTarget(target)) {
        findings.push("installed:invalid-target");
        continue;
      }
      const [path, section] = target.split("#", 2);
      const installed = await optionalRead(join(repoRoot, path ?? ""));
      if (installed === undefined) {
        findings.push(`installed:missing:${target}`);
        continue;
      }
      const actual = section
        ? managedSection(installed.toString("utf8"))
        : installed;
      if (actual === undefined || sha256(actual) !== item.sha256)
        findings.push(`installed:checksum:${target}`);
    }
  }
  const claude = await optionalRead(join(repoRoot, "CLAUDE.md"));
  if (claude === undefined || !hasClaudeInclude(claude.toString("utf8")))
    findings.push("installed:claude-agents-include");
  return findings;
}

function safeTarget(target: string): boolean {
  const path = target.split("#", 1)[0] ?? "";
  return (
    path !== "" && !isAbsolute(path) && !path.split(/[\\/]/).includes("..")
  );
}

function managedSection(content: string): Buffer | undefined {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  return start < 0 || end < start
    ? undefined
    : Buffer.from(
        `${content.slice(start, end + END_MARKER.length).trimEnd()}\n`,
      );
}

function hasClaudeInclude(content: string): boolean {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  let include = content.indexOf("@AGENTS.md");
  while (include >= 0) {
    if (start < 0 || end < start || include < start || include > end)
      return true;
    include = content.indexOf("@AGENTS.md", include + 1);
  }
  return false;
}

async function optionalRead(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return undefined;
    throw error;
  }
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = await checkConvexAiFiles(process.cwd());
  if (findings.length > 0) {
    console.error(
      `Installed Convex AI drift:\n${findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Installed Convex AI targets match the pinned manifest.");
}
