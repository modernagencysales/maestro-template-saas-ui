export type JourneyState =
  "assembling" | "legacy_exposed" | "admitted" | "suspended";

export type JourneyReleaseProof =
  "deterministic-only" | "deployed-proof-required";

export type JourneyCoverageProfile = "read-only" | "stateful" | "high-risk";

export type JourneyScenarioClass =
  | "success"
  | "empty"
  | "authorization_denial"
  | "user_visible_failure"
  | "mutation_failure"
  | "retry"
  | "exact_replay"
  | "partial_progress"
  | "recovery"
  | "tenant_isolation"
  | "unsafe_input_refusal"
  | "deletion_or_revocation"
  | "historical_version"
  | "migration_or_backfill"
  | "deployed_proof";

export type JourneyScenarioRequirement = {
  readonly id: string;
  readonly scenarioClass: JourneyScenarioClass;
  readonly initialState: string;
  readonly interactions: readonly string[];
  readonly terminalOutcome: string;
  readonly requiredReceiptKinds: readonly string[];
  readonly forbiddenOutcomes: readonly string[];
  readonly fixtureMetadata: Readonly<Record<string, unknown>>;
  readonly requiresDeployedProof: boolean;
};

export type JourneyGraphNode = {
  readonly id: string;
  readonly kind: "interaction" | "boundary" | "terminal";
};

export type JourneyGraphEdge = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly receiptKind: string;
};

export type JourneyGraph = {
  readonly start: string;
  readonly terminal: string;
  readonly nodes: readonly JourneyGraphNode[];
  readonly edges: readonly JourneyGraphEdge[];
};

export type JourneyDependency = {
  readonly id: string;
  readonly minimumVersion: number;
  readonly terminalReceiptKind: string;
};

export type LegacyExposure = {
  readonly existingEntrypoints: readonly string[];
  readonly removalMilestone: string;
};

export type ProductJourneyManifest = {
  readonly journeyProtocolVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly status: JourneyState;
  readonly releaseProof: JourneyReleaseProof;
  readonly coverageProfile: JourneyCoverageProfile;
  readonly actor: string;
  readonly goal: string;
  readonly releaseEntrypoints: readonly string[];
  readonly scenarios: readonly JourneyScenarioRequirement[];
  readonly graph: JourneyGraph;
  readonly requiredReceiptKinds: readonly string[];
  readonly dependsOnJourneys: readonly JourneyDependency[];
  readonly affectedPaths: readonly string[];
  readonly workPackageRefs: readonly string[];
  readonly owner: string;
  readonly legacyExposure?: LegacyExposure;
};

const scenarioRequirements: Readonly<
  Record<JourneyCoverageProfile, readonly JourneyScenarioClass[]>
> = {
  "read-only": [
    "success",
    "empty",
    "authorization_denial",
    "user_visible_failure",
  ],
  stateful: [
    "success",
    "empty",
    "authorization_denial",
    "user_visible_failure",
    "mutation_failure",
    "retry",
    "exact_replay",
    "partial_progress",
    "recovery",
  ],
  "high-risk": [
    "success",
    "empty",
    "authorization_denial",
    "user_visible_failure",
    "mutation_failure",
    "retry",
    "exact_replay",
    "partial_progress",
    "recovery",
    "tenant_isolation",
    "unsafe_input_refusal",
    "deletion_or_revocation",
    "historical_version",
    "migration_or_backfill",
    "deployed_proof",
  ],
};

const states = new Set<JourneyState>([
  "assembling",
  "legacy_exposed",
  "admitted",
  "suspended",
]);
const releaseProofs = new Set<JourneyReleaseProof>([
  "deterministic-only",
  "deployed-proof-required",
]);
const coverageProfiles = new Set<JourneyCoverageProfile>([
  "read-only",
  "stateful",
  "high-risk",
]);
const scenarioClasses = new Set<JourneyScenarioClass>([
  "success",
  "empty",
  "authorization_denial",
  "user_visible_failure",
  "mutation_failure",
  "retry",
  "exact_replay",
  "partial_progress",
  "recovery",
  "tenant_isolation",
  "unsafe_input_refusal",
  "deletion_or_revocation",
  "historical_version",
  "migration_or_backfill",
  "deployed_proof",
]);

const asRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value as Record<string, unknown>;
};

const asString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
};

const asPositiveInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${path} must be a positive integer`);
  }

  return value;
};

const asStringArray = (value: unknown, path: string): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  return value.map((entry, index) => asString(entry, `${path}[${index}]`));
};

const hasCredentialKey = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasCredentialKey);
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nested]) =>
      /(?:api[_-]?key|credential|password|secret|token)/i.test(key) ||
      hasCredentialKey(nested),
  );
};

const parseScenario = (
  value: unknown,
  index: number,
): JourneyScenarioRequirement => {
  const scenario = asRecord(value, `scenarios[${index}]`);
  const scenarioClass = asString(
    scenario.scenarioClass,
    `scenarios[${index}].scenarioClass`,
  );

  if (!scenarioClasses.has(scenarioClass as JourneyScenarioClass)) {
    throw new Error(`scenarios[${index}].scenarioClass is not supported`);
  }

  const fixtureMetadata = asRecord(
    scenario.fixtureMetadata,
    `scenarios[${index}].fixtureMetadata`,
  );
  if (hasCredentialKey(fixtureMetadata)) {
    throw new Error(
      `scenarios[${index}].fixtureMetadata must not contain credentials`,
    );
  }

  if (typeof scenario.requiresDeployedProof !== "boolean") {
    throw new Error(
      `scenarios[${index}].requiresDeployedProof must be a boolean`,
    );
  }

  return {
    id: asString(scenario.id, `scenarios[${index}].id`),
    scenarioClass: scenarioClass as JourneyScenarioClass,
    initialState: asString(
      scenario.initialState,
      `scenarios[${index}].initialState`,
    ),
    interactions: asStringArray(
      scenario.interactions,
      `scenarios[${index}].interactions`,
    ),
    terminalOutcome: asString(
      scenario.terminalOutcome,
      `scenarios[${index}].terminalOutcome`,
    ),
    requiredReceiptKinds: asStringArray(
      scenario.requiredReceiptKinds,
      `scenarios[${index}].requiredReceiptKinds`,
    ),
    forbiddenOutcomes: asStringArray(
      scenario.forbiddenOutcomes,
      `scenarios[${index}].forbiddenOutcomes`,
    ),
    fixtureMetadata,
    requiresDeployedProof: scenario.requiresDeployedProof,
  };
};

const parseGraph = (value: unknown): JourneyGraph => {
  const graph = asRecord(value, "graph");
  const nodesValue = graph.nodes;
  const edgesValue = graph.edges;
  if (!Array.isArray(nodesValue) || !Array.isArray(edgesValue)) {
    throw new Error("graph nodes and edges must be arrays");
  }

  const nodes = nodesValue.map((value, index): JourneyGraphNode => {
    const node = asRecord(value, `graph.nodes[${index}]`);
    const kind = asString(node.kind, `graph.nodes[${index}].kind`);
    if (kind !== "interaction" && kind !== "boundary" && kind !== "terminal") {
      throw new Error(`graph.nodes[${index}].kind is not supported`);
    }
    return { id: asString(node.id, `graph.nodes[${index}].id`), kind };
  });
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id))
      throw new Error(`duplicate graph node id: ${node.id}`);
    nodeIds.add(node.id);
  }

  const edges = edgesValue.map((value, index): JourneyGraphEdge => {
    const edge = asRecord(value, `graph.edges[${index}]`);
    const from = asString(edge.from, `graph.edges[${index}].from`);
    const to = asString(edge.to, `graph.edges[${index}].to`);
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      throw new Error(
        `unknown graph node in edge ${asString(edge.id, `graph.edges[${index}].id`)}`,
      );
    }
    return {
      id: asString(edge.id, `graph.edges[${index}].id`),
      from,
      to,
      receiptKind: asString(
        edge.receiptKind,
        `graph.edges[${index}].receiptKind`,
      ),
    };
  });

  const start = asString(graph.start, "graph.start");
  const terminal = asString(graph.terminal, "graph.terminal");
  if (!nodeIds.has(start) || !nodeIds.has(terminal)) {
    throw new Error("graph start and terminal must name graph nodes");
  }

  return { start, terminal, nodes, edges };
};

export const parseProductJourneyManifest = (
  value: unknown,
): ProductJourneyManifest => {
  const manifest = asRecord(value, "manifest");
  if (manifest.journeyProtocolVersion !== 1) {
    throw new Error("journeyProtocolVersion must be 1");
  }
  const status = asString(manifest.status, "status");
  const releaseProof = asString(manifest.releaseProof, "releaseProof");
  const coverageProfile = asString(manifest.coverageProfile, "coverageProfile");
  if (!states.has(status as JourneyState))
    throw new Error("status is not supported");
  if (!releaseProofs.has(releaseProof as JourneyReleaseProof))
    throw new Error("releaseProof is not supported");
  if (!coverageProfiles.has(coverageProfile as JourneyCoverageProfile))
    throw new Error("coverageProfile is not supported");

  if (!Array.isArray(manifest.scenarios))
    throw new Error("scenarios must be an array");
  const scenarios = manifest.scenarios.map(parseScenario);
  const requiredClasses =
    scenarioRequirements[coverageProfile as JourneyCoverageProfile];
  const declaredClasses = new Set(
    scenarios.map((scenario) => scenario.scenarioClass),
  );
  for (const scenarioClass of requiredClasses) {
    if (!declaredClasses.has(scenarioClass)) {
      throw new Error(`missing required scenario class: ${scenarioClass}`);
    }
  }
  if (
    coverageProfile === "high-risk" &&
    (releaseProof !== "deployed-proof-required" ||
      !scenarios.some(
        (scenario) =>
          scenario.scenarioClass === "deployed_proof" &&
          scenario.requiresDeployedProof,
      ))
  ) {
    throw new Error("high-risk journeys require deployed_proof");
  }

  const id = asString(manifest.id, "id");
  const dependenciesValue = manifest.dependsOnJourneys;
  if (!Array.isArray(dependenciesValue))
    throw new Error("dependsOnJourneys must be an array");
  const dependsOnJourneys = dependenciesValue.map(
    (value, index): JourneyDependency => {
      const dependency = asRecord(value, `dependsOnJourneys[${index}]`);
      const dependencyId = asString(
        dependency.id,
        `dependsOnJourneys[${index}].id`,
      );
      if (dependencyId === id)
        throw new Error(`dependency cycle: ${id} depends on itself`);
      return {
        id: dependencyId,
        minimumVersion: asPositiveInteger(
          dependency.minimumVersion,
          `dependsOnJourneys[${index}].minimumVersion`,
        ),
        terminalReceiptKind: asString(
          dependency.terminalReceiptKind,
          `dependsOnJourneys[${index}].terminalReceiptKind`,
        ),
      };
    },
  );
  const legacyExposure =
    manifest.legacyExposure === undefined
      ? undefined
      : (() => {
          const exposure = asRecord(manifest.legacyExposure, "legacyExposure");
          return {
            existingEntrypoints: asStringArray(
              exposure.existingEntrypoints,
              "legacyExposure.existingEntrypoints",
            ),
            removalMilestone: asString(
              exposure.removalMilestone,
              "legacyExposure.removalMilestone",
            ),
          } satisfies LegacyExposure;
        })();
  if (status === "legacy_exposed" && legacyExposure === undefined) {
    throw new Error("legacy_exposed journeys require legacyExposure");
  }

  return {
    journeyProtocolVersion: 1,
    id,
    version: asPositiveInteger(manifest.version, "version"),
    title: asString(manifest.title, "title"),
    status: status as JourneyState,
    releaseProof: releaseProof as JourneyReleaseProof,
    coverageProfile: coverageProfile as JourneyCoverageProfile,
    actor: asString(manifest.actor, "actor"),
    goal: asString(manifest.goal, "goal"),
    releaseEntrypoints: asStringArray(
      manifest.releaseEntrypoints,
      "releaseEntrypoints",
    ),
    scenarios,
    graph: parseGraph(manifest.graph),
    requiredReceiptKinds: asStringArray(
      manifest.requiredReceiptKinds,
      "requiredReceiptKinds",
    ),
    dependsOnJourneys,
    affectedPaths: asStringArray(manifest.affectedPaths, "affectedPaths"),
    workPackageRefs: asStringArray(manifest.workPackageRefs, "workPackageRefs"),
    owner: asString(manifest.owner, "owner"),
    ...(legacyExposure === undefined ? {} : { legacyExposure }),
  };
};
