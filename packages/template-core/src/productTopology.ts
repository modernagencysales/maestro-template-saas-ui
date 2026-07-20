export const PRODUCT_TOPOLOGY_SCHEMA_VERSION = 1 as const;

export type ProductResourceKind =
  | "agent"
  | "capability"
  | "headless"
  | "job"
  | "provider"
  | "route"
  | "workflow";
export type ProductResourceSurface =
  "api" | "cli" | "internal" | "mcp" | "web" | "worker";
export type ProductResourceLifecycle = "active" | "retiring" | "retired";

export type ProductResource = {
  readonly id: string;
  readonly kind: ProductResourceKind;
  readonly system: string;
  readonly path: string;
  readonly responsibility: string;
  readonly surfaces: readonly ProductResourceSurface[];
  readonly uses: readonly string[];
  readonly lifecycle: ProductResourceLifecycle;
};

export type ProductTopology = {
  readonly schemaVersion: typeof PRODUCT_TOPOLOGY_SCHEMA_VERSION;
  readonly resources: readonly ProductResource[];
};

type UnknownRecord = Record<string, unknown>;

const RESOURCE_KINDS = [
  "agent",
  "capability",
  "headless",
  "job",
  "provider",
  "route",
  "workflow",
] as const;
const RESOURCE_SURFACES = [
  "api",
  "cli",
  "internal",
  "mcp",
  "web",
  "worker",
] as const;
const RESOURCE_LIFECYCLES = ["active", "retiring", "retired"] as const;

const record = (value: unknown, label: string): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${label} must be an object`);
  }
  return value as UnknownRecord;
};

const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${label} must be nonempty text`);
  }
  return value.trim();
};

const member = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] => {
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) throw new RangeError(`invalid ${label}`);
  return match;
};

const list = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
  options?: { readonly allowEmpty?: boolean },
): readonly Values[number][] => {
  if (!Array.isArray(value) || (!options?.allowEmpty && value.length === 0)) {
    throw new RangeError(`${label} must be a nonempty array`);
  }
  const parsed = value.map((entry) => member(entry, values, label));
  if (new Set(parsed).size !== parsed.length) {
    throw new RangeError(`${label} must not contain duplicates`);
  }
  return Object.freeze(parsed);
};

const textList = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value)) throw new RangeError(`${label} must be an array`);
  const parsed = value.map((entry) => text(entry, label));
  if (new Set(parsed).size !== parsed.length) {
    throw new RangeError(`${label} must not contain duplicates`);
  }
  return Object.freeze(parsed);
};

const parseResource = (value: unknown): ProductResource => {
  const input = record(value, "product resource");
  return Object.freeze({
    id: text(input.id, "product resource id"),
    kind: member(input.kind, RESOURCE_KINDS, "product resource kind"),
    system: text(input.system, "product resource system"),
    path: text(input.path, "product resource path"),
    responsibility: text(
      input.responsibility,
      "product resource responsibility",
    ),
    surfaces: list(
      input.surfaces,
      RESOURCE_SURFACES,
      "product resource surfaces",
    ),
    uses: textList(input.uses, "product resource system dependencies"),
    lifecycle: member(
      input.lifecycle,
      RESOURCE_LIFECYCLES,
      "product resource lifecycle",
    ),
  });
};

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    (seen.has(value) ? repeated : seen).add(value);
  }
  return [...repeated].sort();
};

export const parseProductTopology = (value: unknown): ProductTopology => {
  const input = record(value, "product topology");
  if (input.schemaVersion !== PRODUCT_TOPOLOGY_SCHEMA_VERSION) {
    throw new RangeError("invalid product topology schema version");
  }
  if (!Array.isArray(input.resources) || input.resources.length === 0) {
    throw new RangeError("product topology must contain resources");
  }

  const resources = Object.freeze(input.resources.map(parseResource));
  const duplicateIds = duplicates(resources.map(({ id }) => id));
  if (duplicateIds.length > 0) {
    throw new RangeError(
      `duplicate product resource ids: ${duplicateIds.join(", ")}`,
    );
  }
  const duplicatePaths = duplicates(resources.map(({ path }) => path));
  if (duplicatePaths.length > 0) {
    throw new RangeError(
      `duplicate product resource paths: ${duplicatePaths.join(", ")}`,
    );
  }
  const duplicateResponsibilities = duplicates(
    resources.map(({ responsibility }) => responsibility),
  );
  if (duplicateResponsibilities.length > 0) {
    throw new RangeError(
      `duplicate product responsibilities: ${duplicateResponsibilities.join(", ")}`,
    );
  }

  return Object.freeze({
    schemaVersion: PRODUCT_TOPOLOGY_SCHEMA_VERSION,
    resources,
  });
};
