import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import { createCustomerReleaseAdapter } from "@maestro-template/release-tooling/customer-create";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const REVIEWED_MANIFEST_PATH = "releases/v0.1.0-alpha.1/manifest.json";
const REVIEWED_MANIFEST_CHECKSUM =
  "sha256:0b55fd0895ecbcf6743860551ed52f165b4252c17ea94ad1687163a8ce6c6b93";
const REVIEWED_TAG = "maestro-template-v0.1.0-alpha.1";

export function createCustomerCreateComposition() {
  const release = createCustomerReleaseAdapter({
    repositoryRoot: TRUSTED_REPOSITORY_ROOT,
    manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, REVIEWED_MANIFEST_PATH),
    ownershipManifestChecksum: REVIEWED_MANIFEST_CHECKSUM,
    tag: REVIEWED_TAG,
    homeRoot: homedir(),
  });
  const command = createCustomerCreateCommand({
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
