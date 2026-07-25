import type { RepositoryContext } from "@maestro-template/agent-pack";
import { arch, platform } from "node:os";

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
