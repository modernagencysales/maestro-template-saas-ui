import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import {
  buildSaasApplicationTargetPlan,
} from "@maestro-template/generators";
import {
  blueprintTargetPlanDigest,
  createCustomerReleaseAdapter,
} from "@maestro-template/release-tooling/customer-create";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.3/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:b7ced275540dfacf6e2712a9a5eb82cdb72d632824b2ca676d4e07878fc236bd";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:5e9d5238b62766a07001467bbdb4c189d127befebc245c847ba789f9acf6bf68";
const BASE_TAG = "maestro-template-v0.2.0-alpha.3";
const BASE_COMMIT = "c8b37f2e9b84d358d2d6a6fc0c2fc9104ecd0350";

export type CustomerCompositionSource = Readonly<{
  repositoryRoot: string;
  manifestPath: string;
  ownershipManifestChecksum: `sha256:${string}`;
  tag: string;
  sourceCommit: string;
  blueprintManifestPath: string;
  blueprintManifestChecksum: `sha256:${string}`;
  blueprintAuthorityManifestPath: string;
  blueprintAuthorityManifestChecksum: `sha256:${string}`;
}>;

export const CURRENT_PUBLIC_SOURCE = Object.freeze({
  repositoryRoot: TRUSTED_REPOSITORY_ROOT,
  manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, BASE_MANIFEST_PATH),
  ownershipManifestChecksum: BASE_MANIFEST_CHECKSUM,
  tag: BASE_TAG,
  sourceCommit: BASE_COMMIT,
  blueprintManifestPath: resolve(
    TRUSTED_REPOSITORY_ROOT,
    "releases/v0.2.0-alpha.3/blueprints/saas-application.json",
  ),
  blueprintManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
  blueprintAuthorityManifestPath: resolve(
    TRUSTED_REPOSITORY_ROOT,
    "releases/v0.2.0-alpha.3/blueprints/saas-application.json",
  ),
  blueprintAuthorityManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
}) satisfies CustomerCompositionSource;

export function createCustomerCreateComposition(
  source: CustomerCompositionSource = CURRENT_PUBLIC_SOURCE,
  buildBlueprintTargetPlan: (options: {
    readonly name: string;
    readonly firstOutcome?: string;
  }) => ReturnType<
    typeof buildSaasApplicationTargetPlan
  > = buildSaasApplicationTargetPlan,
) {
  const authority = JSON.parse(
    readFileSync(source.blueprintManifestPath, "utf8"),
  ) as { readonly entries: readonly { readonly path: string; readonly replaces?: "copy" | "generate" }[] };
  const replacements = new Map(
    authority.entries.map(({ path, replaces }) => [path, replaces] as const),
  );
  const release = createCustomerReleaseAdapter({
    ...source,
    homeRoot: homedir(),
  });
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) => {
      const plan = buildBlueprintTargetPlan({ name, firstOutcome: outcome });
      const entries = plan.entries.map((entry) => {
        const { replaces: _replaces, ...rest } = entry;
        const replaces = replacements.get(entry.path);
        return replaces === undefined ? rest : { ...rest, replaces };
      });
      const composed = {
        ...plan,
        entries,
      };
      return { ...composed, digest: blueprintTargetPlanDigest(composed) };
    },
    release: {
      prepare: (request) =>
        release.prepare({
          ...request,
          repo: { ...request.repo, sourceRoot: source.repositoryRoot },
        }),
      materialize: release.materialize,
    },
  });
  return createCreateCliHandler(command);
}
