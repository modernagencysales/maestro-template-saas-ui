export const SYSTEM_CATALOG_SCHEMA_VERSION = 1 as const;

export type SystemKind = "product-system" | "shared-primitive";
export type SystemLifecycle = "active" | "retiring" | "retired";
export type SystemImplementationStatus = "real" | "mixed" | "fixture";

export type CanonicalSystem = {
  readonly id: string;
  readonly name: string;
  readonly kind: SystemKind;
  readonly lifecycle: SystemLifecycle;
  readonly implementationStatus: SystemImplementationStatus;
  readonly summary: string;
  readonly responsibilities: readonly string[];
  readonly aliases: readonly string[];
  readonly tables: readonly string[];
  readonly canonicalEntrypoints: readonly string[];
  readonly decisionRef: string;
};

export type SystemCatalog = {
  readonly schemaVersion: typeof SYSTEM_CATALOG_SCHEMA_VERSION;
  readonly systems: readonly CanonicalSystem[];
};

type UnknownRecord = Record<string, unknown>;

const SYSTEM_KINDS = ["product-system", "shared-primitive"] as const;
const SYSTEM_LIFECYCLES = ["active", "retiring", "retired"] as const;
const IMPLEMENTATION_STATUSES = ["real", "mixed", "fixture"] as const;

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

const textList = (
  value: unknown,
  label: string,
  options?: { readonly allowEmpty?: boolean },
): readonly string[] => {
  if (!Array.isArray(value) || (!options?.allowEmpty && value.length === 0)) {
    throw new RangeError(`${label} must be a nonempty array`);
  }

  const values = value.map((entry) => text(entry, label));
  if (new Set(values).size !== values.length) {
    throw new RangeError(`${label} must not contain duplicates`);
  }

  return Object.freeze(values);
};

const member = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] => {
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new RangeError(`invalid ${label}`);
  }

  return match;
};

const parseSystem = (value: unknown): CanonicalSystem => {
  const input = record(value, "canonical system");

  return Object.freeze({
    id: text(input.id, "system id"),
    name: text(input.name, "system name"),
    kind: member(input.kind, SYSTEM_KINDS, "system kind"),
    lifecycle: member(input.lifecycle, SYSTEM_LIFECYCLES, "system lifecycle"),
    implementationStatus: member(
      input.implementationStatus,
      IMPLEMENTATION_STATUSES,
      "system implementation status",
    ),
    summary: text(input.summary, "system summary"),
    responsibilities: textList(
      input.responsibilities,
      "system responsibilities",
    ),
    aliases: textList(input.aliases, "system aliases", { allowEmpty: true }),
    tables: textList(input.tables, "system tables", { allowEmpty: true }),
    canonicalEntrypoints: textList(
      input.canonicalEntrypoints,
      "canonical entrypoints",
    ),
    decisionRef: text(input.decisionRef, "system decision ref"),
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

export const normalizeSystemLookup = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const parseSystemCatalog = (value: unknown): SystemCatalog => {
  const input = record(value, "system catalog");
  if (input.schemaVersion !== SYSTEM_CATALOG_SCHEMA_VERSION) {
    throw new RangeError("invalid system catalog schema version");
  }
  if (!Array.isArray(input.systems) || input.systems.length === 0) {
    throw new RangeError("system catalog must contain systems");
  }

  const systems = Object.freeze(input.systems.map(parseSystem));
  const duplicateIds = duplicates(systems.map((system) => system.id));
  if (duplicateIds.length > 0) {
    throw new RangeError(`duplicate system ids: ${duplicateIds.join(", ")}`);
  }

  const lookupOwners = new Map<string, string>();
  for (const system of systems) {
    for (const lookup of [system.id, system.name, ...system.aliases]) {
      const normalized = normalizeSystemLookup(lookup);
      const owner = lookupOwners.get(normalized);
      if (owner !== undefined && owner !== system.id) {
        throw new RangeError(
          `system lookup ${JSON.stringify(lookup)} is shared by ${owner} and ${system.id}`,
        );
      }
      lookupOwners.set(normalized, system.id);
    }
  }

  for (const [label, values] of [
    ["table", systems.flatMap((system) => system.tables)],
    ["responsibility", systems.flatMap((system) => system.responsibilities)],
  ] as const) {
    const repeated = duplicates(values);
    if (repeated.length > 0) {
      throw new RangeError(
        `duplicate ${label} ownership: ${repeated.join(", ")}`,
      );
    }
  }

  return Object.freeze({
    schemaVersion: SYSTEM_CATALOG_SCHEMA_VERSION,
    systems,
  });
};

export const canonicalSystemById = (
  catalog: SystemCatalog,
  id: string,
): CanonicalSystem => {
  const system = catalog.systems.find((candidate) => candidate.id === id);
  if (system === undefined) {
    throw new RangeError(
      `Unknown canonical system ${JSON.stringify(id)}. Run pnpm template:systems to inspect valid system IDs.`,
    );
  }

  return system;
};

export const findCanonicalSystems = (
  catalog: SystemCatalog,
  query: string,
): readonly CanonicalSystem[] => {
  const normalizedQuery = normalizeSystemLookup(query);
  if (normalizedQuery.length === 0) {
    return catalog.systems;
  }

  return catalog.systems.filter((system) =>
    [
      system.id,
      system.name,
      ...system.aliases,
      ...system.tables,
      ...system.responsibilities,
    ].some((value) => normalizeSystemLookup(value) === normalizedQuery),
  );
};
