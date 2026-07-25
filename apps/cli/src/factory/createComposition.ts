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
  "sha256:027ffeafea7603b6875c1449c5775afece7f9f50514c69bbdc0e944e1332b138";
const REVIEWED_BLUEPRINT_CHECKSUM =
  "sha256:1e292e9135059f670a4356793c69f325420eed109c82027d2b597733cf1cd816";
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
