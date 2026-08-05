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
  "sha256:f95c663dec8d632ef9ece4ccf6b7a21c70a1fd3d036a8e15023965f4877f5507";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:bd09b6e635b53bf8b487233d9df2c31ff8defb9708567de8d4e4f85b9cf493bc";
const BASE_TAG = "maestro-template-v0.2.0-alpha.3";
const BASE_COMMIT = "9238ac4d90f54a23873ca0f5731d63705659b3e7";

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
