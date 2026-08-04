import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import {
  buildSaasApplicationAlpha2TargetPlan,
  buildSaasApplicationTargetPlan,
} from "@maestro-template/generators";
import { createCustomerReleaseAdapter } from "@maestro-template/release-tooling/customer-create";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.3/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:91a50687d1fa0b6f78f19508ba6eed299bf27bd384583bed2ddcc3bebf48d7c8";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:368f936c65d9a85a8ae614b5f0a805b4a9607932be9f2f6754ad6836f9ac7ed6";
const HARDENED_BLUEPRINT_CHECKSUM =
  "sha256:52e8bb06ff821baf8980b67279e69089d028d19c55c365518d4410b5778849d9";
const BASE_TAG = "maestro-template-v0.2.0-alpha.3";
const BASE_COMMIT = "9dc721978cc5ffa09f0736941950fb01ba4b7f94";

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
    "releases/v0.2.0-alpha.3/hardening/saas-application.json",
  ),
  blueprintAuthorityManifestChecksum: HARDENED_BLUEPRINT_CHECKSUM,
}) satisfies CustomerCompositionSource;

export function createCustomerCreateComposition(
  source: CustomerCompositionSource = CURRENT_PUBLIC_SOURCE,
  buildBlueprintTargetPlan: (options: {
    readonly name: string;
    readonly firstOutcome?: string;
  }) => ReturnType<
    typeof buildSaasApplicationTargetPlan
  > = buildSaasApplicationAlpha2TargetPlan,
) {
  const release = createCustomerReleaseAdapter({
    ...source,
    homeRoot: homedir(),
  });
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) =>
      buildBlueprintTargetPlan({ name, firstOutcome: outcome }),
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
