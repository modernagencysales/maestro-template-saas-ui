import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";

export type DependencyArtifact = {
  readonly package: string;
  readonly url: string;
  readonly integrity: string;
};
export type DependencyAllowlist = {
  readonly schemaVersion: 1;
  readonly generatedFrom: string;
  readonly artifacts: readonly DependencyArtifact[];
};

export function assertSafeRegistryUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "registry.npmjs.org" ||
    url.username ||
    url.password ||
    isIP(url.hostname)
  ) {
    throw new Error(`unsafe registry URL: ${value}`);
  }
  return url;
}

export function assertSafeArchiveEntry(path: string, kind = "file"): void {
  if (
    path.startsWith("/") ||
    path.split("/").includes("..") ||
    !["file", "directory"].includes(kind)
  ) {
    throw new Error(`unsafe archive entry: ${path} (${kind})`);
  }
}

export function validateAllowlistedArtifact(
  allowlist: DependencyAllowlist,
  artifact: { readonly url: string; readonly integrity: string },
): DependencyArtifact {
  assertSafeRegistryUrl(artifact.url);
  const found = allowlist.artifacts.find(
    (entry) =>
      entry.url === artifact.url && entry.integrity === artifact.integrity,
  );
  if (!found)
    throw new Error("artifact is not present in the protected allowlist");
  return found;
}

function tarballUrl(name: string, version: string): string {
  const leaf = name.includes("/")
    ? name.slice(name.lastIndexOf("/") + 1)
    : name;
  return `https://registry.npmjs.org/${name}/-/${leaf}-${version}.tgz`;
}

function baselineArtifacts(lock: string): DependencyArtifact[] {
  const packages =
    lock.match(/^packages:\n(?<body>[\s\S]*?)^snapshots:/mu)?.groups?.body ??
    "";
  const lines = packages.split("\n");
  const result: DependencyArtifact[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const key = lines[index]
      ?.match(/^ {2}['"]?(.+?)['"]?:$/u)?.[1]
      ?.replace(/\(.+$/u, "");
    if (!key) continue;
    const split = key.lastIndexOf("@");
    if (split <= 0) continue;
    const name = key.slice(0, split);
    const version = key.slice(split + 1);
    const resolution = lines.slice(index + 1, index + 5).join("\n");
    const integrity = resolution.match(/integrity: ([^,}\s]+)/u)?.[1];
    if (!integrity || !/^\d+\.\d+\.\d+/u.test(version)) continue;
    result.push({
      package: `${name}@${version}`,
      url: tarballUrl(name, version),
      integrity,
    });
  }
  return result;
}

async function resolveClosure(
  roots: readonly string[],
): Promise<DependencyArtifact[]> {
  const queue = [...roots];
  const seen = new Set<string>();
  const result: DependencyArtifact[] = [];
  while (queue.length) {
    const spec = queue.shift();
    if (!spec) break;
    if (seen.has(spec)) continue;
    seen.add(spec);
    const split = spec.lastIndexOf("@");
    const name = spec.slice(0, split);
    const version = spec.slice(split + 1);
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
      { redirect: "error", signal: AbortSignal.timeout(15_000) },
    );
    if (
      !response.ok ||
      Number(response.headers.get("content-length") ?? 0) > 2_000_000
    )
      throw new Error(`registry resolution failed for ${spec}`);
    const body = (await response.json()) as {
      dist?: { tarball?: string; integrity?: string };
      dependencies?: Record<string, string>;
    };
    if (!body.dist?.tarball || !body.dist.integrity)
      throw new Error(`missing dist metadata for ${spec}`);
    assertSafeRegistryUrl(body.dist.tarball);
    result.push({
      package: spec,
      url: body.dist.tarball,
      integrity: body.dist.integrity,
    });
    for (const [dependency, range] of Object.entries(body.dependencies ?? {})) {
      const metadata = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(dependency)}`,
        { redirect: "error", signal: AbortSignal.timeout(15_000) },
      );
      if (!metadata.ok)
        throw new Error(`registry metadata failed for ${dependency}@${range}`);
      const packument = (await metadata.json()) as {
        versions?: Record<string, unknown>;
      };
      const resolved = selectVersion(
        Object.keys(packument.versions ?? {}),
        range,
      );
      if (!resolved) throw new Error(`cannot resolve ${dependency}@${range}`);
      queue.push(`${dependency}@${resolved}`);
    }
  }
  return result;
}

function selectVersion(
  versions: readonly string[],
  range: string,
): string | undefined {
  const tuple = (value: string) =>
    value
      .match(/^(\d+)\.(\d+)\.(\d+)$/u)
      ?.slice(1)
      .map(Number) as [number, number, number] | undefined;
  const compare = (
    left: [number, number, number],
    right: [number, number, number],
  ) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  const choices = versions.flatMap((version) => {
    const parsed = tuple(version);
    return parsed ? [{ version, parsed }] : [];
  });
  const base = tuple(range.match(/\d+\.\d+\.\d+/u)?.[0] ?? "");
  const allowed = choices.filter(({ version, parsed }) => {
    if (range === "*" || range === "latest") return true;
    if (range === version) return true;
    if (!base || compare(parsed, base) < 0) return false;
    if (range.startsWith("^")) return parsed[0] === base[0];
    if (range.startsWith("~"))
      return parsed[0] === base[0] && parsed[1] === base[1];
    if (range.startsWith(">=")) {
      const upper = range
        .match(/<(\d+)\.(\d+)\.(\d+)/u)
        ?.slice(1)
        .map(Number) as [number, number, number] | undefined;
      return !upper || compare(parsed, upper) < 0;
    }
    return false;
  });
  return allowed.sort((a, b) => compare(a.parsed, b.parsed)).at(-1)?.version;
}

async function main(): Promise<void> {
  if (process.argv[2] !== "freeze") return;
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  const baseLock = value("--base-lock");
  const write = value("--write");
  const roots = process.argv.flatMap((arg, index) => {
    const packageSpec = process.argv[index + 1];
    return arg === "--package" && packageSpec ? [packageSpec] : [];
  });
  if (!baseLock || !write || roots.length === 0)
    throw new Error("freeze requires --base-lock, --package and --write");
  const lock = readFileSync(baseLock, "utf8");
  const artifacts = [
    ...baselineArtifacts(lock),
    ...(await resolveClosure(roots)),
  ];
  const deduped = [
    ...new Map(artifacts.map((entry) => [entry.package, entry])).values(),
  ].sort((a, b) => a.package.localeCompare(b.package));
  for (const artifact of deduped) assertSafeRegistryUrl(artifact.url);
  const generatedFrom = `sha256:${createHash("sha256").update(lock).digest("hex")}`;
  writeFileSync(
    write,
    `${JSON.stringify({ schemaVersion: 1, generatedFrom, artifacts: deduped }, null, 2)}\n`,
  );
  console.log(
    `froze ${deduped.length} reviewed artifacts from ${generatedFrom}`,
  );
}

await main();
