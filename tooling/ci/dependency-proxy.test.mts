import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeArchiveEntry,
  assertSafeRegistryUrl,
  createDependencyProxy,
  fetchControllerArtifact,
  inspectArtifact,
  validateAllowlistedArtifact,
} from "./dependency-proxy.mts";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const allowlist = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "dependency-allowlist.json"),
    "utf8",
  ),
) as { artifacts: Array<{ package: string; url: string; integrity: string }> };

describe("protected dependency proxy", () => {
  it("does not retain retired-runner artifacts after typed acceptance cutover", () => {
    const retiredRunner = ["@", "cu", "cumber", "/"].join("");
    expect(
      allowlist.artifacts.some(({ package: name }) =>
        name.startsWith(retiredRunner),
      ),
    ).toBe(false);
  });

  it("rejects credentials, private destinations and unsafe archives", () => {
    expect(() =>
      assertSafeRegistryUrl("https://user:pass@registry.npmjs.org/x"),
    ).toThrow();
    expect(() => assertSafeRegistryUrl("http://127.0.0.1/x")).toThrow();
    expect(() => assertSafeRegistryUrl("https://example.com/x")).toThrow();
    expect(() => assertSafeArchiveEntry("../controller/secret")).toThrow();
    expect(() =>
      assertSafeArchiveEntry("package/device", "character-device"),
    ).toThrow();
  });

  it("does not let candidate metadata widen the reviewed allowlist", () => {
    expect(() =>
      validateAllowlistedArtifact(allowlist, {
        url: "https://registry.npmjs.org/evil/-/evil-1.0.0.tgz",
        integrity: "sha512-evil",
      }),
    ).toThrow(/not present/u);
  });

  it("rejects hostile pnpm artifacts before they reach a candidate", () => {
    const traversal = gzipSync(tar("../controller/secret"));
    const link = gzipSync(tar("package/link", "2"));
    expect(() => inspectArtifact(traversal, integrity(traversal))).toThrow(
      /unsafe archive/u,
    );
    expect(() => inspectArtifact(link, integrity(link))).toThrow(
      /unsafe archive/u,
    );
  });

  it("rejects controller fetch redirects, private resolution, missing or oversized bodies", async () => {
    const bytes = gzipSync(tar("package/index.js"));
    const artifact = {
      package: "safe@1.0.0",
      url: "https://registry.npmjs.org/safe/-/safe-1.0.0.tgz",
      integrity: integrity(bytes),
    };
    await expect(
      fetchControllerArtifact(artifact, {
        resolve: async () => ["127.0.0.1"],
        request: async () => reply(200, bytes),
      }),
    ).rejects.toThrow(/private or non-public/u);
    await expect(
      fetchControllerArtifact(artifact, {
        resolve: async () => ["::ffff:127.0.0.1"],
        request: async () => reply(200, bytes),
      }),
    ).rejects.toThrow(/private or non-public/u);
    await expect(
      fetchControllerArtifact(artifact, {
        resolve: async () => ["93.184.216.34"],
        request: async () =>
          reply(302, bytes, { location: "https://evil.test" }),
      }),
    ).rejects.toThrow(/redirect/u);
    await expect(
      fetchControllerArtifact(artifact, {
        resolve: async () => ["93.184.216.34"],
        request: async () => reply(200, bytes, {}),
      }),
    ).rejects.toThrow(/content-length/u);
    await expect(
      fetchControllerArtifact(artifact, {
        resolve: async () => ["93.184.216.34"],
        request: async () => reply(200, bytes, { "content-length": "999" }),
      }),
    ).rejects.toThrow(/content length mismatch/u);
  });

  it("serves only an exact allowlisted integrity through the controller proxy", async () => {
    const bytes = gzipSync(tar("package/index.js"));
    const expectedIntegrity = integrity(bytes);
    const upstream = createServer((_req, response) => response.end(bytes));
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const address = upstream.address();
    if (!address || typeof address === "string")
      throw new Error("missing test port");
    const artifact = {
      package: "safe@1.0.0",
      url: `https://registry.npmjs.org/safe/-/safe-1.0.0.tgz`,
      integrity: expectedIntegrity,
    };
    const proxy = createDependencyProxy({
      allowlist: {
        schemaVersion: 1,
        generatedFrom: "sha256:test",
        artifacts: [artifact],
      },
      fetchArtifact: async () => bytes,
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const proxyAddress = proxy.address();
    if (!proxyAddress || typeof proxyAddress === "string")
      throw new Error("missing proxy port");
    const response = await fetch(
      `http://127.0.0.1:${proxyAddress.port}/safe/-/safe-1.0.0.tgz`,
    );
    expect((await response.arrayBuffer()).byteLength).toBe(bytes.length);
    await Promise.all([
      new Promise<void>((resolve) => proxy.close(() => resolve())),
      new Promise<void>((resolve) => upstream.close(() => resolve())),
    ]);
  });

  it("caps decompressed archive bytes before parsing entries", () => {
    const bytes = gzipSync(Buffer.alloc(2_048));
    expect(() => inspectArtifact(bytes, integrity(bytes), 1_024)).toThrow(
      /decompressed byte limit/u,
    );
  });
});

function tar(name: string, type = "0"): Buffer {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write("00000000000\0", 124);
  header.write(type, 156);
  return Buffer.concat([header, Buffer.alloc(1024)]);
}

function integrity(bytes: Uint8Array): string {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

function reply(
  status: number,
  body: Uint8Array,
  headers: Readonly<Record<string, string>> = {
    "content-length": String(body.byteLength),
  },
) {
  return { status, headers, body };
}
