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
  "sha256:47800da5823bb748f30b29eebbcc3d264058acb98d0325f6bda31ef4a80842a7";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:e13d6d51d00bba821a3640fbde26a80e81e4d6049b45f9d3812c9f5316e2ab95";
const BASE_TAG = "maestro-template-v0.2.0-alpha.1";
const BASE_COMMIT = "1e31e9d459cca77c79a6cbb85d2b5c59a00ad847";
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
