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
  "sha256:e0f4bc649b0aef4ffc6c59bd53e50204963e395116b7165dc4a1de3bf258be11";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:5b5b40f73b7373907590090872beab7f2143c70f1654463982b0dfe8918324d3";
const HARDENED_BLUEPRINT_CHECKSUM =
  "sha256:ae4ccdff95ce38e65e536072de8108312374b2856173439980433dc20b09db14";
const BASE_TAG = "maestro-template-v0.2.0-alpha.2";
const BASE_COMMIT = "3aefd456354b344b9595bddc44fc0782240e2b7d";

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
    blueprintAuthorityManifestPath: resolve(
      TRUSTED_REPOSITORY_ROOT,
      "releases/v0.2.0-alpha.2/hardening/saas-application.json",
    ),
    blueprintAuthorityManifestChecksum: HARDENED_BLUEPRINT_CHECKSUM,
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
