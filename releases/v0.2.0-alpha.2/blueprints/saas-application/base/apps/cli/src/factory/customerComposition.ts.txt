import {
  createCheckCommand,
  createComposedPreflightProbe,
  createExecFileVerificationRunner,
  createNodeBuildReadinessSurface,
  createNodeExecFileAdapter,
  createNodePreflightRuntimeReader,
  createNodeSupportBundleExporter,
  createPreflightCommand,
  createSupportBundleCommand,
  createVerifyCommand,
  defineDiagnosticRegistryProjection,
  nodePreflightFileSystem,
  type NodePreflightPolicy,
} from "@maestro-template/agent-pack";
import {
  buildBlueprintCatalog,
  buildTemplateInstance,
  doctorTemplateInstance,
  parseTemplateInstance,
  readDataResourceCatalog,
  readProductTopology,
  readSystemCatalog,
  requiredEnvNamesForProvider,
} from "@maestro-template/generators";
import { defineQualityDiagnosticRegistryProjection } from "@maestro-template/quality-tooling";
import { WORKFLOW_SEMANTICS } from "@maestro-template/template-core/workflow-semantics";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import {
  projectCompositionEnvironment,
  type CompositionEnvironmentReader,
} from "./environment";
import { createPreflightCliHandler } from "./preflight";
import { createCustomerRecipeCliHandlers } from "./customerRecipes";
import {
  createComposedStartCommand,
  createStartCliHandler,
  createStartOutputBoundary,
  parseStartTargetInstance,
} from "./start";
import { createSupportBundleCliHandler } from "./supportBundle";
import { createVerifyCliHandler } from "./verify";
import type { FactoryCliHandler } from "./router";

const policy = Object.freeze({
  supportedPlatforms: ["linux", "darwin", "win32"],
  supportedNodeMajors: [22],
  // The customer lockfile is lockfileVersion 9 and is reproducibly installable
  // by this supported offline-compatible standalone fallback. packageManager
  // remains the canonical pnpm 10.12.1 authority.
  supportedPnpmVersions: ["9.15.4"],
  minimumGitVersion: "2.31.0",
  minimumDiskBytes: 512 * 1024 * 1024,
  requiredPorts: [],
  metadataTimeoutMs: 10_000,
  focusedTimeoutMs: 120_000,
  fullTimeoutMs: 30 * 60_000,
  maxBufferBytes: 1024 * 1024,
  packageJsonMaxBytes: 256 * 1024,
}) satisfies NodePreflightPolicy & {
  readonly focusedTimeoutMs: number;
  readonly fullTimeoutMs: number;
};

const execFile = createNodeExecFileAdapter();
const readBoundedFile = async (
  path: string,
  options: { readonly maxBytes: number },
): Promise<string> => {
  const handle = await open(path, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > options.maxBytes)
      throw new Error("File exceeds the bounded verification read limit.");
    const buffer = Buffer.alloc(options.maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, options.maxBytes + 1, 0);
    if (bytesRead > options.maxBytes)
      throw new Error("File exceeds the bounded verification read limit.");
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
};

const workflowRules = WORKFLOW_SEMANTICS.map(({ id, subject, status }) => ({
  id,
  subject,
  status,
}));
const descriptors = defineQualityDiagnosticRegistryProjection(
  defineDiagnosticRegistryProjection,
);

const parseCustomerInstance = (raw: string) =>
  parseStartTargetInstance(raw, parseTemplateInstance, (identity) => {
    const blueprint = buildBlueprintCatalog().find(
      ({ id }) => id === identity.blueprint,
    )?.id;
    if (blueprint === undefined)
      throw new Error("Customer blueprint is not reviewed.");
    return buildTemplateInstance({
      name: identity.name,
      blueprint,
      providerMode: "fake",
      generatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

export function createCustomerCliComposition(
  readEnvironment: CompositionEnvironmentReader,
  options: { readonly log?: (line: string) => void } = {},
) {
  const preflight = createPreflightCommand(
    createComposedPreflightProbe({
      runtime: createNodePreflightRuntimeReader({
        fs: nodePreflightFileSystem,
        execFile,
        policy,
        workflowRules,
        publishedWorkflowRuleIds: WORKFLOW_SEMANTICS.map(({ id }) => id),
        environment: readEnvironment,
      }),
      readers: {
        parseTemplateInstance: parseCustomerInstance,
        buildTemplateInstance,
        doctorTemplateInstance,
        readSystemCatalog,
        readDataResourceCatalog,
        readProductTopology,
        buildBlueprintCatalog,
        requiredEnvNamesForProvider,
      },
    }),
  );
  const output = createStartOutputBoundary(
    options.log ?? ((line) => process.stderr.write(`${line}\n`)),
  );
  const runner = createExecFileVerificationRunner({
    execFile,
    readFile: readBoundedFile,
    now: () => new Date().toISOString(),
    environment: async (repo) =>
      projectCompositionEnvironment(repo, readEnvironment),
    providerPosture: async (repo) => {
      const instance = parseCustomerInstance(
        await readBoundedFile(
          resolve(repo.targetRoot, "template-instance.json"),
          { maxBytes: policy.packageJsonMaxBytes },
        ),
      );
      return Object.fromEntries(
        Object.entries(instance.providers).map(([id, posture]) => [
          id,
          posture === "configured"
            ? "live"
            : posture === "fake"
              ? "sample"
              : "local",
        ]),
      );
    },
    limits: policy,
  });
  const start = createComposedStartCommand({
    preflight,
    readFile: readBoundedFile,
    maxBytes: policy.packageJsonMaxBytes,
    environment: readEnvironment,
    log: output.write,
    readinessSurface: createNodeBuildReadinessSurface({
      readFile: (path) =>
        readBoundedFile(path, { maxBytes: policy.packageJsonMaxBytes }),
      current: (repo) => runner.inspect(repo),
    }),
  });
  const verify = createVerifyCommand({
    descriptors,
    runner,
  });
  const check = createCheckCommand({ preflight, verify });
  const supportBundle = createSupportBundleCommand({
    load: async () => ({
      host: { kind: "unknown" as const },
      providers: [{ kind: "convex" as const, posture: "unknown" as const }],
    }),
    exporter: createNodeSupportBundleExporter({
      maxBytes: policy.packageJsonMaxBytes,
    }),
  });
  const recipeHandlers = createCustomerRecipeCliHandlers(preflight);
  const handlers: readonly FactoryCliHandler[] = [
    createStartCliHandler(start, output),
    ...recipeHandlers,
    createPreflightCliHandler(preflight),
    createVerifyCliHandler(verify),
    createVerifyCliHandler(check),
    createSupportBundleCliHandler(supportBundle),
  ];
  return Object.freeze({
    handlers,
    diagnosticCount: descriptors.length,
    workflowRuleCount: workflowRules.length,
  });
}
