import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { createCustomerReleaseAdapter } from "./createAdapter.js";

const temporaryRoots: string[] = [];

export const makeRoot = (prefix = "maestro-create-adapter-"): string => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

export const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args]);

export function taggedRelease() {
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

export type TaggedReleaseFixture = ReturnType<typeof taggedRelease>;

export function adapter(fixture: TaggedReleaseFixture) {
  return createCustomerReleaseAdapter({
    repositoryRoot: fixture.repositoryRoot,
    manifestPath: fixture.manifestPath,
    ownershipManifestChecksum: fixture.ownershipManifestChecksum,
    tag: fixture.tag,
    homeRoot: fixture.homeRoot,
    temporaryRoot: fixture.temporaryRoot,
  });
}

export function prepare(
  fixture: TaggedReleaseFixture,
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
