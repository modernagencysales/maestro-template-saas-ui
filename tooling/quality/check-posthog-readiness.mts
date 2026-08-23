import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { runStaticCheck, type StaticCheckDescriptor } from "./src/gate.mts";

export const descriptor = descriptorFor("posthog-readiness");

const factoryOnlyRequirementFiles = new Set([
  "tooling/generators/src/index.ts",
  "tooling/generators/src/index.test.ts",
  "docs/template/effectification-status.md",
]);

type GeneratedCustomerMarker = {
  readonly schemaVersion?: unknown;
  readonly release?: {
    readonly version?: unknown;
    readonly tag?: unknown;
    readonly sourceCommit?: unknown;
  };
  readonly blueprint?: {
    readonly id?: unknown;
    readonly provenance?: unknown;
  };
};

async function isGeneratedCustomerRepository(
  repoRoot: string,
): Promise<boolean> {
  try {
    const marker = JSON.parse(
      await readFile(join(repoRoot, "template-instance.json"), "utf8"),
    ) as GeneratedCustomerMarker;

    return (
      (marker.schemaVersion === 1 || marker.schemaVersion === 2) &&
      typeof marker.release?.version === "string" &&
      typeof marker.release.tag === "string" &&
      typeof marker.release.sourceCommit === "string" &&
      typeof marker.blueprint?.id === "string" &&
      typeof marker.blueprint.provenance === "string"
    );
  } catch {
    return false;
  }
}

export async function descriptorForRepository(
  repoRoot: string,
): Promise<StaticCheckDescriptor> {
  if (!(await isGeneratedCustomerRepository(repoRoot))) return descriptor;

  return {
    ...descriptor,
    requirements: descriptor.requirements.filter(
      ({ file }) => !factoryOnlyRequirementFiles.has(file),
    ),
  };
}

if (isDirectRun(import.meta.url)) {
  const repoRoot = process.cwd();
  await runStaticCheck(await descriptorForRepository(repoRoot), repoRoot);
}
