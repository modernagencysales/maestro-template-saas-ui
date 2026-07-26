import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

export function blueprintTargetPlan(
  content = "fixture blueprint\n",
  replacement?: { path: string; content: string },
) {
  const entries = [
    {
      path: "generated/fixture-blueprint.txt",
      ownership: "generated" as const,
      action: "generate" as const,
      upgrade: "regenerate" as const,
      sha256: hash(content),
      content,
    },
    ...(replacement
      ? [
          {
            path: replacement.path,
            ownership: "generated" as const,
            action: "generate" as const,
            upgrade: "regenerate" as const,
            replaces: "copy" as const,
            sha256: hash(replacement.content),
            content: replacement.content,
          },
        ]
      : []),
  ];
  const identity = {
    schemaVersion: 1 as const,
    id: "fixture-blueprint",
    provenance: "fixture-generator@1",
    registrations: ["generated/fixture-blueprint.txt"],
    entries: entries.map((entry) => ({
      path: entry.path,
      ownership: entry.ownership,
      action: entry.action,
      upgrade: entry.upgrade,
      sha256: entry.sha256,
      ...("replaces" in entry ? { replaces: entry.replaces } : {}),
    })),
  };
  return { ...identity, entries, digest: hash(JSON.stringify(identity)) };
}

export const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", root, ...args]);

export function taggedRelease(
  options: {
    customerProjectionRoot?: string;
    extraCopies?: Readonly<Record<string, string>>;
    replacement?: { path: string; content: string };
    blueprintRemovals?: readonly string[];
  } = {},
) {
  const repositoryRoot = makeRoot();
  const temporaryRoot = makeRoot("maestro-create-extract-");
  const homeRoot = makeRoot("maestro-create-home-");
  const targetRoot = join(makeRoot("maestro-create-target-parent-"), "app");
  const customerProjectionRoot = options.customerProjectionRoot;
  git(repositoryRoot, ["init", "--quiet"]);
  git(repositoryRoot, ["config", "user.email", "fixture@example.invalid"]);
  git(repositoryRoot, ["config", "user.name", "Fixture"]);
  writeFileSync(join(repositoryRoot, "runtime.txt"), "tagged runtime\n");
  writeFileSync(join(repositoryRoot, "package.json"), '{"tagged":true}\n');
  const projectionFiles = customerProjectionRoot
    ? [
        "package.json",
        "apps/cli/package.json",
        "apps/web/package.json",
        "packages/convex/package.json",
        "tooling/agent-pack/src/index.ts",
        "tooling/agent-pack/src/pluginContract.ts",
        "tooling/generators/src/index.ts",
        "tooling/quality/check-workflow-policy-snapshots.mts",
        "tooling/quality/check-workflow-principal-propagation.mts",
      ]
    : [];
  if (customerProjectionRoot) {
    for (const path of projectionFiles) {
      const source = resolve(customerProjectionRoot, path);
      if (!existsSync(source)) continue;
      mkdirSync(dirname(join(repositoryRoot, path)), { recursive: true });
      writeFileSync(join(repositoryRoot, path), readFileSync(source));
    }
  }
  for (const [path, bytes] of Object.entries(options.extraCopies ?? {})) {
    mkdirSync(dirname(join(repositoryRoot, path)), { recursive: true });
    writeFileSync(join(repositoryRoot, path), bytes);
  }
  git(repositoryRoot, ["add", "."]);
  git(repositoryRoot, ["commit", "--quiet", "-m", "fixture release"]);
  const sourceCommit = git(repositoryRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  const tag = "maestro-template-v1.2.3";
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
      ...[...projectionFiles, ...Object.keys(options.extraCopies ?? {})]
        .filter(
          (path) =>
            path !== "package.json" &&
            !options.blueprintRemovals?.includes(path),
        )
        .map((path) => ({
          path,
          match: "exact",
          ownership: "template-owned" as const,
          action: "copy" as const,
          upgrade: "replace" as const,
        })),
      ...(options.blueprintRemovals ?? []).map((path) => ({
        path,
        match: "exact" as const,
        ownership: "factory-only" as const,
        action: "omit" as const,
        upgrade: "remove" as const,
      })),
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
    expectedHashes: Object.fromEntries(
      [
        "runtime.txt",
        ...projectionFiles.filter((path) => path !== "package.json"),
        ...Object.keys(options.extraCopies ?? {}).filter(
          (path) => !options.blueprintRemovals?.includes(path),
        ),
      ].map((path) => [path, hash(readFileSync(join(repositoryRoot, path)))]),
    ),
    extensionSeams: [
      { path: "runtime.txt", description: "Fixture extension seam." },
    ],
  };
  const manifestPath = join(repositoryRoot, "release-manifest.json");
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(manifestPath, manifestBytes);
  git(repositoryRoot, ["add", "release-manifest.json"]);
  git(repositoryRoot, ["commit", "--quiet", "-m", "seal release authority"]);
  git(repositoryRoot, ["tag", tag]);
  const plan = blueprintTargetPlan("fixture blueprint\n", options.replacement);
  const blueprintManifest = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
    entries: plan.entries.map((entry) => ({
      path: entry.path,
      ownership: entry.ownership,
      action: entry.action,
      upgrade: entry.upgrade,
      sha256: entry.sha256,
      ...("replaces" in entry ? { replaces: entry.replaces } : {}),
    })),
  };
  const blueprintManifestPath = join(
    makeRoot("maestro-blueprint-authority-"),
    "manifest.json",
  );
  const blueprintManifestBytes = `${JSON.stringify(blueprintManifest, null, 2)}\n`;
  writeFileSync(blueprintManifestPath, blueprintManifestBytes);
  const result = {
    repositoryRoot,
    temporaryRoot,
    homeRoot,
    targetRoot,
    tag,
    manifest,
    manifestPath,
    ownershipManifestChecksum: hash(manifestBytes),
    blueprintManifestPath,
    blueprintManifestChecksum: hash(blueprintManifestBytes),
    replacement: options.replacement,
    baseOperations: [
      ...projectionFiles,
      ...Object.keys(options.extraCopies ?? {}),
    ],
  };
  return result;
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
    blueprintManifestPath: fixture.blueprintManifestPath,
    blueprintManifestChecksum: fixture.blueprintManifestChecksum,
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
    blueprintTargetPlan: () =>
      blueprintTargetPlan("fixture blueprint\n", fixture.replacement),
    templateInstance: (facts) =>
      `${JSON.stringify({ name: "My App", release: facts })}\n`,
  });
}
