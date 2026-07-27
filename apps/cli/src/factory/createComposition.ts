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
  "sha256:525e794fc87321b238c7932f3dc08b2b5ce15f58eb830d6e97f92f7b71c43020";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:c219057621bad35ea4a37699db06704a6961524deeefbec58486983e8ca24cf0";
const BASE_TAG = "maestro-template-v0.2.0-alpha.1";
const BASE_COMMIT = "5b7fa67e45d5aa81faa13f19bb2f8c092347686d";
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
