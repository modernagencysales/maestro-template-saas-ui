import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createCustomerReleaseAdapter } from "./createAdapter.js";

const temporaryRoots: string[] = [];
const makeRoot = (prefix = "maestro-create-adapter-"): string => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
};
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args]);

function taggedRelease() {
  const repositoryRoot = makeRoot();
  const temporaryRoot = makeRoot("maestro-create-extract-");
  const homeRoot = makeRoot("maestro-create-home-");
  const targetRoot = join(makeRoot("maestro-create-target-parent-"), "app");
  git(repositoryRoot, ["init", "--quiet"]);
  git(repositoryRoot, ["config", "user.email", "fixture@example.invalid"]);
  git(repositoryRoot, ["config", "user.name", "Fixture"]);
  writeFileSync(join(repositoryRoot, "runtime.txt"), "tagged runtime\n");
  writeFileSync(join(repositoryRoot, "package.json"), '{"tagged":true}\n');
  git(repositoryRoot, ["add", "runtime.txt", "package.json"]);
  git(repositoryRoot, ["commit", "--quiet", "-m", "fixture release"]);
  const sourceCommit = git(repositoryRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  const tag = "maestro-template-v1.2.3";
  git(repositoryRoot, ["tag", tag]);
  const archive = git(repositoryRoot, [
    "archive",
    "--format=tar",
    sourceCommit,
  ]);
  const manifest = {
    $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
    schemaVersion: 1,
    materializationStatus: "materializable",
    release: {
      version: "1.2.3",
      tag,
      sourceCommit,
      sourceChecksum: hash(archive),
    },
    compatibility: { cli: "1.2.x", agentPack: "1.2.x" },
    paths: [
      {
        path: "runtime.txt",
        match: "exact",
        ownership: "customer-extension",
        action: "copy",
        upgrade: "preserve",
      },
      {
        path: "package.json",
        match: "exact",
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
      },
      {
        path: "template-instance.json",
        match: "exact",
        ownership: "generated",
        action: "generate",
        upgrade: "regenerate",
      },
    ],
    expectedHashes: { "runtime.txt": hash("tagged runtime\n") },
    extensionSeams: [
      { path: "runtime.txt", description: "Fixture extension seam." },
    ],
  };
  const manifestPath = join(repositoryRoot, "release-manifest.json");
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(manifestPath, manifestBytes);
  return {
    repositoryRoot,
    temporaryRoot,
    homeRoot,
    targetRoot,
    tag,
    manifest,
    manifestPath,
    ownershipManifestChecksum: hash(manifestBytes),
  };
}

function adapter(fixture: ReturnType<typeof taggedRelease>) {
  return createCustomerReleaseAdapter({
    repositoryRoot: fixture.repositoryRoot,
    manifestPath: fixture.manifestPath,
    ownershipManifestChecksum: fixture.ownershipManifestChecksum,
    tag: fixture.tag,
    homeRoot: fixture.homeRoot,
    temporaryRoot: fixture.temporaryRoot,
  });
}

function prepare(
  fixture: ReturnType<typeof taggedRelease>,
  release = adapter(fixture),
) {
  return release.prepare({
    repo: {
      workingDirectory: fixture.repositoryRoot,
      sourceRoot: fixture.repositoryRoot,
    },
    target: fixture.targetRoot,
    templateInstance: (facts) =>
      `${JSON.stringify({ name: "My App", release: facts })}\n`,
  });
}

describe("customer release create adapter", () => {
  it("previews and writes only immutable tagged bytes with every generated entry", async () => {
    const fixture = taggedRelease();
    writeFileSync(
      join(fixture.repositoryRoot, "runtime.txt"),
      "dirty checkout\n",
    );
    writeFileSync(
      join(fixture.repositoryRoot, "package.json"),
      '{"dirty":true}\n',
    );
    const release = adapter(fixture);
    const prepared = await prepare(fixture, release);

    expect(prepared).toMatchObject({
      ok: true,
      facts: {
        tag: fixture.tag,
        sourceCommit: fixture.manifest.release.sourceCommit,
        sourceChecksum: fixture.manifest.release.sourceChecksum,
        ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      },
      preview: {
        writes: [
          { path: "package.json" },
          { path: "runtime.txt" },
          { path: "template-instance.json" },
        ],
        collisions: [],
      },
    });
    expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
    if (!prepared.ok) throw new Error("expected prepared release");

    const written = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(written).toEqual({ ok: true, files: 3 });
    expect(readFileSync(join(fixture.targetRoot, "runtime.txt"), "utf8")).toBe(
      "tagged runtime\n",
    );
    expect(readFileSync(join(fixture.targetRoot, "package.json"), "utf8")).toBe(
      '{"tagged":true}\n',
    );
    expect(
      JSON.parse(
        readFileSync(
          join(fixture.targetRoot, "template-instance.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ name: "My App", release: { tag: fixture.tag } });
    expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
  });

  it.each([
    [
      "ownership manifest",
      (fixture: ReturnType<typeof taggedRelease>) => {
        fixture.ownershipManifestChecksum = `sha256:${"0".repeat(64)}`;
      },
    ],
    [
      "tag commit",
      (fixture: ReturnType<typeof taggedRelease>) => {
        fixture.manifest.release.sourceCommit = "0".repeat(40);
        const bytes = `${JSON.stringify(fixture.manifest, null, 2)}\n`;
        writeFileSync(fixture.manifestPath, bytes);
        fixture.ownershipManifestChecksum = hash(bytes);
      },
    ],
    [
      "archive",
      (fixture: ReturnType<typeof taggedRelease>) => {
        fixture.manifest.release.sourceChecksum = `sha256:${"0".repeat(64)}`;
        const bytes = `${JSON.stringify(fixture.manifest, null, 2)}\n`;
        writeFileSync(fixture.manifestPath, bytes);
        fixture.ownershipManifestChecksum = hash(bytes);
      },
    ],
  ] as const)(
    "fails closed for a mismatched %s binding",
    async (_label, mutate) => {
      const fixture = taggedRelease();
      mutate(fixture);
      const result = await prepare(fixture);
      expect(result).toMatchObject({ ok: false, code: "release-unavailable" });
      expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
    },
  );

  it("fails closed for the checked-in fixture-only release with no tag", async () => {
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
    );
    const manifestPath = join(
      repositoryRoot,
      "releases/v0.1.0-alpha.1/manifest.json",
    );
    const temporaryRoot = makeRoot("maestro-create-current-");
    const release = createCustomerReleaseAdapter({
      repositoryRoot,
      manifestPath,
      ownershipManifestChecksum: hash(readFileSync(manifestPath)),
      tag: "maestro-template-v0.1.0-alpha.1",
      homeRoot: makeRoot("maestro-create-current-home-"),
      temporaryRoot,
    });
    const result = await release.prepare({
      repo: { workingDirectory: repositoryRoot, sourceRoot: repositoryRoot },
      target: join(makeRoot("maestro-create-current-target-"), "app"),
      templateInstance: () => "{}\n",
    });

    expect(result).toMatchObject({ ok: false, code: "release-unavailable" });
    expect(result.ok ? "" : result.message).toMatch(/fixture-only|tag/i);
    expect(readdirSync(temporaryRoot)).toEqual([]);
  });

  it("rechecks the tag and preflight before writing and consumes tokens once", async () => {
    const fixture = taggedRelease();
    const release = adapter(fixture);
    const prepared = await prepare(fixture, release);
    if (!prepared.ok) throw new Error("expected prepared release");
    writeFileSync(join(fixture.repositoryRoot, "runtime.txt"), "new commit\n");
    git(fixture.repositoryRoot, ["add", "runtime.txt"]);
    git(fixture.repositoryRoot, ["commit", "--quiet", "-m", "move tag"]);
    git(fixture.repositoryRoot, ["tag", "-f", fixture.tag, "HEAD"]);

    const stale = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(stale).toMatchObject({ ok: false, code: "release-unavailable" });
    expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
    const reused = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(reused).toMatchObject({ ok: false, code: "stale-preflight" });
  });
});
