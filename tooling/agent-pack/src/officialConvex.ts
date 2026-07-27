import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

type BundleFile = {
  readonly source: string;
  readonly sha256: string;
  readonly targets: readonly string[];
};

type OfficialConvexManifest = {
  readonly schemaVersion: 1;
  readonly convexCliVersion: string;
  readonly skillsInstallerVersion: string;
  readonly resolvedCommit: string;
  readonly lockFormat: 1;
  readonly files: readonly BundleFile[];
};

export type BundleReceipt = {
  readonly installed: readonly string[];
  readonly refused: readonly string[];
};

const MANIFEST_PATH = "docs/template/convex-ai-files.manifest.json";
const COMPATIBILITY_PATH = "docs/template/convex-compatibility.json";
const START_MARKER = "<!-- convex-ai-start -->";
const END_MARKER = "<!-- convex-ai-end -->";

export async function validateOfficialConvexBundle(
  repoRoot: string,
): Promise<readonly string[]> {
  const manifest = await readManifest(repoRoot);
  const compatibility = record(
    JSON.parse(await readFile(join(repoRoot, COMPATIBILITY_PATH), "utf8")),
    "compatibility",
  );
  const current = record(compatibility.current, "compatibility.current");
  const agentContext = record(
    compatibility.officialAgentContext,
    "compatibility.officialAgentContext",
  );
  const findings: string[] = [];

  if (current.convex !== manifest.convexCliVersion) {
    findings.push("metadata:convexCliVersion");
  }
  if (agentContext.skillsInstaller !== manifest.skillsInstallerVersion) {
    findings.push("metadata:skillsInstallerVersion");
  }
  if (agentContext.resolvedCommit !== manifest.resolvedCommit) {
    findings.push("metadata:resolvedCommit");
  }

  for (const file of manifest.files) {
    const content = await readFile(join(repoRoot, safeRelative(file.source)));
    if (sha256(content) !== file.sha256)
      findings.push(`checksum:${file.source}`);
  }

  const state = record(
    JSON.parse(
      await readFile(
        join(
          repoRoot,
          "agent-pack/official-convex/managed/ai-files.state.json",
        ),
        "utf8",
      ),
    ),
    "ai-files.state.json",
  );
  if (state.agentSkillsSha !== manifest.resolvedCommit) {
    findings.push("state:agentSkillsSha");
  }
  const lock = record(
    JSON.parse(
      await readFile(
        join(repoRoot, "agent-pack/official-convex/managed/skills-lock.json"),
        "utf8",
      ),
    ),
    "skills-lock.json",
  );
  if (lock.version !== manifest.lockFormat) findings.push("state:lockFormat");
  return findings;
}

export async function validateInstalledOfficialConvexTargets(
  repoRoot: string,
): Promise<readonly string[]> {
  const manifest = await readManifest(repoRoot);
  const findings: string[] = [];

  for (const file of manifest.files) {
    const source = await readFile(join(repoRoot, safeRelative(file.source)));
    for (const target of file.targets) {
      if (target.includes("#")) {
        const path = target.split("#", 1)[0] ?? "";
        const installed = await optionalRead(
          join(repoRoot, safeRelative(path)),
        );
        const expected = Buffer.from(source).toString("utf8").trimEnd();
        if (
          installed === undefined ||
          managedSection(installed.toString("utf8")) !== expected
        ) {
          findings.push(`managed-section:${target}`);
        }
      } else {
        const installed = await optionalRead(
          join(repoRoot, safeRelative(target)),
        );
        if (installed === undefined) findings.push(`target-missing:${target}`);
        else if (sha256(installed) !== file.sha256) {
          findings.push(`target-checksum:${target}`);
        }
      }
    }
  }

  const claude = await optionalRead(join(repoRoot, "CLAUDE.md"));
  if (
    claude === undefined ||
    !hasClaudeAgentsIncludeOutsideManagedSection(claude.toString("utf8"))
  ) {
    findings.push("claude-include:outside-managed-section");
  }
  return findings;
}

export async function installOfficialConvexBundle(
  repoRoot: string,
  targetRoot: string,
): Promise<BundleReceipt> {
  const findings = await validateOfficialConvexBundle(repoRoot);
  if (findings.length > 0) {
    throw new Error(
      `official Convex bundle is invalid: ${findings.join(", ")}`,
    );
  }
  const manifest = await readManifest(repoRoot);
  const installed: string[] = [];
  const refused: string[] = [];

  for (const file of manifest.files) {
    const source = await readFile(join(repoRoot, safeRelative(file.source)));
    for (const target of file.targets) {
      if (target.includes("#")) {
        const changed = await installManagedSection(targetRoot, target, source);
        (changed ? installed : refused).push(target);
      } else {
        const changed = await installExactFile(targetRoot, target, source);
        (changed ? installed : refused).push(target);
      }
    }
  }
  return { installed, refused };
}

export async function removeOfficialConvexBundle(
  repoRoot: string,
  targetRoot: string,
): Promise<BundleReceipt> {
  const manifest = await readManifest(repoRoot);
  const installed: string[] = [];
  const refused: string[] = [];

  for (const file of [...manifest.files].reverse()) {
    const source = await readFile(join(repoRoot, safeRelative(file.source)));
    for (const target of [...file.targets].reverse()) {
      const removed = target.includes("#")
        ? await removeManagedSection(targetRoot, target, source)
        : await removeExactFile(targetRoot, target, source);
      (removed ? installed : refused).push(target);
    }
  }
  return { installed, refused };
}

async function installExactFile(
  targetRoot: string,
  target: string,
  source: Uint8Array,
): Promise<boolean> {
  const path = join(targetRoot, safeRelative(target));
  const existing = await optionalRead(path);
  if (existing !== undefined && sha256(existing) !== sha256(source))
    return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source);
  return true;
}

async function removeExactFile(
  targetRoot: string,
  target: string,
  source: Uint8Array,
): Promise<boolean> {
  const path = join(targetRoot, safeRelative(target));
  const existing = await optionalRead(path);
  if (existing === undefined) return true;
  if (sha256(existing) !== sha256(source)) return false;
  await rm(path);
  return true;
}

async function installManagedSection(
  targetRoot: string,
  target: string,
  source: Uint8Array,
): Promise<boolean> {
  const path = join(targetRoot, safeRelative(target.split("#", 1)[0] ?? ""));
  const existing =
    (await optionalRead(path))?.toString("utf8") ??
    (target.startsWith("CLAUDE.md#") ? "@AGENTS.md\n" : "");
  const section = Buffer.from(source).toString("utf8").trimEnd();
  const managed = managedSection(existing);
  if (managed !== undefined && managed !== section) return false;
  if (managed === undefined) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${existing.trimEnd()}\n\n${section}\n`.trimStart());
  }
  return true;
}

async function removeManagedSection(
  targetRoot: string,
  target: string,
  source: Uint8Array,
): Promise<boolean> {
  const path = join(targetRoot, safeRelative(target.split("#", 1)[0] ?? ""));
  const existing = (await optionalRead(path))?.toString("utf8");
  if (existing === undefined) return true;
  const expected = Buffer.from(source).toString("utf8").trimEnd();
  const managed = managedSection(existing);
  if (managed === undefined) return true;
  if (managed !== expected) return false;
  const next = existing
    .replace(managed, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  if (next.length === 0) await rm(path);
  else await writeFile(path, `${next}\n`);
  return true;
}

function managedSection(content: string): string | undefined {
  const start = content.indexOf(START_MARKER);
  const end = content.indexOf(END_MARKER);
  if (start < 0 || end < start) return undefined;
  return content.slice(start, end + END_MARKER.length).trimEnd();
}

function hasClaudeAgentsIncludeOutsideManagedSection(content: string): boolean {
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

async function readManifest(repoRoot: string): Promise<OfficialConvexManifest> {
  const input = record(
    JSON.parse(await readFile(join(repoRoot, MANIFEST_PATH), "utf8")),
    "official Convex manifest",
  );
  if (input.schemaVersion !== 1 || input.lockFormat !== 1) {
    throw new TypeError("official Convex manifest version is unsupported");
  }
  if (!Array.isArray(input.files)) {
    throw new TypeError("official Convex manifest files must be an array");
  }
  return {
    schemaVersion: 1,
    convexCliVersion: string(input.convexCliVersion, "convexCliVersion"),
    skillsInstallerVersion: string(
      input.skillsInstallerVersion,
      "skillsInstallerVersion",
    ),
    resolvedCommit: string(input.resolvedCommit, "resolvedCommit"),
    lockFormat: 1,
    files: input.files.map((item, index) => parseBundleFile(item, index)),
  };
}

function parseBundleFile(input: unknown, index: number): BundleFile {
  const value = record(input, `files[${index}]`);
  if (
    !Array.isArray(value.targets) ||
    value.targets.some((item) => typeof item !== "string")
  ) {
    throw new TypeError(`files[${index}].targets must be a string array`);
  }
  return {
    source: string(value.source, `files[${index}].source`),
    sha256: string(value.sha256, `files[${index}].sha256`),
    targets: value.targets.map((target) => string(target, "target")),
  };
}

function safeRelative(path: string): string {
  if (path.startsWith("/") || path.split("/").includes("..")) {
    throw new TypeError(`unsafe manifest path: ${path}`);
  }
  return path;
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

async function optionalRead(path: string): Promise<Buffer | undefined> {
  try {
    await stat(path);
    return await readFile(path);
  } catch (error) {
    if (record(error, "filesystem error").code === "ENOENT") return undefined;
    throw error;
  }
}

function record(input: unknown, name: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${name} must be an object`);
  }
  return Object.fromEntries(Object.entries(input));
}

function string(input: unknown, name: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return input;
}
