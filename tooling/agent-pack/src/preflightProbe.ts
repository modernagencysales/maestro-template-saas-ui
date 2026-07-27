import { resolve } from "node:path";
import type {
  PreflightFacts,
  PreflightInput,
  PreflightProbe,
} from "./preflight.js";
import type { RepositoryContext } from "./repoContext.js";

type ProviderConfiguration = "fake" | "configured" | "console" | "local";

export type PreflightTemplateInstance = {
  readonly blueprint: string;
  readonly modules: readonly string[];
  readonly providerMode: PreflightInput["mode"];
  readonly providers: Readonly<Record<string, ProviderConfiguration>>;
};

export type CanonicalPreflightReaders<
  Instance extends PreflightTemplateInstance = PreflightTemplateInstance,
> = {
  readonly parseTemplateInstance: (raw: string) => Instance;
  readonly buildTemplateInstance: (options: {
    readonly providerMode: PreflightInput["mode"];
    readonly generatedAt: string;
  }) => Instance;
  readonly doctorTemplateInstance: (
    instance: Instance,
    options: {
      readonly mode: PreflightInput["mode"];
      readonly instancePath: string;
      readonly repoRoot: string;
    },
  ) => { readonly ok: boolean; readonly checks: readonly unknown[] };
  readonly readSystemCatalog: (repoRoot: string) => unknown;
  readonly readDataResourceCatalog: (repoRoot: string) => unknown;
  readonly readProductTopology: (repoRoot: string) => unknown;
  readonly buildBlueprintCatalog: () => readonly { readonly id: string }[];
  readonly requiredEnvNamesForProvider: (
    provider: keyof Instance["providers"] & string,
    options: { readonly repoRoot: string },
  ) => readonly string[];
};

export type PreflightRuntimeSnapshot = Pick<
  PreflightFacts,
  | "host"
  | "prerequisites"
  | "repository"
  | "network"
  | "auth"
  | "observationDiagnostics"
  | "versionsCompatible"
  | "versions"
  | "workflow"
> & {
  /** Names only. Environment values must never cross this boundary. */
  readonly availableEnvironmentNames: readonly string[];
  /** Aggregate-only binding. Never contains or hashes one value separately. */
  readonly environmentBinding: string;
  readonly templateInstanceText: string | undefined;
  readonly observedAt?: string;
};

/**
 * The one extraction seam for facts that have no reusable repository reader.
 * Implementations are read-only and may inspect files/process metadata, but
 * must not authenticate, contact production, or expose environment values.
 */
export type PreflightRuntimeReader = {
  readonly inspect: (
    input: PreflightInput,
    repo: RepositoryContext,
  ) => Promise<PreflightRuntimeSnapshot>;
};

export function createComposedPreflightProbe<
  Instance extends PreflightTemplateInstance,
>(input: {
  readonly runtime: PreflightRuntimeReader;
  readonly readers: CanonicalPreflightReaders<Instance>;
}): PreflightProbe {
  return {
    inspect: async (request, repo) => {
      const snapshot = await input.runtime.inspect(request, repo);
      const instancePath = resolve(repo.targetRoot, "template-instance.json");
      const instance = snapshot.templateInstanceText
        ? input.readers.parseTemplateInstance(snapshot.templateInstanceText)
        : input.readers.buildTemplateInstance({
            providerMode: request.mode,
            generatedAt: snapshot.observedAt ?? "1970-01-01T00:00:00.000Z",
          });

      const doctor = input.readers.doctorTemplateInstance(instance, {
        mode: request.mode,
        instancePath,
        repoRoot: repo.sourceRoot,
      });
      input.readers.readSystemCatalog(repo.templateRoot);
      input.readers.readDataResourceCatalog(repo.templateRoot);
      input.readers.readProductTopology(repo.templateRoot);
      const blueprints = input.readers.buildBlueprintCatalog();
      const knownBlueprint = blueprints.some(
        ({ id }) => id === instance.blueprint,
      );
      const availableEnvironmentNames = new Set(
        snapshot.availableEnvironmentNames,
      );

      return {
        fingerprintBinding: snapshot.environmentBinding,
        facts: {
          host: snapshot.host,
          prerequisites: snapshot.prerequisites,
          repository: snapshot.repository,
          network: snapshot.network,
          auth: snapshot.auth,
          ...(snapshot.observationDiagnostics === undefined
            ? {}
            : { observationDiagnostics: snapshot.observationDiagnostics }),
          versionsCompatible:
            snapshot.versionsCompatible && doctor.ok && knownBlueprint,
          versions: snapshot.versions,
          workflow: snapshot.workflow,
          app: {
            blueprint: instance.blueprint,
            modules: [...instance.modules],
            providerMode: request.mode,
            providers: providerPostures(
              instance,
              request.mode,
              repo.sourceRoot,
              availableEnvironmentNames,
              input.readers,
            ),
          },
          indexes: {
            systems: "docs/template/system-catalog.json",
            generators: "tooling/generators/src/index.ts",
            recipes: "docs/template/app-factory-guide.md",
            documentation: "docs/template/repo-map.md",
          },
          claimLevels: [
            "fake",
            "local",
            "dev",
            "preview",
            "staging",
            "production",
          ],
        },
      };
    },
  };
}

function providerPostures<Instance extends PreflightTemplateInstance>(
  instance: Instance,
  mode: PreflightInput["mode"],
  repoRoot: string,
  availableEnvironmentNames: ReadonlySet<string>,
  readers: CanonicalPreflightReaders<Instance>,
): PreflightFacts["app"]["providers"] {
  return Object.entries(instance.providers).map(([id, configured]) => {
    const requiredNames = readers.requiredEnvNamesForProvider(id, { repoRoot });
    const hasRequiredNames = requiredNames.every((name) =>
      availableEnvironmentNames.has(name),
    );
    const posture =
      configured === "configured" && hasRequiredNames
        ? mode === "live"
          ? "live"
          : mode === "test"
            ? "test"
            : "local"
        : mode === "fake" && configured !== "configured"
          ? configured === "fake"
            ? "sample"
            : "local"
          : "missing";
    return { id, posture };
  });
}
