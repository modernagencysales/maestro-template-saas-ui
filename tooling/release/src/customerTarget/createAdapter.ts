import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  safeSourceFile,
  withImmutableRelease,
  type ResolvedRelease,
} from "./createAdapter.archive.js";
import {
  CustomerReleaseAdapterError,
  failure,
  isObject,
  validateBlueprintTargetPlan,
  type CreateFailure,
  type CustomerReleaseAdapterOptions,
  type PrepareRequest,
  type PreparedRelease,
  type TokenState,
} from "./createAdapter.contract.js";
import type { CustomerReleaseManifest } from "./manifest.js";
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

export function createCustomerReleaseAdapter(
  options: CustomerReleaseAdapterOptions,
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
          const templateInstance = request.templateInstance(resolved.facts, {
            id: blueprint.id,
            digest: blueprint.digest,
            provenance: blueprint.provenance,
          });
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
          });
          return {
            ok: true as const,
            token,
            facts: resolved.facts,
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
          const blueprint = validateBlueprintTargetPlan(
            state.request.blueprintTargetPlan(),
          );
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
