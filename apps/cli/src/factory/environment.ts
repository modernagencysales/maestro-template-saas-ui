import {
  createConfigurationBinding,
  type RepositoryContext,
} from "@maestro-template/agent-pack";
import { arch, platform } from "node:os";

export type CompositionEnvironmentReader = () => Readonly<
  Record<string, string | undefined>
>;

export function projectCompositionEnvironment(
  repo: RepositoryContext,
  readEnvironment: CompositionEnvironmentReader,
) {
  const environment = readEnvironment();
  return environmentProjection(repo, environment);
}

export function projectCompositionEnvironmentFingerprintMaterial(
  repo: RepositoryContext,
  readEnvironment: CompositionEnvironmentReader,
) {
  const environment = readEnvironment();
  const projection = environmentProjection(repo, environment);
  const availableEnvironmentNames = projection.availableEnvironmentNames
    .split(",")
    .filter(Boolean);
  return {
    ...projection,
    configurationBinding: createConfigurationBinding("environment", {
      sourceRoot: repo.sourceRoot,
      targetRoot: repo.targetRoot,
      configured: Object.fromEntries(
        availableEnvironmentNames.map((name) => [name, environment[name]]),
      ),
    }),
  };
}

function environmentProjection(
  repo: RepositoryContext,
  environment: Readonly<Record<string, string | undefined>>,
) {
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
    ci: environment.CI === "true",
    availableEnvironmentNames: availableEnvironmentNames.join(","),
  };
}

type ProviderConfiguration = "fake" | "configured" | "console" | "local";
type ProviderPosture = "sample" | "local" | "test" | "live" | "missing";

export function projectCompositionProviderPosture<
  const Providers extends Readonly<Record<string, ProviderConfiguration>>,
>(input: {
  readonly repo: RepositoryContext;
  readonly instance: {
    readonly providerMode: "fake" | "test" | "live";
    readonly providers: Providers;
  };
  readonly readEnvironment: CompositionEnvironmentReader;
  readonly requiredEnvironmentNames: (
    provider: keyof Providers & string,
    options: { readonly repoRoot: string },
  ) => readonly string[];
}) {
  return projectProviderFingerprintMaterial(input).postures;
}

export function projectCompositionProviderFingerprintMaterial<
  const Providers extends Readonly<Record<string, ProviderConfiguration>>,
>(input: {
  readonly repo: RepositoryContext;
  readonly instance: {
    readonly providerMode: "fake" | "test" | "live";
    readonly providers: Providers;
  };
  readonly readEnvironment: CompositionEnvironmentReader;
  readonly requiredEnvironmentNames: (
    provider: keyof Providers & string,
    options: { readonly repoRoot: string },
  ) => readonly string[];
}) {
  return projectProviderFingerprintMaterial(input);
}

function projectProviderFingerprintMaterial<
  const Providers extends Readonly<Record<string, ProviderConfiguration>>,
>(input: {
  readonly repo: RepositoryContext;
  readonly instance: {
    readonly providerMode: "fake" | "test" | "live";
    readonly providers: Providers;
  };
  readonly readEnvironment: CompositionEnvironmentReader;
  readonly requiredEnvironmentNames: (
    provider: keyof Providers & string,
    options: { readonly repoRoot: string },
  ) => readonly string[];
}) {
  const environment = input.readEnvironment();
  const availableNames = new Set(
    Object.entries(environment)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([name]) => name),
  );
  const postures: Readonly<Record<string, ProviderPosture>> =
    Object.fromEntries(
      Object.entries(input.instance.providers).map(([id, configuration]) => {
        if (configuration === "fake") return [id, "sample"];
        if (configuration === "console" || configuration === "local") {
          return [id, "local"];
        }
        const requiredNames = input.requiredEnvironmentNames(
          id as keyof Providers & string,
          {
            repoRoot: input.repo.sourceRoot,
          },
        );
        if (!requiredNames.every((name) => availableNames.has(name))) {
          return [id, "missing"];
        }
        return [
          id,
          input.instance.providerMode === "live"
            ? "live"
            : input.instance.providerMode === "test"
              ? "test"
              : "local",
        ];
      }),
    );
  const relevantNames = [
    ...new Set(
      Object.keys(input.instance.providers).flatMap((provider) =>
        input.requiredEnvironmentNames(provider as keyof Providers & string, {
          repoRoot: input.repo.sourceRoot,
        }),
      ),
    ),
  ].sort();
  return {
    postures,
    configurationBinding: createConfigurationBinding("providers", {
      sourceRoot: input.repo.sourceRoot,
      targetRoot: input.repo.targetRoot,
      providerMode: input.instance.providerMode,
      providers: input.instance.providers,
      configured: Object.fromEntries(
        relevantNames
          .filter((name) => {
            const value = environment[name];
            return typeof value === "string" && value.trim() !== "";
          })
          .map((name) => [name, environment[name]]),
      ),
    }),
  };
}
