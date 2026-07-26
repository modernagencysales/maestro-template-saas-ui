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
  readonly version: string;
  readonly digest: string;
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
  readonly adapterVersion: 1;
  readonly source: AppMapSourceV1;
  readonly nodes: readonly AppMapNodeV1[];
  readonly edges: readonly AppMapEdgeV1[];
};

export type AppMapBuildInputV1 = {
  readonly schemaVersion: 1;
  readonly subject: {
    readonly id: string;
    readonly revision: string;
  };
  readonly batches: readonly AppMapFactBatchV1[];
};

export type CanonicalFactsAdapterV1 = {
  readonly adapterVersion: 1;
  readonly sourceId: string;
  readonly load: (input: {
    readonly repoRoot: string;
  }) => Promise<AppMapFactBatchV1>;
};

export type TemplateInstanceFactsAdapterV1 = CanonicalFactsAdapterV1 & {
  readonly sourceId: "template-instance";
};

export type AppMapV1 = {
  readonly schemaVersion: 1;
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
