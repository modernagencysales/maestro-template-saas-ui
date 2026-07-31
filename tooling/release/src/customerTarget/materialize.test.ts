import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateCustomerReleaseManifest } from "./manifest";
import {
  CustomerMaterializationError,
  materializeCustomerTarget,
  previewCustomerTarget,
  recoverInterruptedCustomerTarget,
  rollbackCustomerTarget,
  type CustomerMaterializationRequest,
} from "./materialize";

const temporaryRoots: string[] = [];
const makeRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "maestro-customer-target-"));
  temporaryRoots.push(root);
  return root;
};
afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const hash = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const fixture = () => {
  const root = makeRoot();
  const sourceRoot = join(root, "factory");
  const targetRoot = join(root, "customer");
  const homeRoot = join(root, "home");
  mkdirSync(sourceRoot);
  mkdirSync(homeRoot);
  writeFileSync(join(sourceRoot, "runtime.txt"), "runtime\n");
  writeFileSync(join(sourceRoot, "extension.txt"), "extension\n");
  const shippedFiles = {
    "runtime.txt": hash("runtime\n"),
    "extension.txt": hash("extension\n"),
  };
  const manifest = validateCustomerReleaseManifest(
    {
      $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
      schemaVersion: 1,
      materializationStatus: "materializable",
      release: {
        version: "0.1.0-alpha.1",
        tag: "maestro-template-v0.1.0-alpha.1",
        sourceCommit: "a".repeat(40),
        sourceChecksum: `sha256:${"b".repeat(64)}`,
      },
      compatibility: { cli: "0.1.x", agentPack: "0.1.x" },
      paths: [
        {
          path: "runtime.txt",
          match: "exact",
          ownership: "template-owned",
          action: "copy",
          upgrade: "replace",
        },
        {
          path: "extension.txt",
          match: "exact",
          ownership: "customer-extension",
          action: "copy",
          upgrade: "preserve",
        },
        {
          path: "template-instance.json",
          match: "exact",
          ownership: "generated",
          action: "generate",
          upgrade: "regenerate",
        },
        {
          path: "factory-only.txt",
          match: "exact",
          ownership: "factory-only",
          action: "omit",
          upgrade: "remove",
        },
      ],
      expectedHashes: shippedFiles,
      extensionSeams: [
        { path: "extension.txt", description: "Customer extension fixture." },
      ],
    },
    shippedFiles,
  );
  const request: CustomerMaterializationRequest = {
    manifest,
    sourceRoot,
    targetRoot,
    homeRoot,
    factoryRoot: sourceRoot,
    sourceDirty: false,
    sourceRevision: manifest.release.sourceCommit,
    generatedFiles: {
      "template-instance.json": Buffer.from('{"fixture":true}\n'),
    },
    resolvedRelease: {
      tag: manifest.release.tag,
      sourceCommit: manifest.release.sourceCommit,
      sourceChecksum: manifest.release.sourceChecksum,
    },
  };
  return { root, sourceRoot, targetRoot, request };
};

describe("customer target preview and materialization", () => {
  it("fails preview before writing an internally incomplete target", () => {
    const { targetRoot, request } = fixture();
    const broken = {
      ...request,
      blueprintTargetPlan: {
        digest: "sha256:broken",
        entries: [
          {
            path: "package.json",
            bytes: Buffer.from(
              JSON.stringify({
                name: "@example/customer",
                dependencies: { "@example/missing": "workspace:*" },
              }),
            ),
            ownership: "generated" as const,
            action: "generate" as const,
            upgrade: "regenerate" as const,
          },
          {
            path: "docs/template/worker.md",
            bytes: Buffer.from("Read `repos/confect/CLAUDE.md`.\n"),
            ownership: "generated" as const,
            action: "generate" as const,
            upgrade: "regenerate" as const,
          },
        ],
      },
    };

    expect(() => previewCustomerTarget(broken)).toThrow(
      "Customer target integrity failed",
    );
    expect(existsSync(targetRoot)).toBe(false);
  });

  it("previews exact writes, omissions, collisions, and bytes without mutation", () => {
    const { targetRoot, request } = fixture();
    const preview = previewCustomerTarget(request);

    expect(preview.writes.map(({ path }) => path)).toEqual([
      "extension.txt",
      "runtime.txt",
      "template-instance.json",
    ]);
    expect(preview.omissions).toEqual(["factory-only.txt"]);
    expect(preview.collisions).toEqual([]);
    expect(preview.totalBytes).toBe(
      Buffer.byteLength("extension\n") +
        Buffer.byteLength("runtime\n") +
        Buffer.byteLength('{"fixture":true}\n'),
    );
    expect(existsSync(targetRoot)).toBe(false);
  });

  it("reports collisions and refuses a non-empty ambiguous target", () => {
    const { targetRoot, request } = fixture();
    mkdirSync(targetRoot);
    writeFileSync(join(targetRoot, "prior.txt"), "customer work\n");
    const preview = previewCustomerTarget(request);

    expect(preview.collisions).toEqual(["prior.txt"]);
    expect(() => materializeCustomerTarget(request, preview)).toThrow(
      "Target contains collisions",
    );
    expect(readFileSync(join(targetRoot, "prior.txt"), "utf8")).toBe(
      "customer work\n",
    );
  });

  it("rejects dirty factories, protected roots, traversal, and symlink escape", () => {
    const { root, sourceRoot, request } = fixture();
    expect(() =>
      previewCustomerTarget({ ...request, sourceDirty: true }),
    ).toThrow("Factory source is dirty");
    for (const targetRoot of ["/", request.homeRoot, sourceRoot]) {
      expect(() => previewCustomerTarget({ ...request, targetRoot })).toThrow(
        CustomerMaterializationError,
      );
    }

    const outside = join(root, "outside.txt");
    writeFileSync(outside, "outside\n");
    rmSync(join(sourceRoot, "runtime.txt"));
    symlinkSync(outside, join(sourceRoot, "runtime.txt"));
    expect(() => previewCustomerTarget(request)).toThrow("Symbolic link");

    const traversal = JSON.parse(JSON.stringify(request.manifest));
    traversal.paths[0].path = "../escape.txt";
    expect(() =>
      previewCustomerTarget({ ...request, manifest: traversal }),
    ).toThrow("Unsafe materialization path");
  });

  it("rejects prospective targets beneath a separate live factory root", () => {
    const { root, request } = fixture();
    const liveFactory = join(root, "live-factory");
    const factoryAlias = join(root, "factory-alias");
    mkdirSync(liveFactory);
    symlinkSync(liveFactory, factoryAlias, "dir");
    const separated = { ...request, factoryRoot: liveFactory };

    for (const targetRoot of [
      liveFactory,
      join(liveFactory, "customer"),
      join(liveFactory, "nested", "..", "customer"),
      join(factoryAlias, "customer"),
    ]) {
      expect(() => previewCustomerTarget({ ...separated, targetRoot })).toThrow(
        "Target must be separate from the factory source",
      );
    }

    expect(() =>
      previewCustomerTarget({
        ...separated,
        targetRoot: join(root, "sibling-customer"),
      }),
    ).not.toThrow();
  });

  it("rejects an ancestor target containing a separate live factory root", () => {
    const { request } = fixture();
    const targetRoot = makeRoot();
    const factoryRoot = join(targetRoot, "live-factory");
    mkdirSync(factoryRoot);
    const before = readdirSync(targetRoot);

    expect(() =>
      previewCustomerTarget({ ...request, factoryRoot, targetRoot }),
    ).toThrow("Target must be separate from the factory source");
    expect(readdirSync(targetRoot)).toEqual(before);
  });

  it("fails on stale hashes or changed preflight without target mutation", () => {
    const { sourceRoot, targetRoot, request } = fixture();
    writeFileSync(join(sourceRoot, "runtime.txt"), "stale\n");
    expect(() => previewCustomerTarget(request)).toThrow(
      "Source hash mismatch",
    );
    expect(existsSync(targetRoot)).toBe(false);

    writeFileSync(join(sourceRoot, "runtime.txt"), "runtime\n");
    const preview = previewCustomerTarget(request);
    writeFileSync(join(sourceRoot, "runtime.txt"), "changed\n");
    expect(() => materializeCustomerTarget(request, preview)).toThrow(
      "Preflight changed",
    );
    expect(existsSync(targetRoot)).toBe(false);
  });

  it("recovers an interrupted staged write without exposing a partial target", () => {
    const { targetRoot, request } = fixture();
    const preview = previewCustomerTarget(request);

    expect(() =>
      materializeCustomerTarget(request, preview, { interruptAfterFiles: 1 }),
    ).toThrow("Materialization interrupted");
    expect(existsSync(targetRoot)).toBe(false);
    expect(recoverInterruptedCustomerTarget(request, preview)).toMatchObject({
      recovered: true,
    });
    expect(existsSync(preview.stageRoot)).toBe(false);

    const corrupted = fixture();
    const corruptedPreview = previewCustomerTarget(corrupted.request);
    expect(() =>
      materializeCustomerTarget(corrupted.request, corruptedPreview, {
        interruptAfterFiles: 1,
      }),
    ).toThrow("Materialization interrupted");
    const firstWrite = corruptedPreview.writes[0];
    expect(firstWrite).toBeDefined();
    if (firstWrite === undefined) {
      throw new CustomerMaterializationError("Expected a staged write fixture");
    }
    writeFileSync(
      join(corruptedPreview.stageRoot, firstWrite.path),
      "partial or changed bytes\n",
    );
    expect(() =>
      recoverInterruptedCustomerTarget(corrupted.request, corruptedPreview),
    ).toThrow("Rollback hash mismatch");
    expect(existsSync(corrupted.targetRoot)).toBe(false);
    expect(existsSync(corruptedPreview.stageRoot)).toBe(true);
  });

  it("promotes exact bytes and rolls back only hash-confirmed output", () => {
    const { targetRoot, request } = fixture();
    const preview = previewCustomerTarget(request);
    materializeCustomerTarget(request, preview);

    expect(readFileSync(join(targetRoot, "runtime.txt"), "utf8")).toBe(
      "runtime\n",
    );
    expect(rollbackCustomerTarget(targetRoot)).toMatchObject({
      rolledBack: true,
    });
    expect(existsSync(targetRoot)).toBe(false);

    const second = fixture();
    const secondPreview = previewCustomerTarget(second.request);
    materializeCustomerTarget(second.request, secondPreview);
    writeFileSync(join(second.targetRoot, "runtime.txt"), "customer edit\n");
    expect(() => rollbackCustomerTarget(second.targetRoot)).toThrow(
      "Rollback hash mismatch",
    );
    expect(readdirSync(second.targetRoot)).toEqual(
      expect.arrayContaining(["extension.txt", "runtime.txt"]),
    );
    expect(readFileSync(join(second.targetRoot, "extension.txt"), "utf8")).toBe(
      "extension\n",
    );
  });
});
