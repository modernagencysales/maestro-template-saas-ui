import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  compileProductContractSource,
  type ContractLifecycle,
  type ContractSource,
  type ExpectedPickle,
  type StablePickleKey,
} from "../../packages/template-core/src/productContract";
import type { PublicSurface } from "../../packages/template-core/src/publicSurface";
import {
  compareAuthPolicyStrength,
  resolveAuthPolicy,
  type AuthPolicy,
} from "../../packages/convex/confect/capabilities/_kit/authPolicies";

export type ContractInventory = {
  readonly schemaVersion: 1;
  readonly sources: readonly ContractSource[];
  readonly pickles: readonly ExpectedPickle[];
  readonly admittedPickleKeys: readonly StablePickleKey[];
  readonly journeys: Readonly<Record<string, ContractLifecycle>>;
  readonly authPolicyDeltas: readonly {
    readonly surfaceId: string;
    readonly basePolicyId: `auth_${string}`;
    readonly candidatePolicyId: `auth_${string}`;
    readonly comparison: "weaker" | "incomparable";
  }[];
};

type CompiledRepository = {
  readonly sources: readonly ContractSource[];
  readonly pickles: readonly ExpectedPickle[];
};

const repositoryPath = (root: string, path: string): string =>
  relative(root, path).split(sep).join("/");

const featurePaths = (root: string): readonly string[] => {
  const start = join(root, "features");
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(start, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const visit = (
    directory: string,
    directoryEntries: typeof entries,
  ): readonly string[] =>
    directoryEntries.flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink() || lstatSync(path).isSymbolicLink())
        throw new Error(
          `contract source must not be a symlink: ${repositoryPath(root, path)}`,
        );
      if (entry.isDirectory())
        return visit(path, readdirSync(path, { withFileTypes: true }));
      return entry.isFile() && entry.name.endsWith(".feature")
        ? [repositoryPath(root, path)]
        : [];
    });
  return [...visit(start, entries)].sort((left, right) =>
    left.localeCompare(right),
  );
};

const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });

const protectedFeaturePaths = (
  root: string,
  protectedBaseSha: string,
): readonly string[] => {
  const output = git(root, [
    "ls-tree",
    "-r",
    "--name-only",
    protectedBaseSha,
    "--",
    "features",
  ]).toString("utf8");
  return output
    .split("\n")
    .filter((path) => path.endsWith(".feature"))
    .sort((left, right) => left.localeCompare(right));
};

const assertUniqueSources = (sources: readonly ContractSource[]): void => {
  const paths = new Map<string, string>();
  const journeys = new Map<string, string>();
  for (const source of sources) {
    const folded = source.uri.normalize("NFC").toLocaleLowerCase("en-US");
    const priorPath = paths.get(folded);
    if (priorPath !== undefined)
      throw new Error(
        `normalized contract path collision: ${priorPath}, ${source.uri}`,
      );
    paths.set(folded, source.uri);
    const priorJourney = journeys.get(source.journeyId);
    if (priorJourney !== undefined)
      throw new Error(
        `duplicate journey ${source.journeyId}: ${priorJourney}, ${source.uri}`,
      );
    journeys.set(source.journeyId, source.uri);
  }
};

const compileRepository = (
  paths: readonly string[],
  read: (path: string) => Uint8Array,
): CompiledRepository => {
  const compiled = paths.map((uri) =>
    compileProductContractSource({ bytes: read(uri), uri }),
  );
  const sources = compiled.map((contract) => contract.source);
  assertUniqueSources(sources);
  return {
    sources,
    pickles: compiled.flatMap((contract) => contract.pickles),
  };
};

const lifecycleByJourney = (
  sources: readonly ContractSource[],
): ReadonlyMap<string, ContractLifecycle> =>
  new Map(sources.map((source) => [source.journeyId, source.lifecycle]));

const assertLifecycleTransitions = (
  protectedBase: CompiledRepository,
  candidate: CompiledRepository,
): void => {
  const base = lifecycleByJourney(protectedBase.sources);
  const next = lifecycleByJourney(candidate.sources);
  for (const [journey, lifecycle] of base) {
    const candidateLifecycle = next.get(journey);
    const allowed =
      lifecycle === "assembling"
        ? candidateLifecycle === undefined ||
          candidateLifecycle === "assembling" ||
          candidateLifecycle === "admitted" ||
          candidateLifecycle === "suspended"
        : lifecycle === "admitted"
          ? candidateLifecycle === "admitted" ||
            candidateLifecycle === "suspended"
          : candidateLifecycle === "suspended" ||
            candidateLifecycle === "admitted";
    if (!allowed)
      throw new Error(
        `${journey} lifecycle transition ${lifecycle} -> ${candidateLifecycle ?? "deleted"} is forbidden`,
      );
    if (lifecycle === "suspended" && candidateLifecycle === "suspended") {
      const baseSource = protectedBase.sources.find(
        (source) => source.journeyId === journey,
      );
      const candidateSource = candidate.sources.find(
        (source) => source.journeyId === journey,
      );
      if (baseSource === undefined || candidateSource === undefined)
        throw new Error(`${journey} suspended tombstone source is missing`);
      const prose = (
        repository: CompiledRepository,
        source: ContractSource,
      ) => ({
        featureName: source.featureName,
        description: source.description,
        pickles: repository.pickles
          .filter((pickle) => pickle.journeyId === journey)
          .map((pickle) => ({
            name: pickle.name,
            steps: pickle.steps.map((step) => ({
              type: step.type,
              text: step.text,
              argument: step.argument ?? null,
            })),
          })),
      });
      if (
        JSON.stringify(prose(protectedBase, baseSource)) !==
        JSON.stringify(prose(candidate, candidateSource))
      )
        throw new Error(
          `${journey} suspended tombstone must retain its behavioral prose`,
        );
    }
  }
  for (const [journey, lifecycle] of next)
    if (!base.has(journey) && lifecycle !== "assembling")
      throw new Error(`${journey} cannot transition absent -> ${lifecycle}`);
};

const readSurfaceInventory = (
  bytes: Uint8Array,
  context: string,
): readonly PublicSurface[] => {
  const parsed = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as {
    readonly surfaces?: unknown;
  };
  if (!Array.isArray(parsed.surfaces))
    throw new Error(
      `${context} public surface inventory has no surfaces array`,
    );
  return parsed.surfaces as readonly PublicSurface[];
};

const currentSurfacePath =
  "packages/template-core/src/generated/public-surfaces.generated.json";
const authPolicySourcePath =
  "packages/convex/confect/capabilities/_kit/authPolicies.ts";

const parseAuthPolicyRegistry = (
  source: string,
): ReadonlyMap<string, AuthPolicy> => {
  const policies = new Map<string, AuthPolicy>();
  const blocks = source.matchAll(/policy\(\{([\s\S]*?)\n\s*\}\)/gu);
  for (const match of blocks) {
    const body = match[1];
    if (body === undefined) continue;
    const read = (name: string): string | undefined =>
      body.match(new RegExp(`\\b${name}:\\s*"([^"]+)"`, "u"))?.[1];
    const id = read("id");
    const credential = read("credential");
    const principalKind = read("principalKind");
    const tenantAuthority = read("tenantAuthority");
    const scopes = body.match(/requiredScopes:\s*\[([^\]]*)\]/u)?.[1] ?? "";
    if (
      id === undefined ||
      credential === undefined ||
      principalKind === undefined ||
      tenantAuthority === undefined
    )
      continue;
    const minimumRole = read("minimumRole");
    policies.set(id, {
      id: id as AuthPolicy["id"],
      credential: credential as AuthPolicy["credential"],
      principalKind: principalKind as AuthPolicy["principalKind"],
      tenantAuthority: tenantAuthority as AuthPolicy["tenantAuthority"],
      ...(minimumRole === undefined
        ? {}
        : {
            minimumRole: minimumRole as NonNullable<AuthPolicy["minimumRole"]>,
          }),
      requiredScopes: [...scopes.matchAll(/"([^"]+)"/gu)].map(
        (scope) => scope[1] as AuthPolicy["requiredScopes"][number],
      ),
    });
  }
  return policies;
};

const readAuthPolicyRegistry = (
  source: string | undefined,
): ReadonlyMap<string, AuthPolicy> | undefined =>
  source === undefined ? undefined : parseAuthPolicyRegistry(source);

const surfaceMaps = (surfaces: readonly PublicSurface[]) => {
  const byId = new Map<string, PublicSurface>();
  const byCoverage = new Map<string, PublicSurface>();
  for (const surface of surfaces) {
    if (byId.has(surface.id))
      throw new Error(`duplicate public surface id: ${surface.id}`);
    if (byCoverage.has(surface.coverageTag))
      throw new Error(`duplicate coverage alias: ${surface.coverageTag}`);
    byId.set(surface.id, surface);
    byCoverage.set(surface.coverageTag, surface);
  }
  return { byId, byCoverage };
};

const assertCoverage = (
  candidate: CompiledRepository,
  surfaces: readonly PublicSurface[],
): void => {
  const { byCoverage } = surfaceMaps(surfaces);
  const journeys = lifecycleByJourney(candidate.sources);
  for (const surface of surfaces) {
    if (
      surface.activationJourneyId !== undefined &&
      !journeys.has(surface.activationJourneyId)
    )
      throw new Error(
        `surface ${surface.id} has unknown activation owner ${surface.activationJourneyId}`,
      );
    if (resolveAuthPolicy(surface.authPolicyId) === undefined)
      throw new Error(
        `surface ${surface.id} has unknown auth policy ${surface.authPolicyId}`,
      );
  }
  for (const pickle of candidate.pickles) {
    for (const tag of pickle.coverageTags) {
      const surface = byCoverage.get(tag);
      if (surface === undefined) {
        if (pickle.lifecycle === "admitted")
          throw new Error(`${pickle.journeyId} has unresolved coverage ${tag}`);
        continue;
      }
      if (!pickle.transports.includes(surface.transport))
        throw new Error(
          `${pickle.journeyId} ${tag} is incompatible with ${surface.transport} transport`,
        );
    }
  }

  for (const source of candidate.sources) {
    if (source.lifecycle !== "admitted") continue;
    const owned = surfaces.filter(
      (surface) => surface.activationJourneyId === source.journeyId,
    );
    if (owned.length === 0)
      throw new Error(
        `${source.journeyId} cannot be admitted without an activation-owned public surface`,
      );
    for (const surface of owned) {
      const covering = candidate.pickles.filter(
        (pickle) =>
          pickle.journeyId === source.journeyId &&
          pickle.coverageTags.includes(surface.coverageTag) &&
          pickle.transports.includes(surface.transport),
      );
      const policy = resolveAuthPolicy(surface.authPolicyId);
      if (policy === undefined) continue;
      if (!covering.some((pickle) => pickle.denialTags.length === 0))
        throw new Error(
          `${surface.id} requires a positive ${surface.transport} Pickle`,
        );
      if (
        policy.credential !== "public" &&
        !covering.some((pickle) =>
          pickle.denialTags.includes("@authentication"),
        )
      )
        throw new Error(
          `${surface.id} requires an authentication denial Pickle`,
        );
      if (
        (policy.minimumRole !== undefined ||
          policy.requiredScopes.length > 0) &&
        !covering.some((pickle) => pickle.denialTags.includes("@authorization"))
      )
        throw new Error(
          `${surface.id} requires an authorization denial Pickle`,
        );
      if (
        policy.tenantAuthority !== "none" &&
        !covering.some((pickle) =>
          pickle.denialTags.includes("@tenant-isolation"),
        )
      )
        throw new Error(
          `${surface.id} requires a tenant-isolation denial Pickle`,
        );
    }
    const ownedTransports = new Set(owned.map((surface) => surface.transport));
    if (ownedTransports.size > 1) {
      for (const transport of ownedTransports)
        if (
          !candidate.pickles.some(
            (pickle) =>
              pickle.journeyId === source.journeyId &&
              pickle.transports.includes(transport),
          )
        )
          throw new Error(`${source.journeyId} has no ${transport} Pickle`);
      const crossSurface = candidate.pickles.some(
        (pickle) =>
          pickle.journeyId === source.journeyId &&
          pickle.crossSurface &&
          [...ownedTransports].every((transport) =>
            pickle.transports.includes(transport),
          ),
      );
      if (!crossSurface)
        throw new Error(
          `${source.journeyId} requires one cross-surface Pickle`,
        );
    }
  }
};

/** Proves the zero-admission projection cannot leave an activation-owned
 * registration live. Shared surfaces may remain available. */
export const assertNoAdmittedActivationOwnedSurfaces = (
  journeys: Readonly<Record<string, ContractLifecycle>>,
  surfaces: readonly PublicSurface[],
): void => {
  for (const surface of surfaces) {
    const owner = surface.activationJourneyId;
    if (owner !== undefined && journeys[owner] === "admitted")
      throw new Error(
        `no-admitted projection contains activation-owned surface ${surface.id}`,
      );
  }
};

const authPolicyDeltas = (
  base: readonly PublicSurface[],
  candidate: readonly PublicSurface[],
  basePolicies?: ReadonlyMap<string, AuthPolicy>,
  candidatePolicies?: ReadonlyMap<string, AuthPolicy>,
): ContractInventory["authPolicyDeltas"] => {
  const baseById = surfaceMaps(base).byId;
  return candidate.flatMap((surface) => {
    const previous = baseById.get(surface.id);
    if (previous === undefined) return [];
    if (
      previous.authPolicyId === surface.authPolicyId &&
      (basePolicies === undefined || candidatePolicies === undefined)
    )
      return [];
    const basePolicy =
      basePolicies?.get(previous.authPolicyId) ??
      resolveAuthPolicy(previous.authPolicyId);
    const candidatePolicy =
      candidatePolicies?.get(surface.authPolicyId) ??
      resolveAuthPolicy(surface.authPolicyId);
    if (basePolicy === undefined || candidatePolicy === undefined) return [];
    const comparison = compareAuthPolicyStrength(basePolicy, candidatePolicy);
    return comparison === "weaker" || comparison === "incomparable"
      ? [
          {
            surfaceId: surface.id,
            basePolicyId: previous.authPolicyId,
            candidatePolicyId: surface.authPolicyId,
            comparison,
          },
        ]
      : [];
  });
};

export function compileContractInventory(input: {
  readonly root: string;
  readonly protectedBaseSha: string;
  readonly mode: "authoritative" | "focused" | "static";
}): ContractInventory {
  const paths = featurePaths(input.root);
  const candidate = compileRepository(paths, (path) =>
    readFileSync(join(input.root, path)),
  );
  const candidateSurfaces = readSurfaceInventory(
    readFileSync(join(input.root, currentSurfacePath)),
    "candidate",
  );
  let deltas: ContractInventory["authPolicyDeltas"] = [];
  if (input.mode === "authoritative") {
    if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(input.protectedBaseSha))
      throw new Error(
        "authoritative contract compilation requires an immutable protected-base SHA",
      );
    const protectedBase = compileRepository(
      protectedFeaturePaths(input.root, input.protectedBaseSha),
      (path) => git(input.root, ["show", `${input.protectedBaseSha}:${path}`]),
    );
    assertLifecycleTransitions(protectedBase, candidate);
    const baseSurfaces = readSurfaceInventory(
      git(input.root, [
        "show",
        `${input.protectedBaseSha}:${currentSurfacePath}`,
      ]),
      "protected base",
    );
    let candidatePolicySource: string | undefined;
    let basePolicySource: string | undefined;
    try {
      candidatePolicySource = readFileSync(
        join(input.root, authPolicySourcePath),
        "utf8",
      );
      basePolicySource = git(input.root, [
        "show",
        `${input.protectedBaseSha}:${authPolicySourcePath}`,
      ]).toString("utf8");
    } catch (error) {
      const changedPolicyId = candidateSurfaces.some((surface) => {
        const previous = baseSurfaces.find((entry) => entry.id === surface.id);
        return (
          previous !== undefined &&
          previous.authPolicyId !== surface.authPolicyId
        );
      });
      if (changedPolicyId)
        throw new Error(
          `authoritative auth-policy material is unavailable from protected base: ${String(error)}`,
        );
      candidatePolicySource = undefined;
      basePolicySource = undefined;
    }
    const basePolicies = readAuthPolicyRegistry(basePolicySource);
    const candidatePolicies = readAuthPolicyRegistry(candidatePolicySource);
    if (basePolicies !== undefined && candidatePolicies !== undefined)
      deltas = authPolicyDeltas(
        baseSurfaces,
        candidateSurfaces,
        basePolicies,
        candidatePolicies,
      );
  }
  assertCoverage(candidate, candidateSurfaces);
  const sortedSources = [...candidate.sources].sort((left, right) =>
    left.uri.localeCompare(right.uri),
  );
  const sortedPickles = [...candidate.pickles].sort(
    (left, right) =>
      left.sourceUri.localeCompare(right.sourceUri) ||
      left.scenarioLocation.line - right.scenarioLocation.line ||
      (left.examplesRowLocation?.line ?? 0) -
        (right.examplesRowLocation?.line ?? 0),
  );
  const journeys = Object.fromEntries(
    [...sortedSources]
      .sort((left, right) => left.journeyId.localeCompare(right.journeyId))
      .map((source) => [source.journeyId, source.lifecycle]),
  );
  return {
    schemaVersion: 1,
    sources: sortedSources,
    pickles: sortedPickles,
    admittedPickleKeys: sortedPickles
      .filter((pickle) => pickle.lifecycle === "admitted")
      .map((pickle) => pickle.key),
    journeys,
    authPolicyDeltas: deltas,
  };
}

export const renderAdmittedJourneys = (
  inventory: Pick<ContractInventory, "journeys">,
): string => {
  const lines = Object.entries(inventory.journeys)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([journey, lifecycle]) =>
        `  ${JSON.stringify(journey)}: ${lifecycle === "admitted" ? "true" : "false"},`,
    );
  return `/* Generated by pnpm acceptance:check --write. Do not edit by hand. */\n\nexport const admittedJourneys = {\n${lines.join("\n")}\n} as const;\n`;
};
