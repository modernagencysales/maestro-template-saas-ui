import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
} from "../contracts.js";
import { createRepositoryContext } from "../repoContext.js";
import { createNodeSupportBundleExporter } from "./nodeSupportBundleExporter.js";
import {
  DEFAULT_SUPPORT_BUNDLE_PATH,
  SUPPORT_BUNDLE_PRODUCT_VERSION,
  SUPPORT_BUNDLE_PRODUCT_VERSIONS,
  SupportBundleContractError,
  createSupportBundlePreview,
  type SupportBundleSource,
} from "./supportBundle.js";
import { createSupportBundleCommand } from "./supportBundleCommand.js";

const temporaryRoots: string[] = [];
const secretCanary = "customer-secret-canary-abc123";

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "maestro-support-bundle-"));
  temporaryRoots.push(value);
  return value;
}

function source(
  overrides: Partial<SupportBundleSource> = {},
): SupportBundleSource {
  return {
    host: { kind: "codex" },
    providers: [
      { kind: "model", posture: "external-user-selected" },
      { kind: "convex", posture: "not-configured" },
    ],
    ...overrides,
  };
}

afterEach(() => {
  for (const path of temporaryRoots.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe("support bundle privacy contract", () => {
  it("publishes a closed public schema without unverifiable receipt facts", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "support-bundle.schema.json"),
        "utf8",
      ),
    ) as {
      additionalProperties: boolean;
      required: readonly string[];
      properties: Record<string, { additionalProperties?: boolean }>;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      "schemaVersion",
      "bundleId",
      "versions",
      "posture",
      "handling",
    ]);
    expect(schema.properties).not.toHaveProperty("receipts");
    expect(schema.properties.versions?.additionalProperties).toBe(false);
    expect(schema.properties.posture?.additionalProperties).toBe(false);
    expect(schema.properties.handling?.additionalProperties).toBe(false);
  });

  it("loads immutable product versions that drift-check the release manifest", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../../releases/v0.2.0-alpha.1/manifest.json",
        ),
        "utf8",
      ),
    ) as { readonly release: { readonly version: string } };

    expect(SUPPORT_BUNDLE_PRODUCT_VERSION).toBe(manifest.release.version);
    expect(SUPPORT_BUNDLE_PRODUCT_VERSIONS).toEqual({
      agentPack: manifest.release.version,
      cli: manifest.release.version,
      template: manifest.release.version,
      node: process.versions.node,
    });
    expect(Object.isFrozen(SUPPORT_BUNDLE_PRODUCT_VERSIONS)).toBe(true);
  });

  it("is deterministic and allowlisted by construction", () => {
    const first = createSupportBundlePreview(source());
    const second = createSupportBundlePreview(
      source({ providers: [...source().providers].reverse() }),
    );

    expect(second).toEqual(first);
    expect(first.bundle).toMatchObject({
      schemaVersion: 1,
      versions: SUPPORT_BUNDLE_PRODUCT_VERSIONS,
      posture: {
        host: "codex",
        providers: [
          { kind: "convex", posture: "not-configured" },
          { kind: "model", posture: "external-user-selected" },
        ],
      },
      handling: {
        automaticUpload: false,
        containsCustomerData: false,
        containsEnvironmentValues: false,
        containsSecrets: false,
      },
    });
    expect(first.bundle).not.toHaveProperty("receipts");
    expect(first.serialized).not.toContain("receipt");
  });

  it("rejects unknown fields, traversal, and oversized source facts", () => {
    expect(() =>
      createSupportBundlePreview({
        ...source(),
        arbitraryFiles: ["/tmp/x"],
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
    expect(() =>
      createSupportBundlePreview({
        ...source(),
        host: { kind: "codex", sessionToken: secretCanary },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
    expect(() =>
      createSupportBundlePreview(source(), { output: "../bundle.json" }),
    ).toThrow(SupportBundleContractError);
    expect(() =>
      createSupportBundlePreview({
        ...source(),
        ignored: "x".repeat(300_000),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_SOURCE_TOO_LARGE" }),
    );
  });

  it.each([
    ["versions", { agentPack: `0.2.0+${secretCanary}` }],
    ["diagnostics", [{ code: secretCanary }]],
    ["receipts", [{ id: `support_receipt_sha256:${"0".repeat(64)}` }]],
    ["producer", `fabricated-${secretCanary}`],
    ["command", `fabricated-${secretCanary}`],
    ["commandVersion", `0.2.0+${secretCanary}`],
  ])("rejects caller-provided %s facts", (field, value) => {
    expect(() =>
      createSupportBundlePreview({ ...source(), [field]: value }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
  });

  it("rejects runtime-cast registry and brand bypasses", () => {
    const callerRegistry = {
      codes: new Set([secretCanary]),
      brand: "trusted-support-diagnostic-registry",
    };
    const castSource = {
      ...source(),
      registry: callerRegistry,
      diagnostics: [{ code: secretCanary }],
    } as unknown as SupportBundleSource;

    expect(() => createSupportBundlePreview(castSource)).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
    expect(() =>
      createSupportBundlePreview(source(), {
        output: DEFAULT_SUPPORT_BUNDLE_PATH,
        registry: callerRegistry,
        versions: { agentPack: `0.2.0+${secretCanary}` },
      } as unknown as { readonly output?: string }),
    ).toThrowError(
      expect.objectContaining({ code: "SUPPORT_BUNDLE_UNKNOWN_FIELD" }),
    );
  });

  it("previews by default and requires the exact preview before export", async () => {
    const targetRoot = root();
    const exporter = { export: vi.fn(async () => ({ bytes: 1_024 })) };
    const command = createSupportBundleCommand({
      load: vi.fn(async () => source()),
      exporter,
    });
    const context = {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "library" as const,
      repo: createRepositoryContext({ cwd: targetRoot }),
    };

    const preview = await executeAgentPackCommand(command, {}, context);
    expect(preview).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: {
        output: DEFAULT_SUPPORT_BUNDLE_PATH,
        write: false,
        exclusions: expect.arrayContaining([
          "secret-values",
          "environment-values",
          "auth-and-session-state",
          "source-prompts-and-customer-data",
          "logs-and-arbitrary-files",
        ]),
      },
    });
    expect(exporter.export).not.toHaveBeenCalled();

    const missingPreview = await executeAgentPackCommand(
      command,
      { write: true },
      context,
    );
    expect(missingPreview.exitClass).toBe("invalidInvocation");
    expect(exporter.export).not.toHaveBeenCalled();

    if (preview.data === null)
      throw new Error("Expected support preview data.");
    const exported = await executeAgentPackCommand(
      command,
      {
        write: true,
        previewFingerprint: preview.data.previewFingerprint,
      },
      context,
    );
    expect(exported).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { write: true, exportedBytes: 1_024 },
    });
    expect(exporter.export).toHaveBeenCalledOnce();
  });

  it("writes one private local file and refuses symlinked support paths", async () => {
    const targetRoot = root();
    const context = createRepositoryContext({ cwd: targetRoot });
    const preview = createSupportBundlePreview(source());
    const exporter = createNodeSupportBundleExporter({ maxBytes: 128 * 1024 });

    const result = await exporter.export({
      repo: context,
      output: preview.output,
      serialized: preview.serialized,
    });
    const destination = join(targetRoot, preview.output);
    expect(result.bytes).toBe(Buffer.byteLength(preview.serialized));
    expect(readFileSync(destination, "utf8")).toBe(preview.serialized);
    expect(lstatSync(destination).mode & 0o777).toBe(0o600);
    await expect(
      exporter.export({
        repo: context,
        output: preview.output,
        serialized: preview.serialized,
      }),
    ).rejects.toThrow("already exists");

    const symlinkRoot = root();
    const outside = root();
    mkdirSync(join(symlinkRoot, ".maestro"));
    symlinkSync(outside, join(symlinkRoot, ".maestro", "support"));
    await expect(
      exporter.export({
        repo: createRepositoryContext({ cwd: symlinkRoot }),
        output: preview.output,
        serialized: preview.serialized,
      }),
    ).rejects.toThrow("changed during export");
    expect(existsSync(join(outside, "support-bundle.json"))).toBe(false);
  });

  it("refuses an ancestor swap before creating support or output", async () => {
    const targetRoot = root();
    const outside = root();
    const movedMaestro = join(targetRoot, ".maestro-opened");
    const preview = createSupportBundlePreview(source());
    const exporter = createNodeSupportBundleExporter({
      maxBytes: 128 * 1024,
      afterMaestroOpen: (maestroDirectory) => {
        renameSync(maestroDirectory, movedMaestro);
        symlinkSync(outside, maestroDirectory);
      },
    });

    await expect(
      exporter.export({
        repo: createRepositoryContext({ cwd: targetRoot }),
        output: preview.output,
        serialized: preview.serialized,
      }),
    ).rejects.toThrow("changed during export");
    expect(existsSync(join(outside, "support"))).toBe(false);
    expect(existsSync(join(movedMaestro, "support"))).toBe(false);
  });

  it("refuses a support-directory swap without writing outside", async () => {
    const targetRoot = root();
    const outside = root();
    const movedSupport = join(targetRoot, ".maestro", "support-opened");
    const preview = createSupportBundlePreview(source());
    const exporter = createNodeSupportBundleExporter({
      maxBytes: 128 * 1024,
      afterDirectoryOpen: (supportDirectory) => {
        renameSync(supportDirectory, movedSupport);
        symlinkSync(outside, supportDirectory);
      },
    });

    await expect(
      exporter.export({
        repo: createRepositoryContext({ cwd: targetRoot }),
        output: preview.output,
        serialized: preview.serialized,
      }),
    ).rejects.toThrow("changed during export");
    expect(existsSync(join(outside, "support-bundle.json"))).toBe(false);
    expect(existsSync(join(movedSupport, "support-bundle.json"))).toBe(false);
  });

  it("fails closed on non-Linux hosts before creating a directory", async () => {
    const targetRoot = root();
    const preview = createSupportBundlePreview(source());
    const exporter = createNodeSupportBundleExporter({ maxBytes: 128 * 1024 });
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
    if (descriptor === undefined)
      throw new Error("Expected the Node platform descriptor.");

    Object.defineProperty(process, "platform", {
      ...descriptor,
      value: "darwin",
    });
    try {
      await expect(
        exporter.export({
          repo: createRepositoryContext({ cwd: targetRoot }),
          output: preview.output,
          serialized: preview.serialized,
        }),
      ).rejects.toThrow("unavailable on this host");
      expect(existsSync(join(targetRoot, ".maestro"))).toBe(false);
    } finally {
      Object.defineProperty(process, "platform", descriptor);
    }
  });
});
