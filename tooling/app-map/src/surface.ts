import { renderAppMapSummary, serializeAppMap } from "./build";
import { readGitChangedPaths, resolveGitComparisonBase } from "./gitDiff";
import { buildAppMapImpact } from "./impact";
import { composeAppMap, resolveRepositoryRevision } from "./composition";
import type { AppMapGroup, AppMapV1 } from "./schema";

export type AppMapSurfaceResult =
  | {
      readonly ok: true;
      readonly human: string;
      readonly data: unknown;
    }
  | {
      readonly ok: false;
      readonly human: string;
      readonly code: string;
    };

export const projectBuildReadiness = (map: AppMapV1) => ({
  schemaVersion: 1 as const,
  title: "Build Readiness",
  groups: map.groups.map(({ name, nodeIds }) => ({
    name,
    items: nodeIds.map((id) => {
      const value = map.nodes.find((candidate) => candidate.id === id);
      if (value === undefined) throw new Error(`Missing App Map node ${id}`);
      return {
        id: value.id,
        label: value.label,
        technical: {
          kind: value.kind,
          version: value.version,
          sourcePath: value.provenance.sourcePath,
          sourceDigest: value.provenance.sourceDigest,
        },
      };
    }),
  })) satisfies readonly {
    readonly name: AppMapGroup;
    readonly items: readonly unknown[];
  }[],
});

export const executeAppMapMap = async (input: {
  readonly repoRoot: string;
  readonly revision?: string;
}): Promise<AppMapSurfaceResult> => {
  const revision =
    input.revision ?? (await resolveRepositoryRevision(input.repoRoot));
  const composed = await composeAppMap({ repoRoot: input.repoRoot, revision });
  if (!composed.ok)
    return { ok: false, code: composed.code, human: `${composed.message}\n` };
  return {
    ok: true,
    human: renderAppMapSummary(composed.build.map),
    data: {
      map: composed.build.map,
      readiness: projectBuildReadiness(composed.build.map),
      bytes: serializeAppMap(composed.build.map),
    },
  };
};

export const executeAppMapImpact = async (input: {
  readonly repoRoot: string;
  readonly explicitBaseRevision?: string;
  readonly trustedCiBaseRevision?: string;
  readonly headRevision?: string;
}): Promise<AppMapSurfaceResult> => {
  const base = resolveGitComparisonBase({
    ...(input.explicitBaseRevision === undefined
      ? {}
      : { explicitBaseRevision: input.explicitBaseRevision }),
    ...(input.trustedCiBaseRevision === undefined
      ? {}
      : { trustedCiBaseRevision: input.trustedCiBaseRevision }),
  });
  if (!base.ok)
    return {
      ok: false,
      code: base.diagnostic.code,
      human: `${base.diagnostic.message}\n`,
    };
  const headRevision =
    input.headRevision ?? (await resolveRepositoryRevision(input.repoRoot));
  const changed = await readGitChangedPaths({
    repoRoot: input.repoRoot,
    baseRevision: base.baseRevision,
    headRevision,
  });
  if (!changed.ok)
    return {
      ok: false,
      code: changed.diagnostic.code,
      human: `${changed.diagnostic.message}\n`,
    };
  const composed = await composeAppMap({
    repoRoot: input.repoRoot,
    revision: headRevision,
  });
  if (!composed.ok)
    return { ok: false, code: composed.code, human: `${composed.message}\n` };
  const impact = buildAppMapImpact({
    schemaVersion: 1,
    baseRevision: base.baseRevision,
    changedPaths: changed.changedPaths,
    mapInput: composed.input,
  });
  if (!impact.ok)
    return {
      ok: false,
      code: impact.diagnostics[0]?.code ?? "APP_MAP_IMPACT_INVALID_INPUT",
      human: `${impact.diagnostics.map((item) => item.message).join(" ")}\n`,
    };
  const affected = impact.impact.affected;
  return {
    ok: true,
    human: [
      `App Map impact from ${base.baseRevision} to ${headRevision}`,
      `Changed paths: ${changed.changedPaths.length}`,
      `Screens: ${affected.routes.length}`,
      `Data: ${affected.durableData.length}`,
      `Automations: ${affected.publicContracts.length + affected.workflowVersions.length}`,
      `Connections: ${affected.providers.length + affected.headlessSurfaces.length}`,
      impact.impact.complete
        ? "Blast radius: complete"
        : `Blast radius: incomplete (${impact.impact.unknownPaths.length} unmapped path(s))`,
      "",
    ].join("\n"),
    data: impact.impact,
  };
};
