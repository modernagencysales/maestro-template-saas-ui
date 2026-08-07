import { loadConfiguration, loadSources } from "@cucumber/cucumber/api";
import { formatSourceError } from "./source-check.mts";

export async function assertRequiredSelection(cwd: string): Promise<void> {
  const { runConfiguration } = await loadConfiguration(
    { file: "cucumber.cjs", provided: ["--tags", "@required"] },
    { cwd },
  );
  const loaded = await loadSources(runConfiguration.sources, { cwd });
  if (loaded.errors.length > 0)
    throw new Error(loaded.errors.map(formatSourceError).join("\n"));
  if (loaded.plan.length === 0)
    throw new Error(
      "@required must select at least one Cucumber Scenario before delivery.",
    );
}

async function main(): Promise<void> {
  try {
    await assertRequiredSelection(process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("required-selection.mts")) void main();
