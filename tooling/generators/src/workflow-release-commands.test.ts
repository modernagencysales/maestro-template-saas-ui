import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCustomerGeneratorCli } from "./customer-dispatcher";

import {
  buildAuthoritativeSourceClosure,
  bumpRelease,
  checksumReleaseDescriptor,
  publishRelease,
  type ReleaseDescriptor,
  type SourceClosure,
} from "./workflow-release-commands";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const write = (root: string, path: string, source: string): void => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
};

const descriptorPath =
  "packages/convex/confect/workflows/fixture/v1.publication.json";
const releasePath = "packages/convex/confect/workflows/fixture/v1.release.ts";

const writeDescriptor = (root: string, descriptor: ReleaseDescriptor): void =>
  write(root, descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);

const withReleaseChecksum = (
  descriptor: ReleaseDescriptor,
): ReleaseDescriptor => {
  const candidate = {
    ...descriptor,
    fingerprint: { ...descriptor.fingerprint, releaseChecksum: "pending" },
  };
  return {
    ...candidate,
    fingerprint: {
      ...candidate.fingerprint,
      releaseChecksum: checksumReleaseDescriptor(candidate),
    },
  };
};

const fixture = (): { root: string; descriptor: ReleaseDescriptor } => {
  const root = mkdtempSync(join(tmpdir(), "maestro-publication-authority-"));
  const graph = 'import { value } from "./dep";\nexport const graph = value;\n';
  const dependency = 'export const value = "v1";\n';
  const interpreter = "export const runtimeVersion = 2;\n";
  write(root, "src/graph.ts", graph);
  write(root, "src/dep.ts", dependency);
  write(root, "src/interpreter.ts", interpreter);
  write(root, releasePath, 'export const lifecycle = "draft";\n');
  const sourceClosure = buildAuthoritativeSourceClosure(root, [
    "src/graph.ts",
    "src/interpreter.ts",
  ]);
  const dependencyChecksum = sha256(
    JSON.stringify(
      canonicalize([{ path: "src/dep.ts", checksum: sha256(dependency) }]),
    ),
  );
  const authorityChecksum = sha256(
    JSON.stringify(
      canonicalize({
        schemaVersion: 1,
        kind: "workflow",
        logicalId: "workflow.fixture",
        version: 1,
        sourceClosure,
      }),
    ),
  );
  const descriptor = withReleaseChecksum({
    kind: "workflow",
    logicalId: "workflow.fixture",
    name: "fixture",
    version: 1,
    lifecycle: "draft",
    semanticComplete: true,
    isolatedFixture: true,
    fingerprint: {
      graphHash: sha256(graph),
      runnerRef: "workflowRunners/fixture/v1:run",
      kickoffProfiles: "queued",
      capabilityBindings: "none",
      completionRef: "workflowRunners/fixture/v1:onComplete",
      runtimeVersion: "maestro-workflow-runtime.v2",
      sourceClosure: sourceClosure.checksum,
      authorityChecksum,
      stableStepNames: "start.v2,receipt.v2",
      validators: "fixture.v1.args->fixture.v1.result",
      events: "none",
      options: "independent",
      dependencyManifest: dependencyChecksum,
      interpreter: sha256(interpreter),
      releaseChecksum: "pending",
    },
    releaseContent: {
      workflowId: "workflow.fixture",
      version: 1,
      authorityChecksum,
      graphHash: sha256(graph),
      interpreter: {
        module: "src/interpreter.ts",
        checksum: sha256(interpreter),
      },
      sourceClosureChecksum: sourceClosure.checksum,
    },
    dependencies: [],
    artifacts: [
      { class: "graph", path: "src/graph.ts" },
      { class: "dependency", path: "src/dep.ts" },
      { class: "interpreter", path: "src/interpreter.ts" },
      { class: "registry", path: releasePath },
    ],
    sourceClosure,
  });
  writeDescriptor(root, descriptor);
  return { root, descriptor };
};

const rewritten = (
  descriptor: ReleaseDescriptor,
  fields: Readonly<Record<string, string>>,
  sourceClosure = descriptor.sourceClosure,
): ReleaseDescriptor =>
  withReleaseChecksum({
    ...descriptor,
    fingerprint: { ...descriptor.fingerprint, ...fields },
    sourceClosure,
  });

describe("workflow release filesystem authority", () => {
  it("publishes through the customer lifecycle dispatcher", () => {
    const { root } = fixture();
    try {
      const result = runCustomerGeneratorCli(
        ["publish-workflow", "--name", "fixture", "--version", "1"],
        root,
      );
      expect(result).toMatchObject({ exitCode: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toMatchObject({
        entry: { lifecycle: "published" },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes only when the declared closure matches resolved bytes", () => {
    const { root } = fixture();
    try {
      expect(
        publishRelease({
          cwd: root,
          kind: "workflow",
          name: "fixture",
          version: "1",
        }).entry.lifecycle,
      ).toBe("published");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects changed source even when caller hashes are recomputed", () => {
    const { root, descriptor } = fixture();
    try {
      const forgedGraph =
        'import { value } from "./dep";\nexport const graph = value + " forged";\n';
      write(root, "src/graph.ts", forgedGraph);
      writeDescriptor(
        root,
        rewritten(descriptor, { graphHash: sha256(forgedGraph) }),
      );
      expect(() =>
        publishRelease({
          cwd: root,
          kind: "workflow",
          name: "fixture",
          version: "1",
        }),
      ).toThrow(/complete resolved repository bytes/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to bump a published release with repository-byte drift", () => {
    const { root, descriptor } = fixture();
    try {
      writeDescriptor(root, { ...descriptor, lifecycle: "published" });
      write(root, "src/graph.ts", "export const graph = 'forged';\n");
      expect(() =>
        bumpRelease({
          cwd: root,
          kind: "workflow",
          name: "fixture",
          from: "1",
          to: "2",
          write: false,
        }),
      ).toThrow(/complete resolved repository bytes/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a declared closure that omits a transitive import", () => {
    const { root, descriptor } = fixture();
    try {
      const graphChecksum = sha256(
        readFileSync(join(root, "src/graph.ts"), "utf8"),
      );
      const interpreter = descriptor.sourceClosure.modules.find(
        ({ path }) => path === "src/interpreter.ts",
      );
      if (!interpreter) throw new Error("missing interpreter fixture");
      const unsigned = {
        roots: descriptor.sourceClosure.roots,
        modules: [
          { path: "src/graph.ts", checksum: graphChecksum },
          interpreter,
        ],
      };
      const omitted: SourceClosure = {
        ...unsigned,
        checksum: sha256(JSON.stringify(canonicalize(unsigned))),
      };
      writeDescriptor(
        root,
        rewritten(descriptor, { sourceClosure: omitted.checksum }, omitted),
      );
      expect(() =>
        publishRelease({
          cwd: root,
          kind: "workflow",
          name: "fixture",
          version: "1",
        }),
      ).toThrow(/complete resolved repository bytes/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects moved import targets and forged graph bytes", () => {
    const { root, descriptor } = fixture();
    try {
      renameSync(join(root, "src/dep.ts"), join(root, "src/alias.ts"));
      const forgedGraph =
        'import { value } from "./alias";\nexport const graph = value;\n';
      write(root, "src/graph.ts", forgedGraph);
      writeDescriptor(
        root,
        rewritten(descriptor, { graphHash: sha256(forgedGraph) }),
      );
      expect(() =>
        publishRelease({
          cwd: root,
          kind: "workflow",
          name: "fixture",
          version: "1",
        }),
      ).toThrow(/complete resolved repository bytes/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
