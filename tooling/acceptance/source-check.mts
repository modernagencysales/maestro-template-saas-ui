import { loadConfiguration, loadSources } from "@cucumber/cucumber/api";

export const formatSourceError = (error: {
  readonly uri: string;
  readonly location: { readonly line: number; readonly column?: number };
  readonly message: string;
}): string =>
  `${error.uri}:${error.location.line}:${error.location.column ?? 1}: ${error.message}`;

export async function assertValidSources(cwd: string): Promise<void> {
  const { runConfiguration } = await loadConfiguration(
    { file: "cucumber.cjs" },
    { cwd },
  );
  const loaded = await loadSources(runConfiguration.sources, { cwd });
  if (loaded.errors.length > 0)
    throw new Error(loaded.errors.map(formatSourceError).join("\n"));
}

async function main(): Promise<void> {
  try {
    await assertValidSources(process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("source-check.mts")) void main();
