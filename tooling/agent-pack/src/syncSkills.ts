import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import process from "node:process";

const CANONICAL = "agent-pack/skills/maestro";
const PLUGIN_PROJECTIONS = [
  "agent-pack/plugins/maestro/skills/maestro",
] as const;
const ROOT_SKILL_PROJECTIONS = [".agents/skills/maestro"] as const;

export async function syncSkillProjections(repoRoot: string): Promise<void> {
  const source = join(repoRoot, CANONICAL);
  for (const projection of [...PLUGIN_PROJECTIONS, ...ROOT_SKILL_PROJECTIONS]) {
    const target = join(repoRoot, projection);
    await rm(target, { force: true, recursive: true });
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }
}

export async function checkSkillProjections(
  repoRoot: string,
): Promise<readonly string[]> {
  const canonicalRoot = join(repoRoot, CANONICAL);
  const canonical = await fileHashes(canonicalRoot);
  const findings: string[] = [];
  if (!canonical.has("SKILL.md")) {
    findings.push(`missing:${CANONICAL}/SKILL.md`);
  }

  for (const projection of PLUGIN_PROJECTIONS) {
    const projected = await fileHashes(join(repoRoot, projection));
    for (const [path, hash] of canonical) {
      if (!projected.has(path)) findings.push(`missing:${projection}/${path}`);
      else if (projected.get(path) !== hash)
        findings.push(`drift:${projection}/${path}`);
    }
    for (const path of projected.keys()) {
      if (!canonical.has(path)) findings.push(`extra:${projection}/${path}`);
    }
  }
  return findings;
}

export async function checkRootSkillProjections(
  repoRoot: string,
): Promise<readonly string[]> {
  const mappings = [
    {
      source: CANONICAL,
      target: ".agents/skills/maestro",
    },
    {
      source: "agent-pack/plugins/maestro-convex/skills/maestro-convex",
      target: ".agents/skills/maestro-convex",
    },
  ] as const;
  const findings: string[] = [];
  for (const mapping of mappings) {
    const expected = await fileHashes(join(repoRoot, mapping.source));
    const installed = await fileHashes(join(repoRoot, mapping.target));
    for (const [path, hash] of expected) {
      if (!installed.has(path))
        findings.push(`missing:${mapping.target}/${path}`);
      else if (installed.get(path) !== hash) {
        findings.push(`drift:${mapping.target}/${path}`);
      }
    }
    for (const path of installed.keys()) {
      if (!expected.has(path)) findings.push(`extra:${mapping.target}/${path}`);
    }
  }
  return findings;
}

export async function checkAllSkillProjections(
  repoRoot: string,
): Promise<readonly string[]> {
  const [plugin, root] = await Promise.all([
    checkSkillProjections(repoRoot),
    checkRootSkillProjections(repoRoot),
  ]);
  return [...plugin, ...root];
}

async function fileHashes(root: string): Promise<ReadonlyMap<string, string>> {
  const hashes = new Map<string, string>();
  for (const path of await filesUnder(root)) {
    const content = await readFile(path);
    hashes.set(
      relative(root, path).replaceAll("\\", "/"),
      createHash("sha256").update(content).digest("hex"),
    );
  }
  return hashes;
}

async function filesUnder(root: string): Promise<readonly string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function errorCode(error: unknown): unknown {
  if (error === null || typeof error !== "object") return undefined;
  return Object.fromEntries(Object.entries(error)).code;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.cwd();
  if (process.argv.includes("--write")) {
    await syncSkillProjections(repoRoot);
    console.log("Maestro skill projections synchronized.");
  } else {
    const findings = await checkAllSkillProjections(repoRoot);
    if (findings.length > 0) {
      console.error(findings.join("\n"));
      process.exit(1);
    }
    console.log("Maestro skill projections match the canonical source.");
  }
}
