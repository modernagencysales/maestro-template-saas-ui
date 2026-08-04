import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { gunzipSync } from "node:zlib";

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

const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

type ControllerArtifactResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: Uint8Array;
};

type ControllerArtifactFetch = {
  readonly resolve?: (hostname: string) => Promise<readonly string[]>;
  readonly request?: (input: {
    readonly artifact: DependencyArtifact;
    readonly address: string;
    readonly maxBytes: number;
  }) => Promise<ControllerArtifactResponse>;
  readonly maxBytes?: number;
};

function isPublicRegistryAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [first, second] = octets;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 0 || second === 168)) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }
  const normalized = address.toLowerCase();
  return (
    isIP(address) === 6 &&
    normalized !== "::" &&
    normalized !== "::1" &&
    !normalized.startsWith("::ffff:") &&
    !normalized.startsWith("fc") &&
    !normalized.startsWith("fd") &&
    !normalized.startsWith("fe80:") &&
    !normalized.startsWith("ff")
  );
}

async function resolveRegistry(hostname: string): Promise<readonly string[]> {
  return (await lookup(hostname, { all: true })).map(({ address }) => address);
}

async function requestPinnedArtifact(input: {
  readonly artifact: DependencyArtifact;
  readonly address: string;
  readonly maxBytes: number;
}): Promise<ControllerArtifactResponse> {
  const url = assertSafeRegistryUrl(input.artifact.url);
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        hostname: url.hostname,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        lookup: (_hostname, _options, callback) =>
          callback(null, input.address, isIP(input.address)),
        timeout: 30_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > input.maxBytes) {
            request.destroy(
              new Error("artifact exceeds controller byte limit"),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(",") : value,
              ]),
            ),
            body: Buffer.concat(chunks),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.on("timeout", () =>
      request.destroy(new Error("registry artifact fetch timed out")),
    );
    request.end();
  });
}

/** Fetch once through a controller-pinned address before exposing an artifact. */
export async function fetchControllerArtifact(
  artifact: DependencyArtifact,
  input: ControllerArtifactFetch = {},
): Promise<Uint8Array> {
  const url = assertSafeRegistryUrl(artifact.url);
  const maxBytes = input.maxBytes ?? MAX_ARTIFACT_BYTES;
  const addresses = await (input.resolve ?? resolveRegistry)(url.hostname);
  const address = addresses.at(0);
  if (!address || addresses.some((entry) => !isPublicRegistryAddress(entry)))
    throw new Error("registry resolved to a private or non-public address");
  const response = await (input.request ?? requestPinnedArtifact)({
    artifact,
    address,
    maxBytes,
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error("registry artifact redirect is forbidden");
  if (response.status !== 200)
    throw new Error(`registry artifact fetch failed: ${response.status}`);
  const contentLength = response.headers["content-length"];
  if (!contentLength || !/^\d+$/u.test(contentLength))
    throw new Error("registry artifact content-length is required");
  const declaredBytes = Number(contentLength);
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes)
    throw new Error("artifact exceeds controller byte limit");
  if (response.body.byteLength !== declaredBytes)
    throw new Error("registry artifact content length mismatch");
  inspectArtifact(response.body, artifact.integrity, maxBytes);
  return response.body;
}

/** Validate the complete compressed tarball before the proxy releases any bytes. */
export function inspectArtifact(
  bytes: Uint8Array,
  integrity: string,
  maxBytes = MAX_ARTIFACT_BYTES,
): void {
  if (bytes.byteLength > maxBytes)
    throw new Error("artifact exceeds controller byte limit");
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (actual !== integrity)
    throw new Error("artifact content integrity mismatch");
  let tar: Buffer;
  try {
    tar = gunzipSync(bytes, { maxOutputLength: maxBytes });
  } catch (error) {
    if (error instanceof RangeError)
      throw new Error("artifact exceeds controller decompressed byte limit");
    throw new Error("artifact is not a gzip tarball");
  }
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = [
      header.subarray(345, 500).toString("utf8").replace(/\0.*$/u, ""),
      header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, ""),
    ]
      .filter(Boolean)
      .join("/");
    const type = String.fromCharCode(header[156] || 48);
    try {
      assertSafeArchiveEntry(
        name,
        type === "5"
          ? "directory"
          : type === "0" || type === "\0"
            ? "file"
            : "link",
      );
    } catch {
      throw new Error(`unsafe archive entry: ${name} (${type})`);
    }
    const sizeText = header
      .subarray(124, 136)
      .toString("ascii")
      .replace(/\0.*$/u, "")
      .trim();
    if (sizeText && !/^[0-7]+$/u.test(sizeText))
      throw new Error("unsafe archive size");
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    if (!Number.isSafeInteger(size) || size < 0)
      throw new Error("unsafe archive size");
    const next = offset + 512 + Math.ceil(size / 512) * 512;
    if (next > tar.length) throw new Error("truncated archive entry");
    offset = next;
  }
}

export function createDependencyProxy(input: {
  readonly allowlist: DependencyAllowlist;
  readonly fetchArtifact?: (
    artifact: DependencyArtifact,
  ) => Promise<Uint8Array>;
  readonly maxBytes?: number;
}): Server {
  const fetchArtifact = input.fetchArtifact ?? fetchControllerArtifact;
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
        return;
      }
      if (request.method !== "GET" || !request.url)
        throw new Error("only GET artifact requests are allowed");
      const url = `https://registry.npmjs.org${request.url}`;
      const artifact = input.allowlist.artifacts.find(
        (entry) => entry.url === url,
      );
      if (!artifact)
        throw new Error("artifact is not present in the protected allowlist");
      const bytes = await fetchArtifact(artifact);
      inspectArtifact(bytes, artifact.integrity, input.maxBytes);
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, immutable",
      });
      response.end(bytes);
    } catch (error) {
      response.writeHead(403, { "content-type": "text/plain" });
      response.end(
        error instanceof Error ? error.message : "artifact rejected",
      );
    }
  });
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
  if (process.argv[2] === "serve") {
    const value = (flag: string) =>
      process.argv[process.argv.indexOf(flag) + 1];
    const allowlistPath = value("--allowlist");
    const port = Number(value("--port") ?? "4873");
    if (!allowlistPath || !Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("serve requires --allowlist and a valid --port");
    const allowlist = JSON.parse(
      readFileSync(allowlistPath, "utf8"),
    ) as DependencyAllowlist;
    const server = createDependencyProxy({ allowlist });
    await new Promise<void>((resolve) =>
      server.listen(port, "127.0.0.1", resolve),
    );
    console.log(`dependency proxy listening on 127.0.0.1:${port}`);
    return;
  }
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
