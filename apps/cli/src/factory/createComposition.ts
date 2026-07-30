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
  "sha256:dc00f1dc686c766a472c92d4881cdde4b6b6f47bc6d489f3df2574a741954579";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:cab3a26837313a0e5d1fd0befbd70e35c0bf994576b961853bbf60d876a0553c";
const BASE_TAG = "maestro-template-v0.2.0-alpha.1";
const BASE_COMMIT = "de1bac52bbd33745d2a0fecf8e1cb6ec5732310d";
const REVIEWED_BLUEPRINT_ID = "saas-application";
const REVIEWED_BLUEPRINT_PROVENANCE =
  "@maestro-template/generators/saas-application@1";
const CURRENT_FACTORY_ONLY_OMISSIONS = [
  "tooling/generators/src/blueprints/saasApplicationFactory.ts",
  "tooling/generators/src/blueprints/saasRegistrationProjections.ts",
  "tooling/generators/src/cli.ts",
  "tooling/generators/src/customer-closure.test.ts",
  "tooling/generators/src/upgrade-wiring.test.ts",
  "tooling/generators/src/workflow-files.test.ts",
] as const;

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
    currentOmissions: CURRENT_FACTORY_ONLY_OMISSIONS,
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
