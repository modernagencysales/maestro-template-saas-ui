import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { createCustomerCurrentAdapter } from "@maestro-template/release-tooling/customer-create";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.1/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:370937c4e7f81b4f45cb3b9b54f9ef37ddad7d5a9b214d11e6d48df8b381e55c";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:e7d67b7ffad4ef220f7c1b8a03558084bfa1fee6345e8a2dd78ec02612e72543";
const BASE_TAG = "maestro-template-v0.2.0-alpha.1";
const BASE_COMMIT = "edb8590a8c04b9ade49879a66f4ae88cab083051";
const REVIEWED_BLUEPRINT_ID = "saas-application";
const REVIEWED_BLUEPRINT_PROVENANCE =
  "@maestro-template/generators/saas-application@1";

export function createCustomerCreateComposition() {
  const current = createCustomerCurrentAdapter({
    repositoryRoot: TRUSTED_REPOSITORY_ROOT,
    manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, BASE_MANIFEST_PATH),
    ownershipManifestChecksum: BASE_MANIFEST_CHECKSUM,
    tag: BASE_TAG,
    sourceCommit: BASE_COMMIT,
    blueprintManifestPath: resolve(
      TRUSTED_REPOSITORY_ROOT,
      "releases/v0.2.0-alpha.1/blueprints/saas-application.json",
    ),
    blueprintManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
    homeRoot: homedir(),
    blueprintId: REVIEWED_BLUEPRINT_ID,
    blueprintProvenance: REVIEWED_BLUEPRINT_PROVENANCE,
  });
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) =>
      buildSaasApplicationTargetPlan({ name, firstOutcome: outcome }),
    release: {
      prepare: (request) =>
        current.prepare({
          ...request,
          repo: { ...request.repo, sourceRoot: TRUSTED_REPOSITORY_ROOT },
        }),
      materialize: current.materialize,
    },
  });
  return createCreateCliHandler(command);
}
