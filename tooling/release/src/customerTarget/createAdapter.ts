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

export type CustomerCurrentAdapterOptions = CustomerReleaseAdapterOptions & {
  readonly blueprintId: string;
  readonly blueprintProvenance: string;
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
    },
    templateInstances,
  );
}

export function createCustomerCurrentAdapter(
  options: CustomerCurrentAdapterOptions,
) {
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
    facts: (blueprint, resolved) => currentFacts(options, blueprint, resolved),
  });
}

type CustomerMaterializationAuthority = {
  readonly assertBlueprint: (blueprint: BlueprintTargetPlan) => void;
  readonly facts: (
    blueprint: BlueprintTargetPlan,
    resolved: ResolvedRelease,
  ) => CustomerReleaseAdapterFacts;
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
          const generatedFiles = generatedEntries(
            resolved.manifest,
            resolved.sourceRoot,
            templateInstance,
          );
          const materialization = materializationRequest(
            options,
            request,
            resolved,
            generatedFiles,
            blueprint,
          );
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
          if (blueprint.digest !== state.blueprintDigest) {
            throw new CustomerReleaseAdapterError(
              "stale-preflight",
              "Blueprint target plan changed after preview.",
            );
          }
          const generatedFiles = generatedEntries(
            resolved.manifest,
            resolved.sourceRoot,
            state.templateInstance,
          );
          const request = materializationRequest(
            options,
            state.request,
            resolved,
            generatedFiles,
            blueprint,
          );
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
  options: CustomerReleaseAdapterOptions,
  blueprint: BlueprintTargetPlan,
  resolved: ResolvedRelease,
): CustomerReleaseAdapterFacts {
  const candidateCommit = resolveCleanCandidateCommit(options.repositoryRoot);
  const authorityChecksum = sha256(
    JSON.stringify({
      kind: "unreleased-current-composition",
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
    version: "unreleased-current",
    tag: "unreleased-current",
    sourceCommit: candidateCommit,
    sourceChecksum: authorityChecksum,
    cliCompatibility: "unreleased-current",
    agentPackCompatibility: "unreleased-current",
    ownershipManifest: "unreleased-current-composition",
    ownershipManifestChecksum: authorityChecksum,
    extensionSeams,
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

function materializationRequest(
  options: CustomerReleaseAdapterOptions,
  request: PrepareRequest,
  resolvedRelease: ResolvedRelease,
  generatedFiles: Readonly<Record<string, Buffer>>,
  blueprint: ReturnType<typeof validateBlueprintTargetPlan>,
): CustomerMaterializationRequest {
  return {
    manifest: resolvedRelease.manifest,
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
