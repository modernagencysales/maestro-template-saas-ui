import {
  createCheckCommand,
  createComposedPreflightProbe,
  createExecFileVerificationRunner,
  createNodeExecFileAdapter,
  createNodePreflightRuntimeReader,
  createPreflightCommand,
  createVerifyCommand,
  defineDiagnosticRegistryProjection,
  nodePreflightFileSystem,
  type NodePreflightPolicy,
  type RepositoryContext,
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
import { arch, platform } from "node:os";
import { resolve } from "node:path";
import { createPreflightCliHandler } from "./preflight";
import { createVerifyCliHandler } from "./verify";
import type { FactoryCliHandler } from "./router";

export const FACTORY_EXECUTION_POLICY = Object.freeze({
  supportedPlatforms: ["linux", "darwin", "win32"],
  supportedNodeMajors: [22],
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
    if (!stats.isFile() || stats.size > options.maxBytes) {
      throw new Error("File exceeds the bounded verification read limit.");
    }
    const buffer = Buffer.alloc(options.maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, options.maxBytes + 1, 0);
    if (bytesRead > options.maxBytes) {
      throw new Error("File exceeds the bounded verification read limit.");
    }
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
const publishedWorkflowRuleIds = WORKFLOW_SEMANTICS.map(({ id }) => id);
const descriptors = defineQualityDiagnosticRegistryProjection(
  defineDiagnosticRegistryProjection,
);

export type CompositionEnvironmentReader = () => Readonly<
  Record<string, string | undefined>
>;

export function projectCompositionEnvironment(
  repo: RepositoryContext,
  readEnvironment: CompositionEnvironmentReader,
) {
  const environment = readEnvironment();
  const availableEnvironmentNames = Object.entries(environment)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([name]) => name)
    .sort();
  return {
    sourceRoot: repo.sourceRoot,
    targetRoot: repo.targetRoot,
    platform: platform(),
    architecture: arch(),
    node: process.version,
    ci: environment.CI === "true" || environment.BUILDKITE === "true",
    availableEnvironmentNames: availableEnvironmentNames.join(","),
  };
}

export function createFactoryCliComposition(
  readEnvironment: CompositionEnvironmentReader,
) {
  const preflight = createPreflightCommand(
    createComposedPreflightProbe({
      runtime: createNodePreflightRuntimeReader({
        fs: nodePreflightFileSystem,
        execFile,
        policy: FACTORY_EXECUTION_POLICY,
        workflowRules,
        publishedWorkflowRuleIds,
        environment: readEnvironment,
      }),
      readers: {
        parseTemplateInstance,
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

  const verificationRunner = createExecFileVerificationRunner({
    execFile,
    readFile: readBoundedFile,
    now: () => new Date().toISOString(),
    environment: async (repo) =>
      projectCompositionEnvironment(repo, readEnvironment),
    providerPosture: async (repo) => {
      const instance = parseTemplateInstance(
        await readBoundedFile(
          resolve(repo.targetRoot, "template-instance.json"),
          {
            maxBytes: FACTORY_EXECUTION_POLICY.packageJsonMaxBytes,
          },
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
    limits: FACTORY_EXECUTION_POLICY,
  });

  const verify = createVerifyCommand({
    descriptors,
    runner: verificationRunner,
  });
  const check = createCheckCommand({ preflight, verify });
  const handlers: readonly FactoryCliHandler[] = [
    createPreflightCliHandler(preflight),
    createVerifyCliHandler(verify),
    createVerifyCliHandler(check),
  ];

  return Object.freeze({
    handlers,
    diagnosticCount: descriptors.length,
    workflowRuleCount: workflowRules.length,
  });
}
