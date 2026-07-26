import {
  APP_MAP_EDGE_KINDS,
  APP_MAP_GROUPS,
  APP_MAP_NODE_KINDS,
  APP_MAP_SOURCE_KINDS,
  groupForNodeKind,
  type AppMapBuildInputV1,
  type AppMapDiagnostic,
  type AppMapDiagnosticCode,
  type AppMapEdgeV1,
  type AppMapNodeKind,
  type AppMapNodeV1,
  type AppMapProvenanceV1,
  type AppMapSourceKind,
  type AppMapSourceV1,
} from "./schema";

const RERUN = "pnpm check:app-map" as const;

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isAllowedText = (
  value: unknown,
  allowed: readonly string[],
): value is string => typeof value === "string" && allowed.includes(value);

const isCanonicalPath = (value: unknown): value is string => {
  if (!isNonEmptyText(value) || value.startsWith("/") || value.includes("\\"))
    return false;

  return value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");
};

const isSha256Digest = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.startsWith("sha256:")) return false;
  const digest = value.slice("sha256:".length);
  const hexadecimal = "0123456789abcdef";
  return (
    digest.length === 64 &&
    [...digest].every((character) => hexadecimal.includes(character))
  );
};

const diagnostic = (
  code: AppMapDiagnosticCode,
  factId: string,
  message: string,
  repair: string,
): AppMapDiagnostic => ({ code, factId, message, repair, rerun: RERUN });

const readSource = (value: unknown): AppMapSourceV1 | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !isNonEmptyText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_SOURCE_KINDS) ||
    !isCanonicalPath(value.path) ||
    !isNonEmptyText(value.version) ||
    !isSha256Digest(value.digest)
  ) {
    return undefined;
  }

  return {
    id: value.id,
    kind: value.kind as AppMapSourceKind,
    path: value.path,
    version: value.version,
    digest: value.digest,
  };
};

const readProvenance = (value: unknown): AppMapProvenanceV1 | undefined => {
  if (!isRecord(value) || value.authority !== "canonical") return undefined;
  if (
    !isNonEmptyText(value.sourceId) ||
    !isCanonicalPath(value.sourcePath) ||
    !isNonEmptyText(value.sourceVersion) ||
    !isSha256Digest(value.sourceDigest) ||
    !isNonEmptyText(value.factId)
  ) {
    return undefined;
  }

  return {
    authority: "canonical",
    sourceId: value.sourceId,
    sourcePath: value.sourcePath,
    sourceVersion: value.sourceVersion,
    sourceDigest: value.sourceDigest,
    factId: value.factId,
  };
};

const readNode = (value: unknown): AppMapNodeV1 | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !isNonEmptyText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_NODE_KINDS) ||
    !isAllowedText(value.group, APP_MAP_GROUPS) ||
    !isNonEmptyText(value.label) ||
    !isNonEmptyText(value.version)
  ) {
    return undefined;
  }

  const provenance = readProvenance(value.provenance);
  const kind = value.kind as AppMapNodeKind;
  if (!provenance || value.group !== groupForNodeKind(kind)) return undefined;

  return {
    id: value.id,
    kind,
    group: value.group,
    label: value.label,
    version: value.version,
    provenance,
  };
};

const readEdge = (value: unknown): AppMapEdgeV1 | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !isNonEmptyText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_EDGE_KINDS) ||
    !isNonEmptyText(value.from) ||
    !isNonEmptyText(value.to)
  ) {
    return undefined;
  }

  const provenance = readProvenance(value.provenance);
  if (!provenance) return undefined;

  return {
    id: value.id,
    kind: value.kind,
    from: value.from,
    to: value.to,
    provenance,
  } as AppMapEdgeV1;
};

const fallbackFactId = (
  value: unknown,
  batchIndex: number,
  factKind: "node" | "edge",
  factIndex: number,
): string => {
  if (isRecord(value) && isNonEmptyText(value.id)) return value.id;
  return `batch:${batchIndex}/${factKind}:${factIndex}`;
};

const sortedDiagnostics = (
  values: ReadonlyMap<string, AppMapDiagnostic>,
): readonly AppMapDiagnostic[] =>
  [...values.values()].sort((left, right) => {
    const codeOrder = compareText(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;
    const factOrder = compareText(left.factId, right.factId);
    if (factOrder !== 0) return factOrder;
    return compareText(left.message, right.message);
  });

export const validateAppMapInput = (
  input: AppMapBuildInputV1,
): readonly AppMapDiagnostic[] => {
  const diagnostics = new Map<string, AppMapDiagnostic>();
  const add = (value: AppMapDiagnostic): void => {
    diagnostics.set(
      `${value.code}\u0000${value.factId}\u0000${value.message}`,
      value,
    );
  };
  const invalid = (factId: string, message: string): void => {
    add(
      diagnostic(
        "APP_MAP_INVALID_FACT",
        factId,
        message,
        "Emit the complete V1 fact shape with canonical authority, source identity, relative source path, source version, SHA-256 digest, and stable fact ID from its owning adapter.",
      ),
    );
  };

  const candidate: unknown = input;
  if (!isRecord(candidate)) {
    invalid("app-map-input", "App Map input must be a V1 object.");
    return sortedDiagnostics(diagnostics);
  }
  if (candidate.schemaVersion !== 1) {
    invalid("app-map-input", "App Map input schemaVersion must equal 1.");
  }
  if (
    !isRecord(candidate.subject) ||
    !isNonEmptyText(candidate.subject.id) ||
    !isNonEmptyText(candidate.subject.revision)
  ) {
    invalid(
      "app-map-subject",
      "App Map subject must carry a non-empty ID and exact revision.",
    );
  }
  if (!Array.isArray(candidate.batches)) {
    invalid("app-map-batches", "App Map input batches must be an array.");
    return sortedDiagnostics(diagnostics);
  }

  const sources = new Map<string, AppMapSourceV1>();
  const nodes: AppMapNodeV1[] = [];
  const edges: AppMapEdgeV1[] = [];

  candidate.batches.forEach((batchValue, batchIndex) => {
    const batchId = `batch:${batchIndex}`;
    if (!isRecord(batchValue)) {
      invalid(batchId, "Canonical fact batch must be an object.");
      return;
    }
    if (batchValue.adapterVersion !== 1) {
      invalid(batchId, "Canonical fact batch adapterVersion must equal 1.");
    }

    const source = readSource(batchValue.source);
    if (!source) {
      invalid(
        `${batchId}/source`,
        "Canonical fact batch source metadata is incomplete or invalid.",
      );
    } else if (sources.has(source.id)) {
      add(
        diagnostic(
          "APP_MAP_PARALLEL_AUTHORITY",
          source.id,
          `More than one adapter batch claims canonical source "${source.id}".`,
          `Keep one V1 adapter for "${source.id}" and remove the duplicate batch before rebuilding the App Map.`,
        ),
      );
    } else {
      sources.set(source.id, source);
    }

    if (!Array.isArray(batchValue.nodes)) {
      invalid(
        `${batchId}/nodes`,
        "Canonical fact batch nodes must be an array.",
      );
    } else {
      batchValue.nodes.forEach((nodeValue, nodeIndex) => {
        const node = readNode(nodeValue);
        if (!node) {
          invalid(
            fallbackFactId(nodeValue, batchIndex, "node", nodeIndex),
            "Node is missing its V1 shape, canonical provenance, version, or canonical human group.",
          );
          return;
        }
        nodes.push(node);
      });
    }

    if (!Array.isArray(batchValue.edges)) {
      invalid(
        `${batchId}/edges`,
        "Canonical fact batch edges must be an array.",
      );
    } else {
      batchValue.edges.forEach((edgeValue, edgeIndex) => {
        const edge = readEdge(edgeValue);
        if (!edge) {
          invalid(
            fallbackFactId(edgeValue, batchIndex, "edge", edgeIndex),
            "Edge is missing its typed endpoints or complete canonical provenance.",
          );
          return;
        }
        edges.push(edge);
      });
    }
  });

  const facts = [...nodes, ...edges];
  for (const fact of facts) {
    const source = sources.get(fact.provenance.sourceId);
    if (!source) {
      add(
        diagnostic(
          "APP_MAP_STALE_FACT",
          fact.provenance.factId,
          `Fact references unavailable canonical source "${fact.provenance.sourceId}".`,
          `Load exactly one current adapter batch for "${fact.provenance.sourceId}" and regenerate this fact from that source.`,
        ),
      );
      continue;
    }
    if (
      fact.provenance.sourcePath !== source.path ||
      fact.provenance.sourceVersion !== source.version ||
      fact.provenance.sourceDigest !== source.digest
    ) {
      add(
        diagnostic(
          "APP_MAP_STALE_FACT",
          fact.provenance.factId,
          `Fact provenance does not match current source "${source.id}" at version ${source.version} and digest ${source.digest}.`,
          `Re-read ${source.path} through the "${source.id}" V1 adapter and regenerate its facts; do not reuse a cached App Map projection.`,
        ),
      );
    }
  }

  const nodesById = new Map<string, AppMapNodeV1[]>();
  for (const node of nodes) {
    nodesById.set(node.id, [...(nodesById.get(node.id) ?? []), node]);
  }
  for (const [nodeId, matchingNodes] of nodesById) {
    if (matchingNodes.length < 2) continue;
    add(
      diagnostic(
        "APP_MAP_PARALLEL_AUTHORITY",
        nodeId,
        `More than one canonical fact defines node "${nodeId}".`,
        `Choose the single canonical registry for "${nodeId}", remove the duplicate fact from other adapters, and regenerate the projection.`,
      ),
    );
  }

  const edgesById = new Map<string, AppMapEdgeV1[]>();
  for (const edge of edges) {
    edgesById.set(edge.id, [...(edgesById.get(edge.id) ?? []), edge]);
  }
  for (const [edgeId, matchingEdges] of edgesById) {
    if (matchingEdges.length < 2) continue;
    add(
      diagnostic(
        "APP_MAP_PARALLEL_AUTHORITY",
        edgeId,
        `More than one canonical fact defines edge "${edgeId}".`,
        `Keep one canonical edge fact for "${edgeId}", remove duplicate adapter output, and regenerate the projection.`,
      ),
    );
  }

  const factsByProvenance = new Map<string, typeof facts>();
  for (const fact of facts) {
    const identity = `${fact.provenance.sourceId}\u0000${fact.provenance.factId}`;
    factsByProvenance.set(identity, [
      ...(factsByProvenance.get(identity) ?? []),
      fact,
    ]);
  }
  for (const [identity, matchingFacts] of factsByProvenance) {
    if (matchingFacts.length < 2) continue;
    const fact = matchingFacts[0];
    if (!fact) continue;
    add(
      diagnostic(
        "APP_MAP_PARALLEL_AUTHORITY",
        fact.provenance.factId,
        `Canonical provenance identity "${identity.replace("\u0000", ":")}" is emitted more than once.`,
        `Emit fact "${fact.provenance.factId}" once from adapter "${fact.provenance.sourceId}" and remove parallel copies.`,
      ),
    );
  }

  const uniqueNodes = new Map(
    [...nodesById.entries()]
      .filter(([, matchingNodes]) => matchingNodes.length === 1)
      .map(([nodeId, matchingNodes]) => [
        nodeId,
        matchingNodes[0] as AppMapNodeV1,
      ]),
  );

  for (const edge of edges) {
    const missing = [edge.from, edge.to].filter(
      (nodeId) => !uniqueNodes.has(nodeId),
    );
    if (missing.length === 0) continue;
    add(
      diagnostic(
        "APP_MAP_DANGLING_EDGE",
        edge.provenance.factId,
        `Edge "${edge.id}" references missing or contested node(s): ${missing.join(", ")}.`,
        `Register each endpoint in its canonical source, remove any duplicate node authority, then regenerate edge "${edge.id}" from ${edge.provenance.sourcePath}.`,
      ),
    );
  }

  for (const node of uniqueNodes.values()) {
    if (node.kind === "system") continue;
    const ownerEdges = edges.filter((edge) => {
      if (edge.kind !== "owns" || edge.to !== node.id) return false;
      return uniqueNodes.get(edge.from)?.kind === "system";
    });
    if (ownerEdges.length === 0) {
      add(
        diagnostic(
          "APP_MAP_UNOWNED_NODE",
          node.provenance.factId,
          `Node "${node.id}" has no canonical system owner.`,
          `Declare exactly one system ownership edge for "${node.id}" in its canonical registry, regenerate that adapter batch, and rerun the App Map check.`,
        ),
      );
    } else if (ownerEdges.length > 1) {
      add(
        diagnostic(
          "APP_MAP_PARALLEL_AUTHORITY",
          node.provenance.factId,
          `Node "${node.id}" has ${ownerEdges.length} canonical system owners.`,
          `Retain one owns edge for "${node.id}" in the reviewed canonical registry and remove the competing ownership facts.`,
        ),
      );
    }
  }

  return sortedDiagnostics(diagnostics);
};
