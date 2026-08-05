import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import {
  buildSaasApplicationTargetPlan,
} from "@maestro-template/generators";
import {
  blueprintTargetPlanDigest,
  createCustomerReleaseAdapter,
} from "@maestro-template/release-tooling/customer-create";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.3/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:82cbe5e9b11bed19b0d238aed6c895104568d3209f337f4222f375cae6586613";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:d943f6c55201b31f128aad8c9d91c71b058a5b42f06c5b52a829e780b74b881b";
const BASE_TAG = "maestro-template-v0.2.0-alpha.3";
const BASE_COMMIT = "8fd828c143f3fb6bb270084d4e2a952fb60a61f7";

export type CustomerCompositionSource = Readonly<{
  repositoryRoot: string;
  manifestPath: string;
  ownershipManifestChecksum: `sha256:${string}`;
  tag: string;
  sourceCommit: string;
  blueprintManifestPath: string;
  blueprintManifestChecksum: `sha256:${string}`;
  blueprintAuthorityManifestPath: string;
  blueprintAuthorityManifestChecksum: `sha256:${string}`;
}>;

export const CURRENT_PUBLIC_SOURCE = Object.freeze({
  repositoryRoot: TRUSTED_REPOSITORY_ROOT,
  manifestPath: resolve(TRUSTED_REPOSITORY_ROOT, BASE_MANIFEST_PATH),
  ownershipManifestChecksum: BASE_MANIFEST_CHECKSUM,
  tag: BASE_TAG,
  sourceCommit: BASE_COMMIT,
  blueprintManifestPath: resolve(
    TRUSTED_REPOSITORY_ROOT,
    "releases/v0.2.0-alpha.3/blueprints/saas-application.json",
  ),
  blueprintManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
  blueprintAuthorityManifestPath: resolve(
    TRUSTED_REPOSITORY_ROOT,
    "releases/v0.2.0-alpha.3/blueprints/saas-application.json",
  ),
  blueprintAuthorityManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
}) satisfies CustomerCompositionSource;

export function createCustomerCreateComposition(
  source: CustomerCompositionSource = CURRENT_PUBLIC_SOURCE,
  buildBlueprintTargetPlan: (options: {
    readonly name: string;
    readonly firstOutcome?: string;
  }) => ReturnType<
    typeof buildSaasApplicationTargetPlan
  > = buildSaasApplicationTargetPlan,
) {
  const authority = JSON.parse(
    readFileSync(source.blueprintManifestPath, "utf8"),
  ) as { readonly entries: readonly { readonly path: string; readonly replaces?: "copy" | "generate" }[] };
  const replacements = new Map(
    authority.entries.map(({ path, replaces }) => [path, replaces] as const),
  );
  const release = createCustomerReleaseAdapter({
    ...source,
    homeRoot: homedir(),
  });
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) => {
      const plan = buildBlueprintTargetPlan({ name, firstOutcome: outcome });
      const entries = plan.entries.map((entry) => {
        const { replaces: _replaces, ...rest } = entry;
        const replaces = replacements.get(entry.path);
        return replaces === undefined ? rest : { ...rest, replaces };
      });
      const composed = {
        ...plan,
        entries,
      };
      return { ...composed, digest: blueprintTargetPlanDigest(composed) };
    },
    release: {
      prepare: (request) =>
        release.prepare({
          ...request,
          repo: { ...request.repo, sourceRoot: source.repositoryRoot },
        }),
      materialize: release.materialize,
    },
  });
  return createCreateCliHandler(command);
}
