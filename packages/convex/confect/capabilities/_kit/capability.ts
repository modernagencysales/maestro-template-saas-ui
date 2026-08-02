import { FunctionSpec } from "@confect/core";
import * as Schema from "effect/Schema";
import { type Role } from "../../access/roles";
import { WorkspaceReadErrors, WorkspaceWriteErrors } from "./errors";
import {
  type HeadlessSurface,
  exposeSurfaces,
  type SurfacePolicy,
} from "./surfaces";

export type CapabilityKind = "query" | "mutation" | "action";

export type ContractSurface =
  "api" | "cli" | "mcp" | "web" | "workflow" | "internal";
export type ContractFunctionKind = CapabilityKind;

export type SerializableContractManifest = {
  readonly namespace: string;
  readonly name: string;
  readonly operationId: string;
  readonly kind: ContractFunctionKind;
  readonly surfaces: readonly ContractSurface[];
  readonly typedErrors: readonly string[];
  readonly idempotent: boolean;
  readonly argsSchemaName: string;
  readonly returnsSchemaName: string;
};

export type ContractSpecManifest = SerializableContractManifest & {
  readonly argsSchema: Schema.Top;
  readonly returnsSchema: Schema.Top;
};

export type ContractSchemaRegistry = Readonly<Record<string, Schema.Top>>;

export type ManifestBoundFunction<Spec> = {
  readonly spec: Spec;
  readonly manifest: ContractSpecManifest;
};

export const defineContractFunction = <Spec>(
  spec: Spec,
  manifest: ContractSpecManifest,
): ManifestBoundFunction<Spec> => ({ spec, manifest });

export const collectContractManifest = (
  functions: readonly ManifestBoundFunction<unknown>[],
): readonly SerializableContractManifest[] =>
  functions.map((entry) => ({
    namespace: entry.manifest.namespace,
    name: entry.manifest.name,
    operationId: entry.manifest.operationId,
    kind: entry.manifest.kind,
    surfaces: entry.manifest.surfaces,
    typedErrors: entry.manifest.typedErrors,
    idempotent: entry.manifest.idempotent,
    argsSchemaName: entry.manifest.argsSchemaName,
    returnsSchemaName: entry.manifest.returnsSchemaName,
  }));

export const collectContractSchemas = (
  functions: readonly ManifestBoundFunction<unknown>[],
): ContractSchemaRegistry =>
  Object.fromEntries(
    functions.flatMap((entry) => [
      [entry.manifest.argsSchemaName, entry.manifest.argsSchema],
      [entry.manifest.returnsSchemaName, entry.manifest.returnsSchema],
    ]),
  );

export interface CapabilityMeta {
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly minimumRole: Role;
  readonly surfaces: SurfacePolicy;
  readonly headless: readonly HeadlessSurface[];
  readonly idempotent: boolean;
}

export interface CapabilityMetaInput {
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly minimumRole: Role;
  readonly surfaces?: SurfacePolicy;
  readonly headless?: readonly HeadlessSurface[];
  readonly idempotent?: boolean;
}

export const capabilityMeta = (input: CapabilityMetaInput): CapabilityMeta => {
  const headless = input.headless ?? [];

  return {
    name: input.name,
    kind: input.kind,
    minimumRole: input.minimumRole,
    headless,
    surfaces: input.surfaces ?? exposeSurfaces(headless),
    idempotent: input.idempotent ?? input.kind === "query",
  };
};

export function publicErrorForKind(kind: "query"): typeof WorkspaceReadErrors;
export function publicErrorForKind(
  kind: "mutation" | "action",
): typeof WorkspaceWriteErrors;
export function publicErrorForKind(kind: CapabilityKind) {
  return kind === "query" ? WorkspaceReadErrors : WorkspaceWriteErrors;
}

type SchemaThunk<T extends Schema.Codec<unknown, unknown>> = () => T;

interface FunctionSpecInput<
  Name extends string,
  Args extends Schema.Codec<unknown, unknown>,
  Returns extends Schema.Codec<unknown, unknown>,
> {
  readonly name: Name;
  readonly args: SchemaThunk<Args>;
  readonly returns: SchemaThunk<Returns>;
}

export const publicQuery = <
  const Name extends string,
  Args extends Schema.Codec<unknown, unknown>,
  Returns extends Schema.Codec<unknown, unknown>,
>(
  input: FunctionSpecInput<Name, Args, Returns>,
) =>
  FunctionSpec.publicQuery({
    ...input,
    error: () => publicErrorForKind("query"),
  });

export const publicMutation = <
  const Name extends string,
  Args extends Schema.Codec<unknown, unknown>,
  Returns extends Schema.Codec<unknown, unknown>,
>(
  input: FunctionSpecInput<Name, Args, Returns>,
) =>
  FunctionSpec.publicMutation({
    ...input,
    error: () => publicErrorForKind("mutation"),
  });

export const internalMutationStep = <
  const Name extends string,
  Args extends Schema.Codec<unknown, unknown>,
  Returns extends Schema.Codec<unknown, unknown>,
>(
  input: FunctionSpecInput<Name, Args, Returns>,
) =>
  FunctionSpec.internalMutation({
    ...input,
    error: () => publicErrorForKind("mutation"),
  });
