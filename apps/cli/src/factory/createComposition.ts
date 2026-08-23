import { createCustomerCreateCommand } from "@maestro-template/agent-pack";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import {
  blueprintTargetPlanDigest,
  createCustomerReleaseAdapter,
  type ReleaseTemplateInstanceConsumer,
} from "@maestro-template/release-tooling/customer-create";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreateCliHandler } from "./create";

const TRUSTED_REPOSITORY_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
// Immutable release trust anchors: publishing a new sealed release updates these pins.
const BASE_MANIFEST_PATH = "releases/v0.2.0-alpha.7/manifest.json";
const BASE_MANIFEST_CHECKSUM =
  "sha256:609def9ca70272268eaea2ddd0ea31c51610ef6b1be8da8771d5fca1a1477948";
const BASE_BLUEPRINT_CHECKSUM =
  "sha256:f5cd355a3415f3ed33b28c58b7ca5dc39e5d2508b0dfbcf46d210b3bd9ee0266";
const BASE_TAG = "maestro-template-v0.2.0-alpha.7";
const BASE_COMMIT = "c5a371b39dde1d76070d2cc9b2b89254c7951ebb";

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
    "releases/v0.2.0-alpha.7/blueprints/saas-application.json",
  ),
  blueprintManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
  // Alpha.3 seals replacement directives in the blueprint manifest itself.
  blueprintAuthorityManifestPath: resolve(
    TRUSTED_REPOSITORY_ROOT,
    "releases/v0.2.0-alpha.7/blueprints/saas-application.json",
  ),
  blueprintAuthorityManifestChecksum: BASE_BLUEPRINT_CHECKSUM,
}) satisfies CustomerCompositionSource;

type BlueprintTargetPlanBuilder = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
  readonly patterns?: readonly ("records-example" | "workflow-automation")[];
  readonly sourceRoot?: string;
}) => BlueprintTargetPlan;

type BlueprintTargetPlan = Parameters<typeof blueprintTargetPlanDigest>[0];

type BlueprintReplacementAuthority = ReadonlyMap<
  string,
  "copy" | "generate" | undefined
>;

const buildCurrentPublicTargetPlan: BlueprintTargetPlanBuilder = (options) =>
  buildSaasApplicationTargetPlan({
    ...options,
    patterns: ["records-example"],
  });

function readBlueprintReplacementAuthority(
  source: CustomerCompositionSource,
): BlueprintReplacementAuthority {
  const authority = JSON.parse(
    readFileSync(source.blueprintAuthorityManifestPath, "utf8"),
  ) as {
    readonly entries: readonly {
      readonly path: string;
      readonly replaces?: "copy" | "generate";
    }[];
  };
  return new Map(
    authority.entries.map(({ path, replaces }) => [path, replaces] as const),
  );
}

function applyReplacementAuthority(
  plan: BlueprintTargetPlan,
  replacements: BlueprintReplacementAuthority,
): BlueprintTargetPlan {
  const entries = plan.entries.map((entry) => {
    const rest = { ...entry };
    delete rest.replaces;
    const replaces = replacements.get(entry.path);
    return replaces === undefined ? rest : { ...rest, replaces };
  });
  const composed = { ...plan, entries };
  return { ...composed, digest: blueprintTargetPlanDigest(composed) };
}

export function loadCustomerCreateComposition(
  source: CustomerCompositionSource = CURRENT_PUBLIC_SOURCE,
  buildBlueprintTargetPlan: BlueprintTargetPlanBuilder = buildCurrentPublicTargetPlan,
  templateInstances?: ReleaseTemplateInstanceConsumer,
) {
  return createCustomerCreateComposition(
    source,
    buildBlueprintTargetPlan,
    readBlueprintReplacementAuthority(source),
    templateInstances,
  );
}

export function createCustomerCreateComposition(
  source: CustomerCompositionSource,
  buildBlueprintTargetPlan: BlueprintTargetPlanBuilder,
  replacements: BlueprintReplacementAuthority,
  templateInstances?: ReleaseTemplateInstanceConsumer,
) {
  const release = createCustomerReleaseAdapter(
    {
      ...source,
      homeRoot: homedir(),
    },
    templateInstances,
  );
  const command = createCustomerCreateCommand({
    blueprintTargetPlan: ({ name, outcome }) => {
      const plan = buildBlueprintTargetPlan({
        name,
        firstOutcome: outcome,
        sourceRoot: source.repositoryRoot,
      });
      return applyReplacementAuthority(plan, replacements);
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
