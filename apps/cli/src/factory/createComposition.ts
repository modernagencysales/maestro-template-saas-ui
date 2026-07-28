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
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.2/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:a2eebcd1b019b9cfbb0d6b8cdd8a65afe91be6450b6dcb5b754567ae52906fa5";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:5b3a25d1098228624b3897806d7b9a707659a5d044b711dc49a596dc439a1b6f";
const BASE_TAG = "maestro-template-v0.2.0-alpha.2";
const BASE_COMMIT = "b8e214166f1fe68319b4d714200d40173f8f6433";

export function createCustomerCreateComposition() {
  const release = createCustomerReleaseAdapter({
    repositoryRoot: TRUSTED_REPOSITORY_ROOT,
    manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, BASE_MANIFEST_PATH),
    ownershipManifestChecksum: BASE_MANIFEST_CHECKSUM,
    tag: BASE_TAG,
    sourceCommit: BASE_COMMIT,
    blueprintManifestPath: resolve(
      TRUSTED_REPOSITORY_ROOT,
      "releases/v0.2.0-alpha.2/blueprints/saas-application.json",
    ),
    blueprintManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
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
