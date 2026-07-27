import { buildAppMap } from "./build";
import { isExactGitRevision } from "./gitDiff";
import type {
  AppMapEdgeV1,
  AppMapNodeKind,
  AppMapNodeV1,
  AppMapV1,
} from "./schema";

export type AppMapImpactRiskV1 = "low" | "medium" | "high" | "unknown";

export type AppMapImpactV1 = {
  readonly schemaVersion: 1;
  readonly baseRevision: string;
  readonly subjectRevision: string;
  readonly complete: boolean;
  readonly risk: AppMapImpactRiskV1;
  readonly changedPaths: readonly string[];
  readonly nodes: {
    readonly direct: readonly string[];
    readonly generated: readonly string[];
    readonly transitive: readonly string[];
  };
  readonly affected: {
    readonly systems: readonly string[];
    readonly durableData: readonly string[];
    readonly workflowVersions: readonly string[];
    readonly providers: readonly string[];
    readonly publicContracts: readonly string[];
    readonly routes: readonly string[];
    readonly headlessSurfaces: readonly string[];
    readonly semanticRuleIds: readonly string[];
    readonly adrs: readonly string[];
  };
  readonly unknownPaths: readonly string[];
  readonly focusedGates: readonly string[];
};

export type AppMapImpactDiagnostic = {
  readonly code: "APP_MAP_IMPACT_INVALID_INPUT";
  readonly message: string;
  readonly repair: string;
};

export type AppMapImpactResult =
  | { readonly ok: true; readonly impact: AppMapImpactV1 }
  | {
      readonly ok: false;
      readonly diagnostics: readonly AppMapImpactDiagnostic[];
    };

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));
const safePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC") &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  ![...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
  }) &&
  value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");

const invalid = (): AppMapImpactResult => ({
  ok: false,
  diagnostics: [
    {
      code: "APP_MAP_IMPACT_INVALID_INPUT",
      message:
        "Impact requires a closed V1 request, an explicit commit base, safe changed paths, and a valid canonical App Map input.",
      repair:
        "Rebuild the App Map from its closed input manifest and supply the reviewed Git comparison base explicitly.",
    },
  ],
});

const sourceMatchesPath = (
  source: AppMapV1["sources"][number],
  path: string,
): boolean =>
  source.digestContract === "sha256-canonical-tree-v1"
    ? path === source.path || path.startsWith(`${source.path}/`)
    : path === source.path;

const incidentNodes = (edge: AppMapEdgeV1): readonly string[] => [
  edge.from,
  edge.to,
];

const IMPACT_TRAVERSAL_EDGE_KINDS = ["owns", "depends-on"] as const;
const GENERATED_EDGE_KIND = "generated-by" as const;

const traverseEdges = (
  edges: readonly AppMapEdgeV1[],
  seeds: ReadonlySet<string>,
  allowedKinds: ReadonlySet<AppMapEdgeV1["kind"]>,
): Set<string> => {
  const reached = new Set(seeds);
  const queue = [...seeds].sort(compareText);
  const eligibleEdges = edges
    .filter((edge) => allowedKinds.has(edge.kind))
    .sort((left, right) => compareText(left.id, right.id));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of eligibleEdges) {
      const next =
        edge.from === current
          ? edge.to
          : edge.to === current
            ? edge.from
            : undefined;
      if (next === undefined || reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
};

const idsForKinds = (
  nodes: readonly AppMapNodeV1[],
  kinds: readonly AppMapNodeKind[],
): readonly string[] =>
  nodes
    .filter((node) => kinds.includes(node.kind))
    .map((node) => node.id)
    .sort(compareText);

const focusedGatesFor = (nodes: readonly AppMapNodeV1[]): readonly string[] => {
  const kinds = new Set(nodes.map((node) => node.kind));
  const gates = ["pnpm check:app-map"];
  if (kinds.has("resource") || kinds.has("table")) {
    gates.push("pnpm check:data-resources");
  }
  if (kinds.has("system")) gates.push("pnpm check:system-catalog");
  if (kinds.has("route")) gates.push("pnpm --dir apps/web test");
  if (
    kinds.has("workflow") ||
    kinds.has("workflow-version") ||
    kinds.has("semantic-rule")
  ) {
    gates.push("pnpm check:workflow-semantics");
  }
  if (kinds.has("capability") || kinds.has("headless-operation")) {
    gates.push("pnpm check:headless-surface-contract");
  }
  return gates;
};

const riskFor = (
  nodes: readonly AppMapNodeV1[],
  unknownPaths: readonly string[],
): AppMapImpactRiskV1 => {
  if (unknownPaths.length > 0) return "unknown";
  const highRiskKinds: readonly AppMapNodeKind[] = [
    "resource",
    "table",
    "workflow",
    "workflow-version",
    "semantic-rule",
    "provider",
    "capability",
    "headless-operation",
  ];
  if (nodes.some((node) => highRiskKinds.includes(node.kind))) return "high";
  if (nodes.some((node) => node.kind === "system" || node.kind === "route")) {
    return "medium";
  }
  return "low";
};

export const buildAppMapImpact = (candidate: unknown): AppMapImpactResult => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, [
      "schemaVersion",
      "baseRevision",
      "mapInput",
      "changedPaths",
    ]) ||
    candidate.schemaVersion !== 1 ||
    !isExactGitRevision(candidate.baseRevision) ||
    !Array.isArray(candidate.changedPaths) ||
    !candidate.changedPaths.every(safePath)
  ) {
    return invalid();
  }

  const built = buildAppMap(candidate.mapInput);
  if (!built.ok) return invalid();

  const changedPaths = [...new Set(candidate.changedPaths)].sort(compareText);
  const matchedSourceIds = new Set<string>();
  const unknownPaths: string[] = [];
  for (const path of changedPaths) {
    const matches = built.map.sources.filter((source) =>
      sourceMatchesPath(source, path),
    );
    if (matches.length === 0) unknownPaths.push(path);
    for (const source of matches) matchedSourceIds.add(source.id);
  }

  const direct = new Set(
    built.map.nodes
      .filter((node) => matchedSourceIds.has(node.provenance.sourceId))
      .map((node) => node.id),
  );
  for (const edge of built.map.edges) {
    if (!matchedSourceIds.has(edge.provenance.sourceId)) continue;
    for (const nodeId of incidentNodes(edge)) direct.add(nodeId);
  }

  const generatedReach = traverseEdges(
    built.map.edges,
    direct,
    new Set([GENERATED_EDGE_KIND]),
  );
  const generated = new Set(
    [...generatedReach].filter((nodeId) => !direct.has(nodeId)),
  );

  const reached = traverseEdges(
    built.map.edges,
    new Set([...direct, ...generated]),
    new Set(IMPACT_TRAVERSAL_EDGE_KINDS),
  );
  const transitive = [...reached]
    .filter((id) => !direct.has(id) && !generated.has(id))
    .sort(compareText);
  const impactedNodes = built.map.nodes.filter((node) => reached.has(node.id));

  const impact: AppMapImpactV1 = {
    schemaVersion: 1,
    baseRevision: candidate.baseRevision,
    subjectRevision: built.map.subject.revision,
    complete: unknownPaths.length === 0,
    risk: riskFor(impactedNodes, unknownPaths),
    changedPaths,
    nodes: {
      direct: [...direct].sort(compareText),
      generated: [...generated].sort(compareText),
      transitive,
    },
    affected: {
      systems: idsForKinds(impactedNodes, ["system"]),
      durableData: idsForKinds(impactedNodes, ["resource", "table"]),
      workflowVersions: idsForKinds(impactedNodes, ["workflow-version"]),
      providers: idsForKinds(impactedNodes, ["provider"]),
      publicContracts: idsForKinds(impactedNodes, ["capability"]),
      routes: idsForKinds(impactedNodes, ["route"]),
      headlessSurfaces: idsForKinds(impactedNodes, ["headless-operation"]),
      semanticRuleIds: idsForKinds(impactedNodes, ["semantic-rule"]),
      adrs: [],
    },
    unknownPaths,
    focusedGates: focusedGatesFor(impactedNodes),
  };
  return { ok: true, impact };
};
