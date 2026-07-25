import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { createCustomerReleaseAdapter } from "@maestro-template/release-tooling/customer-create";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const REVIEWED_MANIFEST_PATH = "releases/v0.2.0-alpha.1/manifest.json";
const REVIEWED_MANIFEST_CHECKSUM =
  "sha256:6c8c02385be18c84743dd26f933723c7e14330e93b5729842719f7741b505291";
const REVIEWED_BLUEPRINT_CHECKSUM =
  "sha256:64beb12d4d6ac775379c970ea7ccb893de3bf3ae8165360de53d3c8943fd1ac8";
const REVIEWED_TAG = "maestro-template-v0.2.0-alpha.1";
const REVIEWED_COMMIT = "10516dfc7470d9cfa68b250550576298f76042f4";

export function createCustomerCreateComposition() {
  const release = createCustomerReleaseAdapter({
    repositoryRoot: TRUSTED_REPOSITORY_ROOT,
    manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, REVIEWED_MANIFEST_PATH),
    ownershipManifestChecksum: REVIEWED_MANIFEST_CHECKSUM,
    tag: REVIEWED_TAG,
    sourceCommit: REVIEWED_COMMIT,
    blueprintManifestPath: resolve(
      TRUSTED_REPOSITORY_ROOT,
      "releases/v0.2.0-alpha.1/blueprints/saas-application.json",
    ),
    blueprintManifestChecksum: REVIEWED_BLUEPRINT_CHECKSUM,
    homeRoot: homedir(),
  });
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) =>
      buildSaasApplicationTargetPlan({ name, firstOutcome: outcome }),
    release: {
      prepare: (request) =>
        release.prepare({
          ...request,
          repo: { ...request.repo, sourceRoot: TRUSTED_REPOSITORY_ROOT },
        }),
      materialize: release.materialize,
    },
  });
  return createCreateCliHandler(command);
}
