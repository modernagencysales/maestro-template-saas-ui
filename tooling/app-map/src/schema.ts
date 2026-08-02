export const APP_MAP_GROUPS = [
  "Screens",
  "Data",
  "Automations",
  "Connections",
] as const;

export type AppMapGroup = (typeof APP_MAP_GROUPS)[number];

export const APP_MAP_NODE_KINDS = [
  "system",
  "resource",
  "table",
  "route",
  "capability",
  "workflow",
  "workflow-version",
  "semantic-rule",
  "agent",
  "provider",
  "package",
  "headless-operation",
] as const;

export type AppMapNodeKind = (typeof APP_MAP_NODE_KINDS)[number];

export const APP_MAP_EDGE_KINDS = [
  "owns",
  "persists",
  "invokes",
  "projects",
  "exposes",
  "depends-on",
  "generated-by",
  "governed-by",
  "verified-by",
] as const;

export type AppMapEdgeKind = (typeof APP_MAP_EDGE_KINDS)[number];

export const APP_MAP_SOURCE_KINDS = [
  "system-catalog",
  "product-topology",
  "data-resources",
  "confect-contracts",
  "workflow-registry",
  "workflow-semantics",
  "route-tree",
  "headless-registry",
  "workspace-metadata",
  "generator-provenance",
  "template-instance",
] as const;

export type AppMapSourceKind = (typeof APP_MAP_SOURCE_KINDS)[number];

export const APP_MAP_DIGEST_CONTRACTS = [
  "sha256-file-bytes-v1",
  "sha256-canonical-tree-v1",
] as const;

export type AppMapDigestContractV1 = (typeof APP_MAP_DIGEST_CONTRACTS)[number];

const SOURCE = <
  const AdapterId extends string,
  const SourceId extends AppMapSourceKind,
  const Path extends string,
  const Owner extends string,
>(
  adapterId: AdapterId,
  id: SourceId,
  path: Path,
  owner: Owner,
  allowedFacts: {
    readonly nodeKinds: readonly AppMapNodeKind[];
    readonly edgeKinds: readonly AppMapEdgeKind[];
    readonly ownershipTargets: readonly AppMapNodeKind[];
  },
  digestContract: AppMapDigestContractV1 = "sha256-file-bytes-v1",
) => ({
  required: true as const,
  adapter: { id: adapterId, version: 1 as const },
  source: {
    id,
    kind: id,
    path,
    subject: "repository" as const,
    owner,
    digestContract,
  },
  allowedFacts,
});

export const APP_MAP_INPUT_MANIFEST_V1 = {
  id: "maestro-app-map-input" as const,
  version: 1 as const,
  provenanceContract: "exact-batch-source-v1" as const,
  requiredSources: [
    SOURCE(
      "system-catalog-facts",
      "system-catalog",
      "docs/template/system-catalog.json",
      "system-catalog",
      {
        nodeKinds: ["system"],
        edgeKinds: [],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "product-topology-facts",
      "product-topology",
      "docs/template/product-topology.json",
      "product-topology",
      {
        nodeKinds: [
          "resource",
          "route",
          "capability",
          "workflow",
          "agent",
          "provider",
          "headless-operation",
        ],
        edgeKinds: [
          "owns",
          "invokes",
          "projects",
          "exposes",
          "depends-on",
          "governed-by",
        ],
        ownershipTargets: [
          "resource",
          "route",
          "capability",
          "workflow",
          "agent",
          "provider",
          "headless-operation",
        ],
      },
    ),
    SOURCE(
      "data-resources-facts",
      "data-resources",
      "docs/template/data-resources.json",
      "data-lifecycle",
      {
        nodeKinds: ["resource", "table"],
        edgeKinds: ["owns", "persists", "depends-on", "governed-by"],
        ownershipTargets: ["resource", "table"],
      },
    ),
    SOURCE(
      "confect-contracts-facts",
      "confect-contracts",
      "packages/template-core/src/generated/confectManifest.ts",
      "confect-codegen",
      {
        nodeKinds: ["capability", "headless-operation"],
        edgeKinds: ["exposes", "depends-on", "generated-by", "verified-by"],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "workflow-registry-facts",
      "workflow-registry",
      "packages/convex/confect/workflows/_generated/workflowRegistry.ts",
      "workflow-generator",
      {
        nodeKinds: ["workflow", "workflow-version", "agent"],
        edgeKinds: [
          "owns",
          "persists",
          "invokes",
          "depends-on",
          "generated-by",
          "governed-by",
          "verified-by",
        ],
        ownershipTargets: ["workflow", "workflow-version", "agent"],
      },
    ),
    SOURCE(
      "workflow-semantics-facts",
      "workflow-semantics",
      "docs/template/generated/workflow-semantics.md",
      "workflow-semantics",
      {
        nodeKinds: ["semantic-rule"],
        edgeKinds: ["governed-by", "verified-by"],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "route-tree-facts",
      "route-tree",
      "apps/web/src/routeTree.gen.ts",
      "router-codegen",
      {
        nodeKinds: ["route"],
        edgeKinds: ["generated-by"],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "headless-registry-facts",
      "headless-registry",
      "packages/template-core/src/generated/confectManifest.ts",
      "confect-manifest",
      {
        nodeKinds: ["headless-operation"],
        edgeKinds: [
          "exposes",
          "invokes",
          "projects",
          "depends-on",
          "generated-by",
        ],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "workspace-metadata-facts",
      "workspace-metadata",
      "pnpm-lock.yaml",
      "workspace-root",
      {
        nodeKinds: ["package"],
        edgeKinds: ["depends-on"],
        ownershipTargets: [],
      },
    ),
    SOURCE(
      "generator-provenance-facts",
      "generator-provenance",
      "docs/template/generated/provenance",
      "template-generators",
      {
        nodeKinds: ["resource", "capability", "workflow"],
        edgeKinds: ["owns", "generated-by", "verified-by"],
        ownershipTargets: ["resource", "route", "capability", "workflow"],
      },
      "sha256-canonical-tree-v1",
    ),
    SOURCE(
      "template-instance-facts",
      "template-instance",
      "template-instance.json",
      "template-instance-schema",
      {
        nodeKinds: [],
        edgeKinds: [],
        ownershipTargets: [],
      },
    ),
  ],
} as const;

export type AppMapInputManifestEntryV1 =
  (typeof APP_MAP_INPUT_MANIFEST_V1.requiredSources)[number];

export type AppMapAdapterIdV1 = AppMapInputManifestEntryV1["adapter"]["id"];

export type AppMapCanonicalSourceIdV1 =
  AppMapInputManifestEntryV1["source"]["id"];

export type AppMapProvenanceV1 = {
  readonly authority: "canonical";
  readonly sourceId: string;
  readonly sourcePath: string;
  readonly sourceVersion: string;
  readonly sourceDigest: string;
  readonly factId: string;
};

export type AppMapSourceV1 = {
  readonly id: string;
  readonly kind: AppMapSourceKind;
  readonly path: string;
  readonly subject: string;
  readonly owner: string;
  readonly digestContract: AppMapDigestContractV1;
  readonly version: string;
  readonly digest: string;
  readonly generation?: AppMapReviewedGenerationV1;
};

export type AppMapReviewedGenerationV1 = {
  readonly kind: "release-blueprint-template-instance-facts";
  readonly sourceRevision: string;
  readonly blueprintId: string;
  readonly blueprintProvenance: string;
  readonly blueprintPlanDigest: string;
  readonly blueprintManifestDigest: string;
};

export type AppMapNodeV1 = {
  readonly id: string;
  readonly kind: AppMapNodeKind;
  readonly group: AppMapGroup;
  readonly label: string;
  readonly version: string;
  readonly provenance: AppMapProvenanceV1;
};

export type AppMapEdgeV1 = {
  readonly id: string;
  readonly kind: AppMapEdgeKind;
  readonly from: string;
  readonly to: string;
  readonly provenance: AppMapProvenanceV1;
};

export type AppMapFactBatchV1 = {
  readonly adapterId: AppMapAdapterIdV1;
  readonly adapterVersion: 1;
  readonly source: AppMapSourceV1;
  readonly nodes: readonly AppMapNodeV1[];
  readonly edges: readonly AppMapEdgeV1[];
};

export type AppMapBuildInputV1 = {
  readonly schemaVersion: 1;
  readonly inputManifest: {
    readonly id: typeof APP_MAP_INPUT_MANIFEST_V1.id;
    readonly version: typeof APP_MAP_INPUT_MANIFEST_V1.version;
  };
  readonly subject: {
    readonly id: string;
    readonly revision: string;
  };
  readonly batches: readonly AppMapFactBatchV1[];
};

export type CanonicalFactsAdapterV1 = {
  readonly adapterId: AppMapAdapterIdV1;
  readonly adapterVersion: 1;
  readonly sourceId: AppMapCanonicalSourceIdV1;
  readonly load: (input: {
    readonly repoRoot: string;
  }) => Promise<AppMapFactBatchV1>;
};

export type TemplateInstanceFactsAdapterV1 = CanonicalFactsAdapterV1 & {
  readonly adapterId: "template-instance-facts";
  readonly sourceId: "template-instance";
};

export type AppMapV1 = {
  readonly schemaVersion: 1;
  readonly inputManifest: AppMapBuildInputV1["inputManifest"];
  readonly subject: AppMapBuildInputV1["subject"];
  readonly groups: readonly {
    readonly name: AppMapGroup;
    readonly nodeIds: readonly string[];
  }[];
  readonly sources: readonly AppMapSourceV1[];
  readonly nodes: readonly AppMapNodeV1[];
  readonly edges: readonly AppMapEdgeV1[];
};

export const APP_MAP_DIAGNOSTIC_CODES = [
  "APP_MAP_INVALID_FACT",
  "APP_MAP_UNOWNED_NODE",
  "APP_MAP_DANGLING_EDGE",
  "APP_MAP_PARALLEL_AUTHORITY",
  "APP_MAP_STALE_FACT",
] as const;

export type AppMapDiagnosticCode = (typeof APP_MAP_DIAGNOSTIC_CODES)[number];

export type AppMapDiagnostic = {
  readonly code: AppMapDiagnosticCode;
  readonly factId: string;
  readonly message: string;
  readonly repair: string;
  readonly rerun: "pnpm check:app-map";
};

export type AppMapBuildResult =
  | {
      readonly ok: true;
      readonly map: AppMapV1;
      readonly json: string;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly AppMapDiagnostic[];
    };

export const groupForNodeKind = (kind: AppMapNodeKind): AppMapGroup => {
  switch (kind) {
    case "route":
      return "Screens";
    case "resource":
    case "table":
      return "Data";
    case "capability":
    case "workflow":
    case "workflow-version":
    case "semantic-rule":
    case "agent":
      return "Automations";
    case "system":
    case "provider":
    case "package":
    case "headless-operation":
      return "Connections";
  }
};
