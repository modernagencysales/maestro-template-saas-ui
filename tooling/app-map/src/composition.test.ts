import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CURRENT_TEMPLATE_INSTANCE_VERSIONS,
  TEMPLATE_INSTANCE_COMPATIBILITY,
  TEMPLATE_INSTANCE_PROVENANCE,
  serializeTemplateInstance,
} from "@maestro-template/template-core/templateInstance";
import { afterEach, describe, expect, it } from "vitest";
import { serializeAppMap } from "./build";
import {
  composeAppMap,
  type AppMapGeneratedSourceOverrideV1,
} from "./composition";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true });
});

const fixtureRepository = (options?: {
  readonly templateInstance?: boolean;
  readonly featureProvenance?: boolean;
  readonly featureTopology?: boolean;
}): {
  readonly root: string;
  readonly revision: string;
} => {
  const root = mkdtempSync(join(tmpdir(), "app-map-composition-"));
  temporary.push(root);
  const sourceRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  execFileSync("git", ["clone", "--shared", "--no-checkout", sourceRoot, root]);
  execFileSync("git", ["read-tree", "HEAD"], { cwd: root });
  if (options?.featureProvenance) {
    const provenancePath =
      "docs/template/generated/provenance/add-feature/records.json";
    const routeTreePath = "apps/web/src/routeTree.gen.ts";
    mkdirSync(join(root, "docs/template/generated/provenance/add-feature"), {
      recursive: true,
    });
    mkdirSync(join(root, "apps/web/src"), { recursive: true });
    writeFileSync(
      join(root, provenancePath),
      `${JSON.stringify({
        generator: "add-feature",
        commandFamily: "template:add-feature",
        name: "records",
        ownership: { system: "knowledge-brain", disposition: "extend" },
        generatedPaths: ["apps/web/src/routes/_workspace.records.tsx"],
      })}\n`,
    );
    writeFileSync(
      join(root, routeTreePath),
      `${execFileSync("git", ["show", `HEAD:${routeTreePath}`], {
        cwd: root,
        encoding: "utf8",
      })}\nconst recordsRoute = route.update({ path: routes.records });\ninterface FeatureRoutes { records: { fullPath: "/records" } }\n`,
    );
    if (options.featureTopology) {
      const topologyPath = "docs/template/product-topology.json";
      const topology = JSON.parse(
        execFileSync("git", ["show", `HEAD:${topologyPath}`], {
          cwd: root,
          encoding: "utf8",
        }),
      ) as { resources: unknown[] };
      topology.resources.push({
        id: "route:records",
        kind: "route",
        system: "record-management",
        path: "apps/web/src/routes/_workspace.records.tsx",
        responsibility: "present records",
        surfaces: ["web"],
        uses: ["access-and-tenancy"],
        lifecycle: "active",
      });
      mkdirSync(join(root, "docs/template"), { recursive: true });
      writeFileSync(join(root, topologyPath), `${JSON.stringify(topology)}\n`);
      const systemsPath = "docs/template/system-catalog.json";
      const systems = JSON.parse(
        execFileSync("git", ["show", `HEAD:${systemsPath}`], {
          cwd: root,
          encoding: "utf8",
        }),
      ) as { systems: unknown[] };
      systems.systems.push({
        id: "record-management",
        name: "Record Management",
        kind: "product-system",
        lifecycle: "active",
        implementationStatus: "real",
        summary: "Owns records.",
        responsibilities: ["manage records"],
        aliases: ["records"],
        tables: [],
        canonicalEntrypoints: [
          "packages/convex/confect/records/records.spec.ts",
        ],
        decisionRef: "docs/template/system-catalog.md#record-management",
      });
      writeFileSync(join(root, systemsPath), `${JSON.stringify(systems)}\n`);
      execFileSync("git", ["add", topologyPath, systemsPath], { cwd: root });
    }
    execFileSync("git", ["add", provenancePath, routeTreePath], { cwd: root });
  }
  if (options?.templateInstance !== false) {
    writeFileSync(
      join(root, "template-instance.json"),
      serializeTemplateInstance({
        schemaVersion: 2,
        versions: { ...CURRENT_TEMPLATE_INSTANCE_VERSIONS },
        release: {
          version: "0.2.0-alpha.1",
          tag: "maestro-template-v0.2.0-alpha.1",
        },
        compatibility: structuredClone(TEMPLATE_INSTANCE_COMPATIBILITY),
        support: {
          state: "supported",
          deprecationDate: null,
          releaseAvailability: "unavailable",
          releaseEvidence: "workspace-only",
        },
        provenance: { ...TEMPLATE_INSTANCE_PROVENANCE },
      }),
    );
    execFileSync("git", ["add", "template-instance.json"], { cwd: root });
  }
  if (options?.templateInstance !== false)
    execFileSync(
      "git",
      [
        "-c",
        "user.name=App Map Test",
        "-c",
        "user.email=app-map@example.invalid",
        "commit",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
  return {
    root,
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
  };
};
const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const generatedOverride = (
  revision: string,
): AppMapGeneratedSourceOverrideV1 => {
  const generation = {
    kind: "release-blueprint-template-instance-facts" as const,
    sourceRevision: revision,
    blueprintId: "saas-application",
    blueprintProvenance: "@maestro-template/generators/saas-application@1",
    blueprintPlanDigest: `sha256:${"1".repeat(64)}`,
    blueprintManifestDigest: `sha256:${"2".repeat(64)}`,
  };
  const bytes = `${JSON.stringify(
    {
      schemaVersion: 1,
      kind: generation.kind,
      sourceRevision: revision,
      blueprint: {
        id: generation.blueprintId,
        provenance: generation.blueprintProvenance,
        planDigest: generation.blueprintPlanDigest,
        manifestDigest: generation.blueprintManifestDigest,
      },
      support: { state: "supported" },
    },
    null,
    2,
  )}\n`;
  return {
    sourceId: "template-instance",
    sourcePath: "template-instance.json",
    bytes,
    bytesDigest: sha256(bytes),
    generation,
  };
};

describe("closed App Map composition", () => {
  it("accepts a sparse valid Confect manifest with no topology relations", async () => {
    const fixture = fixtureRepository();
    const manifestPath =
      "packages/template-core/src/generated/confectManifest.ts";
    mkdirSync(join(fixture.root, "packages/template-core/src/generated"), {
      recursive: true,
    });
    writeFileSync(
      join(fixture.root, manifestPath),
      'export const confectManifest = { version: 1, functions: [{ operationId: "records.list", surfaces: ["web"] }] } as const;\n',
    );
    execFileSync("git", ["add", manifestPath], { cwd: fixture.root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=App Map Test",
        "-c",
        "user.email=app-map@example.invalid",
        "commit",
        "-m",
        "sparse Confect manifest",
      ],
      { cwd: fixture.root },
    );
    const result = await composeAppMap({
      repoRoot: fixture.root,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.root,
        encoding: "utf8",
      }).trim(),
    });
    expect(result.ok, result.ok ? undefined : result.message).toBe(true);
    if (!result.ok) return;
    for (const sourceId of ["confect-contracts", "headless-registry"])
      expect(
        result.input.batches.find(({ source }) => source.id === sourceId)
          ?.edges,
      ).toEqual([]);
  });

  it("distinguishes a missing workflow registry from an empty registry", async () => {
    const fixture = fixtureRepository();
    const registryPath =
      "packages/convex/confect/workflows/_generated/workflowRegistry.ts";
    execFileSync("git", ["rm", registryPath], {
      cwd: fixture.root,
    });
    execFileSync(
      "git",
      [
        "rm",
        "docs/template/generated/provenance/add-workflow/publicationFixture.json",
      ],
      { cwd: fixture.root },
    );
    execFileSync(
      "git",
      [
        "-c",
        "user.name=App Map Test",
        "-c",
        "user.email=app-map@example.invalid",
        "commit",
        "-m",
        "missing registry",
      ],
      { cwd: fixture.root },
    );
    const missing = await composeAppMap({
      repoRoot: fixture.root,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.root,
        encoding: "utf8",
      }).trim(),
    });
    expect(missing.ok).toBe(false);

    mkdirSync(
      join(fixture.root, "packages/convex/confect/workflows/_generated"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(fixture.root, registryPath),
      `const definePublicationRegistry = <const Registry>(registry: Registry): Registry => registry;\nexport const workflowPublicationRegistry = definePublicationRegistry({ capabilities: [], workflows: [] });\n`,
    );
    execFileSync("git", ["add", registryPath], { cwd: fixture.root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=App Map Test",
        "-c",
        "user.email=app-map@example.invalid",
        "commit",
        "-m",
        "empty registry",
      ],
      { cwd: fixture.root },
    );
    const empty = await composeAppMap({
      repoRoot: fixture.root,
      revision: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: fixture.root,
        encoding: "utf8",
      }).trim(),
    });
    expect(empty.ok, empty.ok ? undefined : empty.message).toBe(true);
  });

  it("loads all eleven exact-revision sources and builds byte-stably", async () => {
    const fixture = fixtureRepository();
    const first = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    // Exact-revision composition must ignore dirty canonical working-tree bytes.
    writeFileSync(join(fixture.root, "template-instance.json"), "{}\n");
    const second = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    expect(first.ok, first.ok ? undefined : first.message).toBe(true);
    expect(second.ok, second.ok ? undefined : second.message).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.input.batches).toHaveLength(11);
    for (const batch of first.input.batches) {
      const facts = [...batch.nodes, ...batch.edges];
      if (batch.source.id === "template-instance") {
        expect(facts).toHaveLength(0);
        continue;
      }
      expect(
        facts.length,
        `${batch.source.id} must project facts`,
      ).toBeGreaterThan(0);
      expect(
        facts.every(
          (fact) =>
            fact.provenance.sourceId === batch.source.id &&
            fact.provenance.sourceVersion === fixture.revision &&
            fact.provenance.sourceDigest === batch.source.digest,
        ),
      ).toBe(true);
    }
    expect(
      first.input.batches.find(
        ({ source }) => source.id === "template-instance",
      ),
    ).toMatchObject({ nodes: [], edges: [] });
    const generated = first.input.batches.find(
      ({ source }) => source.id === "generator-provenance",
    );
    expect(generated?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "capability:evaluate-app-idea",
          kind: "capability",
        }),
        expect.objectContaining({
          id: "capability:manage-evaluation-report",
          kind: "capability",
        }),
        expect.objectContaining({
          id: "resource:client-domain:evaluator",
          kind: "resource",
        }),
        expect.objectContaining({
          id: "workflow:generate-complete-build-pack",
          kind: "workflow",
        }),
      ]),
    );
    expect(generated?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "owns:system:policy-and-prompts->capability:evaluate-app-idea",
        }),
        expect.objectContaining({
          id: "owns:system:knowledge-brain->resource:client-domain:evaluator",
        }),
        expect.objectContaining({
          id: "owns:system:workflow-runtime->workflow:generate-complete-build-pack",
        }),
      ]),
    );
    expect(serializeAppMap(first.build.map)).toBe(
      serializeAppMap(second.build.map),
    );
  }, 20_000);

  it("rejects symbolic revisions before reading canonical sources", async () => {
    await expect(
      composeAppMap({ repoRoot: process.cwd(), revision: "HEAD" }),
    ).resolves.toMatchObject({
      ok: false,
      code: "APP_MAP_COMPOSITION_INVALID",
    });
  });

  it("projects reviewed add-feature provenance to its generated route", async () => {
    const fixture = fixtureRepository({ featureProvenance: true });
    const result = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    expect(result.ok, result.ok ? undefined : result.message).toBe(true);
    if (!result.ok) return;
    const edges = result.input.batches.find(
      ({ source }) => source.id === "generator-provenance",
    )?.edges;
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "generated-by:route:records->package:tooling/generators",
          kind: "generated-by",
          from: "route:records",
          to: "package:tooling/generators",
        }),
        expect.objectContaining({
          id: "owns:system:knowledge-brain->route:records",
          kind: "owns",
          from: "system:knowledge-brain",
          to: "route:records",
        }),
      ]),
    );
  }, 20_000);

  it("keeps add-feature history without duplicating topology ownership", async () => {
    const fixture = fixtureRepository({
      featureProvenance: true,
      featureTopology: true,
    });
    const result = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    expect(result.ok, result.ok ? undefined : result.message).toBe(true);
    if (!result.ok) return;
    const edges = result.input.batches.find(
      ({ source }) => source.id === "generator-provenance",
    )?.edges;
    expect(edges).toContainEqual(
      expect.objectContaining({
        id: "generated-by:route:records->package:tooling/generators",
      }),
    );
    expect(edges).not.toContainEqual(
      expect.objectContaining({
        id: "owns:system:knowledge-brain->route:records",
      }),
    );
  }, 20_000);

  it("composes a factory revision only from exact reviewed generated facts", async () => {
    const fixture = fixtureRepository({ templateInstance: false });
    const missing = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
    });
    expect(missing).toMatchObject({ ok: false });
    const override = generatedOverride(fixture.revision);
    const first = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
      generatedSourceOverrides: [override],
    });
    const second = await composeAppMap({
      repoRoot: fixture.root,
      revision: fixture.revision,
      generatedSourceOverrides: [override],
    });
    expect(first.ok, first.ok ? undefined : first.message).toBe(true);
    expect(second.ok, second.ok ? undefined : second.message).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(
      first.input.batches.find(
        ({ source }) => source.id === "template-instance",
      )?.source,
    ).toMatchObject({
      version: fixture.revision,
      digest: override.bytesDigest,
      generation: override.generation,
    });
    expect(serializeAppMap(first.build.map)).toBe(
      serializeAppMap(second.build.map),
    );
  }, 20_000);

  it.each(["digest", "revision", "bytes", "extra"] as const)(
    "rejects %s generated-source override drift",
    async (kind) => {
      const fixture = fixtureRepository({ templateInstance: false });
      const exact = generatedOverride(fixture.revision);
      const override: AppMapGeneratedSourceOverrideV1 =
        kind === "digest"
          ? { ...exact, bytesDigest: `sha256:${"0".repeat(64)}` }
          : kind === "revision"
            ? {
                ...exact,
                generation: {
                  ...exact.generation,
                  sourceRevision: "0".repeat(40),
                },
              }
            : kind === "bytes"
              ? { ...exact, bytes: "{}\n", bytesDigest: sha256("{}\n") }
              : exact;
      const result = await composeAppMap({
        repoRoot: fixture.root,
        revision: fixture.revision,
        generatedSourceOverrides:
          kind === "extra" ? [override, override] : [override],
      });
      expect(result).toMatchObject({ ok: false });
    },
  );
});
