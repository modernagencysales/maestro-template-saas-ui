import {
  APP_MAP_EDGE_KINDS,
  APP_MAP_DIGEST_CONTRACTS,
  APP_MAP_GROUPS,
  APP_MAP_INPUT_MANIFEST_V1,
  APP_MAP_NODE_KINDS,
  APP_MAP_SOURCE_KINDS,
  groupForNodeKind,
  type AppMapAdapterIdV1,
  type AppMapBuildInputV1,
  type AppMapDiagnostic,
  type AppMapDiagnosticCode,
  type AppMapEdgeKind,
  type AppMapEdgeV1,
  type AppMapFactBatchV1,
  type AppMapInputManifestEntryV1,
  type AppMapNodeKind,
  type AppMapNodeV1,
  type AppMapProvenanceV1,
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

const isCanonicalText = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC");

const isAllowedText = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value =>
  isCanonicalText(value) && (allowed as readonly string[]).includes(value);

const isCanonicalPath = (value: unknown): value is string => {
  if (!isCanonicalText(value) || value.startsWith("/") || value.includes("\\"))
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

type Invalid = (factId: string, message: string) => void;

const hasOnlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  factId: string,
  label: string,
  invalid: Invalid,
): boolean => {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort(compareText);
  if (unknown.length === 0) return true;
  invalid(factId, `${label} contains unknown field(s): ${unknown.join(", ")}.`);
  return false;
};

const readSource = (
  value: unknown,
  factId: string,
  invalid: Invalid,
): AppMapSourceV1 | undefined => {
  if (!isRecord(value)) return undefined;
  const closed = hasOnlyKeys(
    value,
    [
      "id",
      "kind",
      "path",
      "subject",
      "owner",
      "digestContract",
      "version",
      "digest",
      "generation",
    ],
    factId,
    "Canonical source descriptor",
    invalid,
  );
  if (
    !closed ||
    !isCanonicalText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_SOURCE_KINDS) ||
    !isCanonicalPath(value.path) ||
    !isCanonicalText(value.subject) ||
    !isCanonicalText(value.owner) ||
    !isAllowedText(value.digestContract, APP_MAP_DIGEST_CONTRACTS) ||
    !isCanonicalText(value.version) ||
    !isSha256Digest(value.digest) ||
    (value.generation !== undefined &&
      (!isRecord(value.generation) ||
        !hasOnlyKeys(
          value.generation,
          [
            "kind",
            "sourceRevision",
            "blueprintId",
            "blueprintProvenance",
            "blueprintPlanDigest",
            "blueprintManifestDigest",
          ],
          factId,
          "Reviewed generated source",
          invalid,
        ) ||
        value.generation.kind !== "release-blueprint-template-instance-facts" ||
        !isCanonicalText(value.generation.sourceRevision) ||
        !isCanonicalText(value.generation.blueprintId) ||
        !isCanonicalText(value.generation.blueprintProvenance) ||
        !isSha256Digest(value.generation.blueprintPlanDigest) ||
        !isSha256Digest(value.generation.blueprintManifestDigest)))
  ) {
    return undefined;
  }

  return {
    id: value.id,
    kind: value.kind,
    path: value.path,
    subject: value.subject,
    owner: value.owner,
    digestContract: value.digestContract,
    version: value.version,
    digest: value.digest,
    ...(value.generation === undefined
      ? {}
      : {
          generation: {
            kind: "release-blueprint-template-instance-facts" as const,
            sourceRevision: value.generation.sourceRevision as string,
            blueprintId: value.generation.blueprintId as string,
            blueprintProvenance: value.generation.blueprintProvenance as string,
            blueprintPlanDigest: value.generation.blueprintPlanDigest as string,
            blueprintManifestDigest: value.generation
              .blueprintManifestDigest as string,
          },
        }),
  };
};

const readProvenance = (
  value: unknown,
  factId: string,
  invalid: Invalid,
): AppMapProvenanceV1 | undefined => {
  if (!isRecord(value)) return undefined;
  const closed = hasOnlyKeys(
    value,
    [
      "authority",
      "sourceId",
      "sourcePath",
      "sourceVersion",
      "sourceDigest",
      "factId",
    ],
    factId,
    "Canonical provenance",
    invalid,
  );
  if (
    !closed ||
    value.authority !== "canonical" ||
    !isCanonicalText(value.sourceId) ||
    !isCanonicalPath(value.sourcePath) ||
    !isCanonicalText(value.sourceVersion) ||
    !isSha256Digest(value.sourceDigest) ||
    !isCanonicalText(value.factId)
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

const readNode = (
  value: unknown,
  factId: string,
  invalid: Invalid,
): AppMapNodeV1 | undefined => {
  if (!isRecord(value)) return undefined;
  const closed = hasOnlyKeys(
    value,
    ["id", "kind", "group", "label", "version", "provenance"],
    factId,
    "Node",
    invalid,
  );
  if (
    !closed ||
    !isCanonicalText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_NODE_KINDS) ||
    !isAllowedText(value.group, APP_MAP_GROUPS) ||
    !isCanonicalText(value.label) ||
    !isCanonicalText(value.version)
  ) {
    return undefined;
  }

  const provenance = readProvenance(value.provenance, factId, invalid);
  const kind: AppMapNodeKind = value.kind;
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

const readEdge = (
  value: unknown,
  factId: string,
  invalid: Invalid,
): AppMapEdgeV1 | undefined => {
  if (!isRecord(value)) return undefined;
  const closed = hasOnlyKeys(
    value,
    ["id", "kind", "from", "to", "provenance"],
    factId,
    "Edge",
    invalid,
  );
  if (
    !closed ||
    !isCanonicalText(value.id) ||
    !isAllowedText(value.kind, APP_MAP_EDGE_KINDS) ||
    !isCanonicalText(value.from) ||
    !isCanonicalText(value.to)
  ) {
    return undefined;
  }

  const provenance = readProvenance(value.provenance, factId, invalid);
  if (!provenance) return undefined;

  return {
    id: value.id,
    kind: value.kind,
    from: value.from,
    to: value.to,
    provenance,
  };
};

const fallbackFactId = (
  value: unknown,
  batchIndex: number,
  factKind: "node" | "edge",
  factIndex: number,
): string => {
  if (isRecord(value) && isCanonicalText(value.id)) return value.id;
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

const manifestBySourceId = new Map<string, AppMapInputManifestEntryV1>(
  APP_MAP_INPUT_MANIFEST_V1.requiredSources.map((entry) => [
    entry.source.id,
    entry,
  ]),
);

const descriptorDifferences = (
  adapterId: string,
  adapterVersion: unknown,
  source: AppMapSourceV1,
  expected: AppMapInputManifestEntryV1,
): readonly string[] => {
  const differences: string[] = [];
  if (adapterId !== expected.adapter.id) differences.push("adapterId");
  if (adapterVersion !== expected.adapter.version)
    differences.push("adapterVersion");
  if (source.kind !== expected.source.kind) differences.push("source.kind");
  if (source.path !== expected.source.path) differences.push("source.path");
  if (source.subject !== expected.source.subject)
    differences.push("source.subject");
  if (source.owner !== expected.source.owner) differences.push("source.owner");
  if (source.digestContract !== expected.source.digestContract)
    differences.push("source.digestContract");
  return differences;
};

const provenanceMatchesSource = (
  provenance: AppMapProvenanceV1,
  source: AppMapSourceV1,
): boolean =>
  provenance.sourceId === source.id &&
  provenance.sourcePath === source.path &&
  provenance.sourceVersion === source.version &&
  provenance.sourceDigest === source.digest;

const normalizedRelationIdentity = (edge: AppMapEdgeV1): string =>
  [edge.kind, edge.from, edge.to]
    .map((part) => part.trim().normalize("NFC"))
    .join("\u0000");

type ParsedNode = {
  readonly fact: AppMapNodeV1;
  readonly manifest: AppMapInputManifestEntryV1 | undefined;
};

type ParsedEdge = {
  readonly fact: AppMapEdgeV1;
  readonly manifest: AppMapInputManifestEntryV1 | undefined;
};

export type AppMapInputParseResult =
  | {
      readonly ok: true;
      readonly input: AppMapBuildInputV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly AppMapDiagnostic[];
    };

export const parseAppMapInput = (input: unknown): AppMapInputParseResult => {
  const diagnostics = new Map<string, AppMapDiagnostic>();
  const add = (value: AppMapDiagnostic): void => {
    diagnostics.set(
      `${value.code}\u0000${value.factId}\u0000${value.message}`,
      value,
    );
  };
  const invalid: Invalid = (factId, message) => {
    add(
      diagnostic(
        "APP_MAP_INVALID_FACT",
        factId,
        message,
        "Emit only the closed V1 fields and exactly match APP_MAP_INPUT_MANIFEST_V1 for adapter identity, canonical source descriptor, digest contract, fact scope, and provenance.",
      ),
    );
  };

  if (!isRecord(input)) {
    invalid("app-map-input", "App Map input must be a V1 object.");
    return { ok: false, diagnostics: sortedDiagnostics(diagnostics) };
  }

  const inputClosed = hasOnlyKeys(
    input,
    ["schemaVersion", "inputManifest", "subject", "batches"],
    "app-map-input",
    "App Map input",
    invalid,
  );
  if (input.schemaVersion !== 1) {
    invalid("app-map-input", "App Map input schemaVersion must equal 1.");
  }

  let inputManifestValid = false;
  if (isRecord(input.inputManifest)) {
    const closed = hasOnlyKeys(
      input.inputManifest,
      ["id", "version"],
      "app-map-input-manifest",
      "App Map input manifest reference",
      invalid,
    );
    inputManifestValid =
      closed &&
      input.inputManifest.id === APP_MAP_INPUT_MANIFEST_V1.id &&
      input.inputManifest.version === APP_MAP_INPUT_MANIFEST_V1.version;
  }
  if (!inputManifestValid) {
    invalid(
      "app-map-input-manifest",
      `App Map input must name ${APP_MAP_INPUT_MANIFEST_V1.id} version ${APP_MAP_INPUT_MANIFEST_V1.version}.`,
    );
  }

  let subject: AppMapBuildInputV1["subject"] | undefined;
  if (isRecord(input.subject)) {
    const closed = hasOnlyKeys(
      input.subject,
      ["id", "revision"],
      "app-map-subject",
      "App Map subject",
      invalid,
    );
    if (
      closed &&
      isCanonicalText(input.subject.id) &&
      isCanonicalText(input.subject.revision)
    ) {
      subject = { id: input.subject.id, revision: input.subject.revision };
    }
  }
  if (!subject) {
    invalid(
      "app-map-subject",
      "App Map subject must carry only a non-empty canonical ID and exact revision.",
    );
  }

  if (!Array.isArray(input.batches)) {
    invalid("app-map-batches", "App Map input batches must be an array.");
    return { ok: false, diagnostics: sortedDiagnostics(diagnostics) };
  }

  const normalizedBatches: AppMapFactBatchV1[] = [];
  const batchesBySource = new Map<string, number[]>();
  const parsedNodes: ParsedNode[] = [];
  const parsedEdges: ParsedEdge[] = [];

  input.batches.forEach((batchValue, batchIndex) => {
    const batchId = `batch:${batchIndex}`;
    if (!isRecord(batchValue)) {
      invalid(batchId, "Canonical fact batch must be an object.");
      return;
    }
    const batchClosed = hasOnlyKeys(
      batchValue,
      ["adapterId", "adapterVersion", "source", "nodes", "edges"],
      batchId,
      "Canonical fact batch",
      invalid,
    );
    const adapterId = isCanonicalText(batchValue.adapterId)
      ? batchValue.adapterId
      : undefined;
    if (!adapterId || batchValue.adapterVersion !== 1) {
      invalid(
        batchId,
        "Canonical fact batch must carry its manifest adapterId and adapterVersion 1.",
      );
    }

    const sourceFactId =
      isRecord(batchValue.source) && isCanonicalText(batchValue.source.id)
        ? `source:${batchValue.source.id}`
        : `${batchId}/source`;
    const source = readSource(batchValue.source, sourceFactId, invalid);
    if (!source) {
      invalid(
        sourceFactId,
        "Canonical fact batch source metadata is incomplete, non-canonical, or open-ended.",
      );
    }

    const manifest = source ? manifestBySourceId.get(source.id) : undefined;
    if (source) {
      if (!manifest) {
        invalid(
          `source:${source.id}`,
          `Source "${source.id}" is not present in APP_MAP_INPUT_MANIFEST_V1.`,
        );
      } else if (adapterId) {
        const differences = descriptorDifferences(
          adapterId,
          batchValue.adapterVersion,
          source,
          manifest,
        );
        if (differences.length > 0) {
          invalid(
            `source:${source.id}`,
            `Source "${source.id}" differs from APP_MAP_INPUT_MANIFEST_V1 in: ${differences.join(", ")}.`,
          );
        }
      }
      if (manifest) {
        batchesBySource.set(source.id, [
          ...(batchesBySource.get(source.id) ?? []),
          batchIndex,
        ]);
      }
    }

    const nodes: AppMapNodeV1[] = [];
    if (!Array.isArray(batchValue.nodes)) {
      invalid(
        `${batchId}/nodes`,
        "Canonical fact batch nodes must be an array.",
      );
    } else {
      batchValue.nodes.forEach((nodeValue, nodeIndex) => {
        const factId = fallbackFactId(nodeValue, batchIndex, "node", nodeIndex);
        const node = readNode(nodeValue, factId, invalid);
        if (!node) {
          invalid(
            factId,
            "Node is missing its closed V1 shape, canonical provenance, version, or canonical human group.",
          );
          return;
        }
        if (
          manifest &&
          !(manifest.allowedFacts.nodeKinds as readonly string[]).includes(
            node.kind,
          )
        ) {
          invalid(
            node.provenance.factId,
            `Source "${manifest.source.id}" is not authorized to emit ${node.kind} nodes.`,
          );
        }
        if (source && !provenanceMatchesSource(node.provenance, source)) {
          add(
            diagnostic(
              "APP_MAP_STALE_FACT",
              node.provenance.factId,
              `Fact provenance does not match its containing source "${source.id}" at version ${source.version} and digest ${source.digest}.`,
              `Re-read ${source.path} through adapter "${manifest?.adapter.id ?? adapterId ?? "unknown"}" and regenerate the fact; do not move facts between batches or reuse a cached projection.`,
            ),
          );
        }
        nodes.push(node);
        parsedNodes.push({ fact: node, manifest });
      });
    }

    const edges: AppMapEdgeV1[] = [];
    if (!Array.isArray(batchValue.edges)) {
      invalid(
        `${batchId}/edges`,
        "Canonical fact batch edges must be an array.",
      );
    } else {
      batchValue.edges.forEach((edgeValue, edgeIndex) => {
        const factId = fallbackFactId(edgeValue, batchIndex, "edge", edgeIndex);
        const edge = readEdge(edgeValue, factId, invalid);
        if (!edge) {
          invalid(
            factId,
            "Edge is missing its closed V1 endpoints or complete canonical provenance.",
          );
          return;
        }
        if (
          manifest &&
          !(manifest.allowedFacts.edgeKinds as readonly string[]).includes(
            edge.kind,
          )
        ) {
          invalid(
            edge.provenance.factId,
            `Source "${manifest.source.id}" is not authorized to emit ${edge.kind} edges.`,
          );
        }
        if (source && !provenanceMatchesSource(edge.provenance, source)) {
          add(
            diagnostic(
              "APP_MAP_STALE_FACT",
              edge.provenance.factId,
              `Fact provenance does not match its containing source "${source.id}" at version ${source.version} and digest ${source.digest}.`,
              `Re-read ${source.path} through adapter "${manifest?.adapter.id ?? adapterId ?? "unknown"}" and regenerate the fact; do not move facts between batches or reuse a cached projection.`,
            ),
          );
        }
        edges.push(edge);
        parsedEdges.push({ fact: edge, manifest });
      });
    }

    if (batchClosed && adapterId && source) {
      normalizedBatches.push({
        adapterId: adapterId as AppMapAdapterIdV1,
        adapterVersion: 1,
        source,
        nodes,
        edges,
      });
    }
  });

  for (const entry of APP_MAP_INPUT_MANIFEST_V1.requiredSources) {
    const matchingBatches = batchesBySource.get(entry.source.id) ?? [];
    if (matchingBatches.length === 0) {
      invalid(
        `source:${entry.source.id}`,
        `Required canonical source "${entry.source.id}" is missing from the V1 inventory.`,
      );
    } else if (matchingBatches.length > 1) {
      add(
        diagnostic(
          "APP_MAP_PARALLEL_AUTHORITY",
          entry.source.id,
          `More than one adapter batch claims required canonical source "${entry.source.id}".`,
          `Keep exactly one "${entry.adapter.id}" version ${entry.adapter.version} batch for "${entry.source.id}" and remove every duplicate before rebuilding.`,
        ),
      );
    }
  }

  const nodes = parsedNodes.map((entry) => entry.fact);
  const edges = parsedEdges.map((entry) => entry.fact);
  const facts = [...nodes, ...edges];

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

  const relations = new Map<string, AppMapEdgeV1[]>();
  for (const edge of edges) {
    const identity = normalizedRelationIdentity(edge);
    relations.set(identity, [...(relations.get(identity) ?? []), edge]);
  }
  for (const [identity, matchingEdges] of relations) {
    if (matchingEdges.length < 2) continue;
    const [kind, from, to] = identity.split("\u0000") as [
      AppMapEdgeKind,
      string,
      string,
    ];
    add(
      diagnostic(
        "APP_MAP_PARALLEL_AUTHORITY",
        `relation:${kind}:${from}->${to}`,
        `Canonical relation "${kind}:${from}->${to}" is emitted ${matchingEdges.length} times under different edge or provenance identities.`,
        `Retain one canonical ${kind} relation from "${from}" to "${to}" and remove every semantic duplicate before rebuilding.`,
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
        `Emit fact "${fact.provenance.factId}" once from adapter source "${fact.provenance.sourceId}" and remove parallel copies.`,
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

  for (const { fact: edge, manifest } of parsedEdges) {
    const missing = [edge.from, edge.to].filter(
      (nodeId) => !uniqueNodes.has(nodeId),
    );
    if (missing.length > 0) {
      add(
        diagnostic(
          "APP_MAP_DANGLING_EDGE",
          edge.provenance.factId,
          `Edge "${edge.id}" references missing or contested node(s): ${missing.join(", ")}.`,
          `Register each endpoint in its canonical source, remove duplicate node authority, then regenerate edge "${edge.id}" from ${edge.provenance.sourcePath}.`,
        ),
      );
      continue;
    }
    if (edge.kind === "owns" && manifest) {
      const targetKind = uniqueNodes.get(edge.to)?.kind;
      if (
        targetKind &&
        !(manifest.allowedFacts.ownershipTargets as readonly string[]).includes(
          targetKind,
        )
      ) {
        invalid(
          edge.provenance.factId,
          `Source "${manifest.source.id}" is not authorized to own ${targetKind} nodes.`,
        );
      }
    }
  }

  for (const node of uniqueNodes.values()) {
    // Package and semantic-rule nodes are dependency/governance metadata, not
    // product resources. Their canonical sources cannot prove system ownership.
    if (
      node.kind === "system" ||
      node.kind === "package" ||
      node.kind === "semantic-rule"
    )
      continue;
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
          `Retain one owns edge for "${node.id}" in the reviewed canonical registry and remove competing ownership facts.`,
        ),
      );
    }
  }

  const finalDiagnostics = sortedDiagnostics(diagnostics);
  if (
    finalDiagnostics.length > 0 ||
    !inputClosed ||
    !inputManifestValid ||
    !subject
  ) {
    return { ok: false, diagnostics: finalDiagnostics };
  }

  return {
    ok: true,
    diagnostics: [],
    input: {
      schemaVersion: 1,
      inputManifest: {
        id: APP_MAP_INPUT_MANIFEST_V1.id,
        version: APP_MAP_INPUT_MANIFEST_V1.version,
      },
      subject,
      batches: normalizedBatches,
    },
  };
};

export const validateAppMapInput = (
  input: unknown,
): readonly AppMapDiagnostic[] => {
  const result = parseAppMapInput(input);
  return result.ok ? [] : result.diagnostics;
};
