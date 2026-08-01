import type { ProductJourneyManifest } from "./manifest";

export type JourneyDiagnostic = {
  readonly code:
    | "ENTRYPOINT_UNMAPPED"
    | "EDGE_PRODUCER_INVALID"
    | "EDGE_CONSUMER_MISSING"
    | "FRONTIER_REGRESSION"
    | "LEGACY_EXPANSION"
    | "LEGACY_MILESTONE_EXPIRED"
    | "DEPENDENCY_INCOMPATIBLE"
    | "SURFACE_UNCLASSIFIED"
    | "COVERAGE_REDUCED";
  readonly journeyId: string;
  readonly path?: string;
  readonly message: string;
};

export type ReleaseSurfaceInventory = {
  readonly releaseEntrypoints: readonly string[];
  readonly receiptProducers: readonly {
    readonly receiptKind: string;
    readonly path: string;
  }[];
  readonly receiptConsumers: readonly {
    readonly receiptKind: string;
    readonly path: string;
  }[];
  readonly frontiers: readonly {
    readonly journeyId: string;
    readonly reachedNode: string;
    readonly previousReachedNode?: string;
  }[];
  readonly legacyEntrypoints: readonly string[];
  readonly today: string;
  readonly classifiedPaths?: readonly string[];
};

const compareDiagnostics = (
  left: JourneyDiagnostic,
  right: JourneyDiagnostic,
): number =>
  left.code.localeCompare(right.code) ||
  left.journeyId.localeCompare(right.journeyId) ||
  (left.path ?? "").localeCompare(right.path ?? "") ||
  left.message.localeCompare(right.message);

const matchesPath = (path: string, pattern: string): boolean =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")}$`,
  ).test(path);

const reachable = (
  manifest: ProductJourneyManifest,
  target: string,
): boolean => {
  const seen = new Set<string>([manifest.graph.start]);
  const queue = [manifest.graph.start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === target) return true;
    for (const edge of manifest.graph.edges)
      if (edge.from === node && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
  }
  return false;
};

export const validateJourneyCatalog = (
  manifests: readonly ProductJourneyManifest[],
  inventory?: ReleaseSurfaceInventory,
): readonly JourneyDiagnostic[] => {
  const diagnostics: JourneyDiagnostic[] = [];
  const byId = new Map<string, ProductJourneyManifest>();
  for (const manifest of manifests) {
    if (byId.has(manifest.id))
      diagnostics.push({
        code: "COVERAGE_REDUCED",
        journeyId: manifest.id,
        message: `duplicate journey id: ${manifest.id}`,
      });
    byId.set(manifest.id, manifest);
  }
  const visiting: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.includes(id)) {
      diagnostics.push({
        code: "DEPENDENCY_INCOMPATIBLE",
        journeyId: id,
        message: `dependency cycle: ${[...visiting.slice(visiting.indexOf(id)), id].join(" -> ")}`,
      });
      return;
    }
    if (visited.has(id)) return;
    const manifest = byId.get(id);
    if (manifest === undefined) return;
    visiting.push(id);
    for (const dependency of manifest.dependsOnJourneys) {
      const target = byId.get(dependency.id);
      if (
        target === undefined ||
        target.status !== "admitted" ||
        target.version < dependency.minimumVersion ||
        !target.requiredReceiptKinds.includes(dependency.terminalReceiptKind)
      ) {
        diagnostics.push({
          code: "DEPENDENCY_INCOMPATIBLE",
          journeyId: manifest.id,
          message: `dependency ${dependency.id} is not an admitted compatible contract`,
        });
      }
      if (target !== undefined) visit(dependency.id);
    }
    visiting.pop();
    visited.add(id);
  };
  for (const manifest of manifests) visit(manifest.id);
  if (inventory === undefined) {
    const cycle = diagnostics.find((diagnostic) =>
      diagnostic.message.startsWith("dependency cycle:"),
    );
    if (cycle !== undefined) throw new Error(cycle.message);
    return diagnostics.sort(compareDiagnostics);
  }

  const mappedEntrypoints = new Set(
    manifests.flatMap((manifest) => manifest.releaseEntrypoints),
  );
  for (const path of inventory.releaseEntrypoints)
    if (!mappedEntrypoints.has(path))
      diagnostics.push({
        code: "ENTRYPOINT_UNMAPPED",
        journeyId: "catalog",
        path,
        message: `release entrypoint is not mapped: ${path}`,
      });
    else if (
      inventory.classifiedPaths !== undefined &&
      !inventory.classifiedPaths.some((pattern) => matchesPath(path, pattern))
    )
      diagnostics.push({
        code: "SURFACE_UNCLASSIFIED",
        journeyId: "catalog",
        path,
        message: `release surface is not classified: ${path}`,
      });
  for (const manifest of manifests) {
    for (const edge of manifest.graph.edges) {
      const producers = inventory.receiptProducers.filter(
        (entry) => entry.receiptKind === edge.receiptKind,
      );
      if (producers.length !== 1)
        diagnostics.push({
          code: "EDGE_PRODUCER_INVALID",
          journeyId: manifest.id,
          path: edge.id,
          message: `receipt ${edge.receiptKind} must have exactly one producer`,
        });
      if (
        !inventory.receiptConsumers.some(
          (entry) => entry.receiptKind === edge.receiptKind,
        )
      )
        diagnostics.push({
          code: "EDGE_CONSUMER_MISSING",
          journeyId: manifest.id,
          path: edge.id,
          message: `receipt ${edge.receiptKind} has no consumer assertion`,
        });
    }
    if (
      manifest.status === "legacy_exposed" &&
      manifest.legacyExposure !== undefined
    ) {
      for (const path of manifest.legacyExposure.existingEntrypoints)
        if (!inventory.legacyEntrypoints.includes(path))
          diagnostics.push({
            code: "LEGACY_EXPANSION",
            journeyId: manifest.id,
            path,
            message: `legacy entrypoint was not present in the baseline: ${path}`,
          });
      if (manifest.legacyExposure.removalMilestone < inventory.today)
        diagnostics.push({
          code: "LEGACY_MILESTONE_EXPIRED",
          journeyId: manifest.id,
          message: `legacy removal milestone expired: ${manifest.legacyExposure.removalMilestone}`,
        });
    }
  }
  for (const frontier of inventory.frontiers) {
    const manifest = byId.get(frontier.journeyId);
    if (
      manifest !== undefined &&
      frontier.previousReachedNode !== undefined &&
      (!reachable(manifest, frontier.reachedNode) ||
        !reachable(manifest, frontier.previousReachedNode) ||
        !reachableFrom(
          manifest,
          frontier.previousReachedNode,
          frontier.reachedNode,
        ))
    )
      diagnostics.push({
        code: "FRONTIER_REGRESSION",
        journeyId: manifest.id,
        path: frontier.reachedNode,
        message: `assembling frontier regressed from ${frontier.previousReachedNode} to ${frontier.reachedNode}`,
      });
  }
  return diagnostics.sort(compareDiagnostics);
};

const reachableFrom = (
  manifest: ProductJourneyManifest,
  from: string,
  target: string,
): boolean => {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node === target) return true;
    for (const edge of manifest.graph.edges)
      if (edge.from === node && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
  }
  return false;
};
