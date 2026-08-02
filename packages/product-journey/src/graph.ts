import type { ProductJourneyManifest } from "./manifest";
import { compareCodePoints } from "./ordering";

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
  readonly receiptProducers: readonly JourneyEdgeWitness[];
  readonly receiptConsumers: readonly JourneyEdgeWitness[];
  readonly frontiers: readonly {
    readonly journeyId: string;
    readonly reachedNode: string;
    readonly previousReachedNode?: string;
  }[];
  readonly legacyEntrypoints: readonly string[];
  readonly today: string;
  readonly classifiedPaths?: readonly string[];
  readonly surfaceAuthorities?: readonly ReleaseSurfaceAuthority[];
};

export type JourneyEdgeWitness = {
  readonly journeyId: string;
  readonly from: string;
  readonly to: string;
  readonly receiptKind: string;
  readonly contractIdentity: string;
  readonly path: string;
};

export type ReleaseSurfaceAuthority = {
  readonly path: string;
  readonly journeyId: string;
  readonly authority: "read" | "write" | "external_dispatch" | "async";
  readonly transport: "local" | "non_local";
};

const compareDiagnostics = (
  left: JourneyDiagnostic,
  right: JourneyDiagnostic,
): number =>
  compareCodePoints(left.code, right.code) ||
  compareCodePoints(left.journeyId, right.journeyId) ||
  compareCodePoints(left.path ?? "", right.path ?? "") ||
  compareCodePoints(left.message, right.message);

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
    const node = queue.shift();
    if (node === undefined) break;
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
  const inventoryEntrypoints = new Set(inventory.releaseEntrypoints);
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
  for (const manifest of manifests)
    for (const path of manifest.releaseEntrypoints)
      if (!inventoryEntrypoints.has(path))
        diagnostics.push({
          code: "ENTRYPOINT_UNMAPPED",
          journeyId: manifest.id,
          path,
          message: `manifest release entrypoint is absent from generated inventory: ${path}`,
        });
  for (const manifest of manifests) {
    for (const edge of manifest.graph.edges) {
      const producers = inventory.receiptProducers.filter(
        (entry) =>
          entry.journeyId === manifest.id &&
          entry.from === edge.from &&
          entry.to === edge.to &&
          entry.receiptKind === edge.receiptKind &&
          entry.contractIdentity === edge.id,
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
          (entry) =>
            entry.journeyId === manifest.id &&
            entry.from === edge.from &&
            entry.to === edge.to &&
            entry.receiptKind === edge.receiptKind &&
            entry.contractIdentity === edge.id,
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
      const allowedEntrypoints = new Set(
        manifest.legacyExposure.existingEntrypoints,
      );
      for (const path of manifest.releaseEntrypoints)
        if (!allowedEntrypoints.has(path))
          diagnostics.push({
            code: "LEGACY_EXPANSION",
            journeyId: manifest.id,
            path,
            message: `manifest release entrypoint exceeds legacy exposure: ${path}`,
          });
      if (manifest.legacyExposure.removalMilestone < inventory.today)
        diagnostics.push({
          code: "LEGACY_MILESTONE_EXPIRED",
          journeyId: manifest.id,
          message: `legacy removal milestone expired: ${manifest.legacyExposure.removalMilestone}`,
        });
    }
  }
  const legacyManifests = manifests.filter(
    (manifest) =>
      manifest.status === "legacy_exposed" &&
      manifest.legacyExposure !== undefined,
  );
  for (const path of inventory.legacyEntrypoints) {
    const owner = legacyManifests.find((manifest) =>
      manifest.releaseEntrypoints.includes(path),
    );
    const permitted = legacyManifests.some(
      (manifest) =>
        manifest.legacyExposure?.existingEntrypoints.includes(path) === true,
    );
    if (!permitted)
      diagnostics.push({
        code: "LEGACY_EXPANSION",
        journeyId: owner?.id ?? "catalog",
        path,
        message: `generated reachability exceeds the legacy baseline: ${path}`,
      });
  }
  const coverageRank = {
    "read-only": 0,
    stateful: 1,
    "high-risk": 2,
  } as const;
  const authorityWitnesses = inventory.surfaceAuthorities;
  const validAuthorities = new Set<ReleaseSurfaceAuthority>();
  if (authorityWitnesses !== undefined) {
    for (const path of inventory.releaseEntrypoints) {
      const witnesses = authorityWitnesses.filter(
        (authority) => authority.path === path,
      );
      const witness = witnesses[0];
      const owners = manifests.filter((manifest) =>
        manifest.releaseEntrypoints.includes(path),
      );
      if (
        witness === undefined ||
        witnesses.length !== 1 ||
        owners.length !== 1 ||
        witness.journeyId !== owners[0]?.id
      ) {
        diagnostics.push({
          code: "SURFACE_UNCLASSIFIED",
          journeyId: owners[0]?.id ?? witness?.journeyId ?? "catalog",
          path,
          message:
            "generated release entrypoint must join to exactly one matching owner authority witness",
        });
      } else {
        validAuthorities.add(witness);
      }
    }
  }
  for (const authority of authorityWitnesses ?? []) {
    if (!inventory.releaseEntrypoints.includes(authority.path)) {
      diagnostics.push({
        code: "SURFACE_UNCLASSIFIED",
        journeyId: authority.journeyId,
        path: authority.path,
        message:
          "surface authority witness does not name a generated entrypoint",
      });
      continue;
    }
    if (!validAuthorities.has(authority)) continue;
    const manifest = byId.get(authority.journeyId);
    if (manifest === undefined) {
      diagnostics.push({
        code: "SURFACE_UNCLASSIFIED",
        journeyId: authority.journeyId,
        path: authority.path,
        message: `surface authority names an unknown journey: ${authority.journeyId}`,
      });
      continue;
    }
    const minimumCoverage =
      authority.authority === "external_dispatch" ||
      authority.transport === "non_local"
        ? "high-risk"
        : authority.authority === "write" || authority.authority === "async"
          ? "stateful"
          : "read-only";
    if (
      coverageRank[manifest.coverageProfile] < coverageRank[minimumCoverage]
    ) {
      diagnostics.push({
        code: "COVERAGE_REDUCED",
        journeyId: manifest.id,
        path: authority.path,
        message: `surface authority requires coverageProfile ${minimumCoverage}`,
      });
    }
    if (
      (authority.authority === "external_dispatch" ||
        authority.authority === "async" ||
        authority.transport === "non_local") &&
      manifest.releaseProof !== "deployed-proof-required"
    ) {
      diagnostics.push({
        code: "COVERAGE_REDUCED",
        journeyId: manifest.id,
        path: authority.path,
        message:
          "surface authority requires releaseProof deployed-proof-required",
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
    const node = queue.shift();
    if (node === undefined) break;
    if (node === target) return true;
    for (const edge of manifest.graph.edges)
      if (edge.from === node && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
  }
  return false;
};
