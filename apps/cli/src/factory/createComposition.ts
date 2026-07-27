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
  "sha256:1cebd2309f0f7b95b17165502e4d1aa64fe26bca6b91327a9ca682e268a5ae68";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:7126e3250bdcdc9a03883cd59fbdfb3fc45f41f4ba576910a71a26c6e4f0a05e";
const BASE_TAG = "maestro-template-v0.2.0-alpha.1";
const BASE_COMMIT = "20ea56a983b25f37505e7f1681499e5fc005e8bb";
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
