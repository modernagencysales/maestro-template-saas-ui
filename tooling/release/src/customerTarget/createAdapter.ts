import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  safeSourceFile,
  withImmutableRelease,
  type ResolvedRelease,
} from "./createAdapter.archive.js";
import {
  CustomerReleaseAdapterError,
  assertReviewedBlueprintTargetPlan,
  failure,
  isObject,
  sha256,
  validateBlueprintTargetPlan,
  type BlueprintTargetPlan,
  type CreateFailure,
  type CustomerReleaseAdapterFacts,
  type CustomerReleaseAdapterOptions,
  type PrepareRequest,
  type PreparedRelease,
  type TokenState,
} from "./createAdapter.contract.js";
import type { CustomerReleaseManifest } from "./manifest.js";
import type { ReleaseTemplateInstanceConsumer } from "./templateInstance.js";
import {
  materializeCustomerTarget,
  previewCustomerTarget,
  type CustomerMaterializationRequest,
  type CustomerTargetPreview,
} from "./materialize.js";

export type {
  CustomerReleaseAdapterFacts,
  CustomerReleaseAdapterOptions,
} from "./createAdapter.contract.js";
export { blueprintTargetPlanDigest } from "./createAdapter.contract.js";
export {
  createReleaseTemplateInstanceConsumer,
  type ReleaseTemplateInstanceConsumer,
} from "./templateInstance.js";

export type CustomerCurrentAdapterOptions = CustomerReleaseAdapterOptions & {
  readonly blueprintId: string;
  readonly blueprintProvenance: string;
  readonly currentOmissions?: readonly string[];
};

export function createCustomerReleaseAdapter(
  options: CustomerReleaseAdapterOptions,
  templateInstances?: ReleaseTemplateInstanceConsumer,
) {
  return createCustomerAdapter(
    options,
    {
      assertBlueprint: (blueprint) =>
        assertReviewedBlueprintTargetPlan(options, blueprint),
      facts: (_blueprint, resolved) => resolved.facts,
      manifest: (resolved) => resolved.manifest,
    },
    templateInstances,
  );
}

export function createCustomerCurrentAdapter(
  options: CustomerCurrentAdapterOptions,
) {
  const currentOmissions = validateCurrentOmissions(
    options.currentOmissions ?? [],
  );
  return createCustomerAdapter(options, {
    assertBlueprint: (blueprint) => {
      if (
        blueprint.id !== options.blueprintId ||
        blueprint.provenance !== options.blueprintProvenance
      ) {
        throw new CustomerReleaseAdapterError(
          "release-unavailable",
          "Current blueprint target plan does not match the reviewed authority.",
        );
      }
    },
    facts: (blueprint, resolved) =>
      currentFacts(options, blueprint, resolved, currentOmissions),
    manifest: (resolved) =>
      currentCompositionManifest(resolved.manifest, currentOmissions),
  });
}

type CustomerMaterializationAuthority = {
  readonly assertBlueprint: (blueprint: BlueprintTargetPlan) => void;
  readonly facts: (
    blueprint: BlueprintTargetPlan,
    resolved: ResolvedRelease,
  ) => CustomerReleaseAdapterFacts;
  readonly manifest: (resolved: ResolvedRelease) => CustomerReleaseManifest;
};

function createCustomerAdapter(
  options: CustomerReleaseAdapterOptions,
  authority: CustomerMaterializationAuthority,
  templateInstances?: ReleaseTemplateInstanceConsumer,
) {
  const tokens = new WeakMap<object, TokenState>();
  return {
    prepare: async (
      request: PrepareRequest,
    ): Promise<PreparedRelease | CreateFailure> => {
      try {
        return withImmutableRelease(options, (resolved) => {
          const blueprint = validateBlueprintTargetPlan(
            request.blueprintTargetPlan(),
          );
          authority.assertBlueprint(blueprint);
          const facts = authority.facts(blueprint, resolved);
          const rawTemplateInstance = request.templateInstance(facts, {
            id: blueprint.id,
            digest: blueprint.digest,
            provenance: blueprint.provenance,
          });
          const templateInstance = templateInstances
            ? templateInstances.prepare(rawTemplateInstance)
            : rawTemplateInstance;
          const manifest = authority.manifest(resolved);
          const generatedFiles = generatedEntries(
            manifest,
            resolved.sourceRoot,
            templateInstance,
          );
          const materialization = materializationRequest({
            options,
            request,
            resolvedRelease: resolved,
            manifest,
            generatedFiles,
            blueprint,
          });
          const preview = previewCustomerTarget(materialization);
          const token = {};
          tokens.set(token, {
            request,
            templateInstance,
            blueprintDigest: blueprint.digest,
            tagCommit: resolved.tagCommit,
          });
          return {
            ok: true as const,
            token,
            facts,
            preview: projectPreview(preview),
          };
        });
      } catch (error) {
        return failure(error);
      }
    },
    materialize: async (
      token: unknown,
      preflightFingerprint: string,
    ): Promise<
      { readonly ok: true; readonly files: number } | CreateFailure
    > => {
      if (!isObject(token)) return invalidToken();
      const state = tokens.get(token);
      tokens.delete(token);
      if (!state) return invalidToken();
      try {
        return withImmutableRelease(options, (resolved) => {
          if (resolved.tagCommit !== state.tagCommit) {
            throw new CustomerReleaseAdapterError(
              "stale-preflight",
              "Resolved release tag changed after preview.",
            );
          }
          const blueprint = validateBlueprintTargetPlan(
            state.request.blueprintTargetPlan(),
          );
          authority.assertBlueprint(blueprint);
          void authority.facts(blueprint, resolved);
          if (blueprint.digest !== state.blueprintDigest) {
            throw new CustomerReleaseAdapterError(
              "stale-preflight",
              "Blueprint target plan changed after preview.",
            );
          }
          const manifest = authority.manifest(resolved);
          const generatedFiles = generatedEntries(
            manifest,
            resolved.sourceRoot,
            state.templateInstance,
          );
          const request = materializationRequest({
            options,
            request: state.request,
            resolvedRelease: resolved,
            manifest,
            generatedFiles,
            blueprint,
          });
          const preview = previewCustomerTarget(request);
          if (preview.preflightFingerprint !== preflightFingerprint) {
            throw new CustomerReleaseAdapterError(
              "stale-preflight",
              "Customer release preflight changed after preview.",
            );
          }
          const result = materializeCustomerTarget(request, preview);
          return { ok: true as const, files: result.files };
        });
      } catch (error) {
        return failure(error);
      }
    },
  };
}

function currentFacts(
  options: CustomerCurrentAdapterOptions,
  blueprint: BlueprintTargetPlan,
  resolved: ResolvedRelease,
  currentOmissions: readonly string[],
): CustomerReleaseAdapterFacts {
  const candidateCommit = resolveCleanCandidateCommit(options.repositoryRoot);
  if (candidateCommit !== resolved.tagCommit) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Current candidate HEAD must exactly match the reviewed immutable release tag.",
    );
  }
  const compositionKind = "tagged-current-composition";
  const authorityChecksum = sha256(
    JSON.stringify({
      kind: compositionKind,
      candidate: { sourceCommit: candidateCommit },
      base: {
        manifestChecksum: options.ownershipManifestChecksum,
        ...resolved.binding,
      },
      blueprint: {
        id: blueprint.id,
        provenance: blueprint.provenance,
        digest: blueprint.digest,
      },
      currentOmissions,
    }),
  );
  const extensionSeams = [
    ...resolved.manifest.extensionSeams.map(({ path }) => path),
    ...blueprint.entries
      .filter(({ ownership }) => ownership === "customer-extension")
      .map(({ path }) => path),
  ]
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .sort();
  return {
    version: resolved.facts.version,
    tag: resolved.facts.tag,
    sourceCommit: candidateCommit,
    sourceChecksum: authorityChecksum,
    cliCompatibility: resolved.facts.cliCompatibility,
    agentPackCompatibility: resolved.facts.agentPackCompatibility,
    ownershipManifest: compositionKind,
    ownershipManifestChecksum: authorityChecksum,
    extensionSeams,
  };
}

function validateCurrentOmissions(paths: readonly string[]): readonly string[] {
  const normalized = [...paths].sort();
  const invalid = normalized.find(
    (path) =>
      path.length === 0 ||
      isAbsolute(path) ||
      path.includes("\\") ||
      path
        .split("/")
        .some(
          (segment) => segment === "" || segment === "." || segment === "..",
        ),
  );
  if (invalid !== undefined || new Set(normalized).size !== normalized.length) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Current customer omission authority must contain unique safe relative paths.",
    );
  }
  return normalized;
}

function currentCompositionManifest(
  manifest: CustomerReleaseManifest,
  currentOmissions: readonly string[],
): CustomerReleaseManifest {
  const exactPaths = new Set(
    manifest.paths
      .filter(({ match }) => match === "exact")
      .map(({ path }) => path),
  );
  const conflict = currentOmissions.find((path) => exactPaths.has(path));
  if (conflict !== undefined) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      `Current customer omission overlaps reviewed exact authority: ${conflict}`,
    );
  }
  return {
    ...manifest,
    paths: [
      ...manifest.paths,
      ...currentOmissions.map((path) => ({
        path,
        match: "exact" as const,
        ownership: "factory-only" as const,
        action: "omit" as const,
        upgrade: "remove" as const,
      })),
    ],
  };
}
function resolveCleanCandidateCommit(repositoryRoot: string): string {
  let sourceCommit: string;
  let status: string;
  try {
    sourceCommit = execFileSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    status = execFileSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
      ],
      { encoding: "utf8" },
    ).trim();
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Current candidate Git provenance could not be resolved.",
    );
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Current candidate HEAD is not an exact Git commit.",
    );
  }
  if (status.length > 0) {
    throw new CustomerReleaseAdapterError(
      "dirty-source",
      "Current candidate source must be clean before customer creation.",
    );
  }
  return sourceCommit;
}

function invalidToken(): CreateFailure {
  return {
    ok: false,
    code: "stale-preflight",
    message: "Create release token is invalid or already consumed.",
  };
}

function generatedEntries(
  manifest: CustomerReleaseManifest,
  sourceRoot: string,
  templateInstance: string,
): Readonly<Record<string, Buffer>> {
  return Object.fromEntries(
    manifest.paths
      .filter(({ action, match }) => action === "generate" && match === "exact")
      .map(({ path }) => [
        path,
        path === "template-instance.json"
          ? Buffer.from(templateInstance)
          : readFileSync(safeSourceFile(sourceRoot, path)),
      ]),
  );
}

function materializationRequest({
  options,
  request,
  resolvedRelease,
  manifest,
  generatedFiles,
  blueprint,
}: {
  readonly options: CustomerReleaseAdapterOptions;
  readonly request: PrepareRequest;
  readonly resolvedRelease: ResolvedRelease;
  readonly manifest: CustomerReleaseManifest;
  readonly generatedFiles: Readonly<Record<string, Buffer>>;
  readonly blueprint: ReturnType<typeof validateBlueprintTargetPlan>;
}): CustomerMaterializationRequest {
  return {
    manifest,
    sourceRoot: resolvedRelease.sourceRoot,
    targetRoot: isAbsolute(request.target)
      ? resolve(request.target)
      : resolve(request.repo.workingDirectory, request.target),
    homeRoot: options.homeRoot,
    factoryRoot: request.repo.sourceRoot,
    sourceDirty: false,
    sourceRevision: resolvedRelease.binding.sourceCommit,
    generatedFiles,
    blueprintTargetPlan: {
      digest: blueprint.digest,
      entries: blueprint.entries.map(({ content, ...entry }) => ({
        ...entry,
        bytes: Buffer.from(content),
      })),
    },
    resolvedRelease: resolvedRelease.binding,
  };
}

function projectPreview(
  preview: CustomerTargetPreview,
): PreparedRelease["preview"] {
  return {
    preflightFingerprint: preview.preflightFingerprint,
    writes: preview.writes.map(({ path, bytes }) => ({ path, bytes })),
    omissions: preview.omissions,
    collisions: preview.collisions,
    totalBytes: preview.totalBytes,
  };
}
