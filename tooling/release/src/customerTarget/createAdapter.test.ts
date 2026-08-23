import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createCustomerCurrentAdapter,
  createCustomerReleaseAdapter,
} from "./createAdapter.js";
import { composedReleasePaths } from "./createAdapter.archive.js";
import {
  adapter,
  blueprintTargetPlan,
  git,
  hash,
  makeRoot,
  prepare,
  taggedRelease,
  type TaggedReleaseFixture,
} from "./createAdapter.testFixtures.js";

describe("customer release create adapter", () => {
  it("lets additional release authority replace an inherited path", () => {
    expect(
      composedReleasePaths(
        [
          {
            path: "tooling/workflow",
            match: "subtree",
            ownership: "template-owned",
            action: "copy",
            upgrade: "replace",
          },
        ],
        [
          {
            path: "tooling/workflow",
            match: "subtree",
            ownership: "factory-only",
            action: "omit",
            upgrade: "remove",
          },
        ],
        [],
      ),
    ).toEqual([
      {
        path: "tooling/workflow",
        match: "subtree",
        ownership: "factory-only",
        action: "omit",
        upgrade: "remove",
      },
    ]);
  });

  it("turns composed release deletions into exact factory omissions", () => {
    expect(
      composedReleasePaths(
        [
          {
            path: "retired.json",
            match: "exact",
            ownership: "template-owned",
            action: "copy",
            upgrade: "replace",
          },
        ],
        [],
        [{ kind: "delete", path: "retired.json" }],
      ),
    ).toEqual([
      {
        path: "retired.json",
        match: "exact",
        ownership: "factory-only",
        action: "omit",
        upgrade: "remove",
      },
    ]);
  });

  it("binds exact current omission authority into preview and provenance", async () => {
    const fixture = taggedRelease();
    const options = {
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: fixture.manifestPath,
      ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: fixture.blueprintManifestPath,
      blueprintManifestChecksum: fixture.blueprintManifestChecksum,
      blueprintId: "fixture-blueprint",
      blueprintProvenance: "fixture-generator@1",
    } as const;
    const baseline = await prepare(
      fixture,
      createCustomerCurrentAdapter(options),
    );
    const omissionPath = "factory-only/current-composition.ts";
    const withOmission = await prepare(
      fixture,
      createCustomerCurrentAdapter({
        ...options,
        currentOmissions: [omissionPath],
      }),
    );
    if (!baseline.ok || !withOmission.ok)
      throw new Error("expected prepared current compositions");

    expect(withOmission.preview.omissions).toContain(omissionPath);
    expect(withOmission.facts.sourceChecksum).not.toBe(
      baseline.facts.sourceChecksum,
    );
    expect(withOmission.facts.ownershipManifestChecksum).toBe(
      withOmission.facts.sourceChecksum,
    );
  });

  it("projects immutable release identity when current HEAD is the exact tag", async () => {
    const fixture = taggedRelease();
    const current = createCustomerCurrentAdapter({
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: fixture.manifestPath,
      ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: fixture.blueprintManifestPath,
      blueprintManifestChecksum: fixture.blueprintManifestChecksum,
      blueprintId: "fixture-blueprint",
      blueprintProvenance: "fixture-generator@1",
    });

    const prepared = await prepare(fixture, current);
    expect(prepared).toMatchObject({
      ok: true,
      facts: {
        version: "1.2.3",
        tag: fixture.tag,
        sourceCommit: git(fixture.repositoryRoot, ["rev-parse", "HEAD"])
          .toString("utf8")
          .trim(),
        sourceChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        cliCompatibility: "1.2.x",
        agentPackCompatibility: "1.2.x",
        ownershipManifest: "tagged-current-composition",
      },
    });
  });

  it("fails closed when current HEAD is beyond the reviewed immutable tag", async () => {
    const fixture = taggedRelease();
    git(fixture.repositoryRoot, [
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "unreleased work",
    ]);
    const current = createCustomerCurrentAdapter({
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: fixture.manifestPath,
      ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: fixture.blueprintManifestPath,
      blueprintManifestChecksum: fixture.blueprintManifestChecksum,
      blueprintId: "fixture-blueprint",
      blueprintProvenance: "fixture-generator@1",
    });

    await expect(prepare(fixture, current)).resolves.toMatchObject({
      ok: false,
      code: "release-unavailable",
      message: expect.stringMatching(/HEAD.*reviewed immutable release tag/i),
    });
    expect(existsSync(fixture.targetRoot)).toBe(false);
  });

  it("rechecks exact tagged HEAD before materializing current composition", async () => {
    const fixture = taggedRelease();
    const current = createCustomerCurrentAdapter({
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: fixture.manifestPath,
      ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: fixture.blueprintManifestPath,
      blueprintManifestChecksum: fixture.blueprintManifestChecksum,
      blueprintId: "fixture-blueprint",
      blueprintProvenance: "fixture-generator@1",
    });
    const prepared = await prepare(fixture, current);
    if (!prepared.ok) throw new Error("expected prepared release");
    git(fixture.repositoryRoot, [
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "unreleased work after preview",
    ]);

    const result = await current.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(result).toMatchObject({
      ok: false,
      code: "release-unavailable",
      message: expect.stringMatching(/HEAD.*reviewed immutable release tag/i),
    });
    expect(existsSync(fixture.targetRoot)).toBe(false);
  });

  it("requires the immutable tag to carry the exact compiled manifest bytes", async () => {
    const fixture = taggedRelease();
    git(fixture.repositoryRoot, [
      "tag",
      "--force",
      fixture.tag,
      fixture.manifest.release.sourceCommit,
    ]);
    await expect(prepare(fixture, adapter(fixture))).resolves.toMatchObject({
      code: "release-unavailable",
      message: expect.stringMatching(
        /tag does not contain the ownership manifest/,
      ),
    });
  });

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
          { path: "generated/fixture-blueprint.txt" },
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
    expect(written).toEqual({ ok: true, files: 4 });
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

  it("resolves nested composed releases through the original ownership manifest", async () => {
    const fixture = taggedRelease();
    const releaseRoot = join(fixture.repositoryRoot, "releases");
    mkdirSync(releaseRoot);
    const basePath = join(releaseRoot, "base.json");
    const middlePath = join(releaseRoot, "middle.json");
    const currentPath = join(releaseRoot, "current.json");
    const blueprintPath = join(releaseRoot, "blueprint.json");
    writeFileSync(basePath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    const middle = {
      kind: "composed-customer-release",
      materializationStatus: "materializable",
      baseManifest: {
        path: "base.json",
        sha256: hash(readFileSync(basePath)),
      },
      release: fixture.manifest.release,
      additionalPaths: [],
      deriveExpectedHashesFromArchive: true,
    };
    writeFileSync(middlePath, `${JSON.stringify(middle, null, 2)}\n`);
    writeFileSync(blueprintPath, readFileSync(fixture.blueprintManifestPath));
    const current = {
      ...middle,
      baseManifest: {
        path: "middle.json",
        sha256: hash(readFileSync(middlePath)),
      },
      blueprintManifest: {
        path: "blueprint.json",
        sha256: hash(readFileSync(blueprintPath)),
      },
    };
    writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`);
    git(fixture.repositoryRoot, ["add", "releases"]);
    git(fixture.repositoryRoot, [
      "commit",
      "--quiet",
      "-m",
      "compose nested release",
    ]);
    git(fixture.repositoryRoot, ["tag", "-f", fixture.tag, "HEAD"]);
    const release = createCustomerReleaseAdapter({
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: currentPath,
      ownershipManifestChecksum: hash(readFileSync(currentPath)),
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: blueprintPath,
      blueprintManifestChecksum: hash(readFileSync(blueprintPath)),
    });

    const result = await prepare(fixture, release);
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      facts: { tag: fixture.tag },
      preview: {
        writes: expect.arrayContaining([
          expect.objectContaining({ path: "runtime.txt" }),
        ]),
      },
    });
  });

  it("allows only release-reviewed blueprint entries to be personalized", async () => {
    const fixture = taggedRelease();
    const reviewed = JSON.parse(
      readFileSync(fixture.blueprintManifestPath, "utf8"),
    ) as Record<string, unknown>;
    reviewed.parameterizedEntries = ["generated/fixture-blueprint.txt"];
    writeFileSync(
      fixture.blueprintManifestPath,
      `${JSON.stringify(reviewed, null, 2)}\n`,
    );
    fixture.blueprintManifestChecksum = hash(
      readFileSync(fixture.blueprintManifestPath),
    );
    const release = adapter(fixture);
    const result = await release.prepare({
      repo: {
        workingDirectory: fixture.repositoryRoot,
        sourceRoot: fixture.repositoryRoot,
      },
      target: fixture.targetRoot,
      blueprintTargetPlan: () => blueprintTargetPlan("personalized app\n"),
      templateInstance: (facts) =>
        `${JSON.stringify({ name: "Personalized App", release: facts })}\n`,
    });

    expect(result).toMatchObject({
      ok: true,
      preview: {
        writes: expect.arrayContaining([
          expect.objectContaining({
            path: "generated/fixture-blueprint.txt",
          }),
        ]),
      },
    });
  });

  it("accepts a checksum-bound hardening authority without changing tagged ownership", async () => {
    const fixture = taggedRelease();
    const hardenedPlan = blueprintTargetPlan("hardened app\n");
    const baseAuthority = JSON.parse(
      readFileSync(fixture.blueprintManifestPath, "utf8"),
    ) as Record<string, unknown>;
    const hardeningPath = join(fixture.repositoryRoot, "hardening.json");
    writeFileSync(
      hardeningPath,
      `${JSON.stringify(
        {
          ...baseAuthority,
          entries: hardenedPlan.entries.map(({ content, ...entry }) => {
            void content;
            return entry;
          }),
        },
        null,
        2,
      )}\n`,
    );
    const release = createCustomerReleaseAdapter({
      repositoryRoot: fixture.repositoryRoot,
      manifestPath: fixture.manifestPath,
      ownershipManifestChecksum: fixture.ownershipManifestChecksum,
      tag: fixture.tag,
      homeRoot: fixture.homeRoot,
      temporaryRoot: fixture.temporaryRoot,
      blueprintManifestPath: fixture.blueprintManifestPath,
      blueprintManifestChecksum: fixture.blueprintManifestChecksum,
      blueprintAuthorityManifestPath: hardeningPath,
      blueprintAuthorityManifestChecksum: hash(readFileSync(hardeningPath)),
    });

    await expect(
      release.prepare({
        repo: {
          workingDirectory: fixture.repositoryRoot,
          sourceRoot: fixture.repositoryRoot,
        },
        target: fixture.targetRoot,
        blueprintTargetPlan: () => hardenedPlan,
        templateInstance: (facts) => JSON.stringify({ release: facts }),
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it.each([
    [
      "ownership manifest",
      (fixture: TaggedReleaseFixture) => {
        fixture.ownershipManifestChecksum = `sha256:${"0".repeat(64)}`;
      },
    ],
    [
      "tag commit",
      (fixture: TaggedReleaseFixture) => {
        fixture.manifest.release.sourceCommit = "0".repeat(40);
        rewriteManifest(fixture);
      },
    ],
    [
      "archive",
      (fixture: TaggedReleaseFixture) => {
        fixture.manifest.release.sourceChecksum = `sha256:${"0".repeat(64)}`;
        rewriteManifest(fixture);
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
      blueprintManifestPath: manifestPath,
      blueprintManifestChecksum: hash(readFileSync(manifestPath)),
    });
    const result = await release.prepare({
      repo: { workingDirectory: repositoryRoot, sourceRoot: repositoryRoot },
      target: join(makeRoot("maestro-create-current-target-"), "app"),
      blueprintTargetPlan: () => {
        throw new Error("fixture-only release must fail before blueprint use");
      },
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
    expect(stale).toMatchObject({ ok: false, code: "stale-preflight" });
    expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
    const reused = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(reused).toMatchObject({ ok: false, code: "stale-preflight" });
  });
  it("binds materialization to the exact tag commit resolved at prepare", async () => {
    const fixture = taggedRelease();
    const release = adapter(fixture);
    const prepared = await prepare(fixture, release);
    if (!prepared.ok) throw new Error("expected prepared release");
    git(fixture.repositoryRoot, [
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "move tag without changing release bytes",
    ]);
    git(fixture.repositoryRoot, ["tag", "-f", fixture.tag, "HEAD"]);
    const result = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(result).toMatchObject({ ok: false, code: "stale-preflight" });
    expect(existsSync(fixture.targetRoot)).toBe(false);
    expect(readdirSync(fixture.temporaryRoot)).toEqual([]);
  });

  it.each([
    [
      "duplicate path",
      () => {
        const plan = blueprintTargetPlan();
        return rehashPlan({
          ...plan,
          entries: [...plan.entries, firstPlanEntry(plan)],
        });
      },
    ],
    [
      "release overlap",
      () => {
        const plan = blueprintTargetPlan();
        const entry = { ...firstPlanEntry(plan), path: "runtime.txt" };
        return rehashPlan({
          ...plan,
          registrations: [entry.path],
          entries: [entry],
        });
      },
    ],
    [
      "registration omission",
      () =>
        rehashPlan({ ...blueprintTargetPlan(), registrations: ["missing.ts"] }),
    ],
    [
      "byte drift",
      () => {
        const plan = blueprintTargetPlan();
        return {
          ...plan,
          entries: [{ ...firstPlanEntry(plan), content: "drift\n" }],
        };
      },
    ],
    [
      "unclassified posture",
      () => {
        const plan = blueprintTargetPlan();
        return rehashPlan({
          ...plan,
          entries: [{ ...firstPlanEntry(plan), ownership: "template-owned" }],
        } as never);
      },
    ],
  ] as const)("rejects blueprint target plan %s", async (...testCase) => {
    const buildPlan = testCase[1];
    const fixture = taggedRelease();
    const result = await adapter(fixture).prepare({
      repo: {
        workingDirectory: fixture.repositoryRoot,
        sourceRoot: fixture.repositoryRoot,
      },
      target: fixture.targetRoot,
      blueprintTargetPlan: buildPlan as never,
      templateInstance: () => "{}\n",
    });
    expect(result).toMatchObject({ ok: false });
    expect(existsSync(fixture.targetRoot)).toBe(false);
  });

  it("rebuilds the blueprint plan and rejects drift before materialization", async () => {
    const fixture = taggedRelease();
    const release = adapter(fixture);
    let calls = 0;
    const prepared = await release.prepare({
      repo: {
        workingDirectory: fixture.repositoryRoot,
        sourceRoot: fixture.repositoryRoot,
      },
      target: fixture.targetRoot,
      blueprintTargetPlan: () =>
        blueprintTargetPlan(calls++ === 0 ? "fixture blueprint\n" : "second\n"),
      templateInstance: () => "{}\n",
    });
    if (!prepared.ok) throw new Error("expected prepared release");
    const result = await release.materialize(
      prepared.token,
      prepared.preview.preflightFingerprint,
    );
    expect(result).toMatchObject({ ok: false, code: "release-unavailable" });
    expect(existsSync(fixture.targetRoot)).toBe(false);
  });

  it("rejects a valid self-digest when reviewed blueprint bytes drift", async () => {
    const fixture = taggedRelease();
    const result = await adapter(fixture).prepare({
      repo: {
        workingDirectory: fixture.repositoryRoot,
        sourceRoot: fixture.repositoryRoot,
      },
      target: fixture.targetRoot,
      blueprintTargetPlan: () => blueprintTargetPlan("generator drift\n"),
      templateInstance: () => "{}\n",
    });
    expect(result).toMatchObject({ ok: false, code: "release-unavailable" });
    expect(result.ok ? "" : result.message).toMatch(/reviewed release/i);
  });
});

function rehashPlan(plan: ReturnType<typeof blueprintTargetPlan>) {
  const identity = {
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
    })),
  };
  return { ...plan, digest: hash(JSON.stringify(identity)) };
}

function firstPlanEntry(plan: ReturnType<typeof blueprintTargetPlan>) {
  const entry = plan.entries[0];
  if (entry === undefined) throw new Error("Blueprint fixture has no entries");
  return entry;
}

function rewriteManifest(fixture: TaggedReleaseFixture): void {
  const bytes = `${JSON.stringify(fixture.manifest, null, 2)}\n`;
  writeFileSync(fixture.manifestPath, bytes);
  fixture.ownershipManifestChecksum = hash(bytes);
}
