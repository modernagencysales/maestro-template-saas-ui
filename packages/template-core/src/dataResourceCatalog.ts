export const DATA_RESOURCE_CATALOG_SCHEMA_VERSION = 1 as const;

export type DataTenantScope = "global" | "organization" | "workspace" | "user";
export type DataSensitivity =
  "public" | "internal" | "confidential" | "restricted";
export type DataExportMode =
  "markdown" | "json" | "redacted-json" | "not-applicable";
export type DataDeleteMode =
  "delete" | "redact" | "retain-audit" | "not-applicable";
export type WorkspaceRetentionAction =
  | "retain-until-workspace-delete"
  | "retain-audit-window"
  | "hash-or-redact-on-export";
export type DataRetention =
  | WorkspaceRetentionAction
  | "retain-until-account-delete"
  | "retain-until-organization-delete"
  | "retain-configuration"
  | "retain-indefinitely-no-cleanup";
export type WorkspaceLifecyclePosture = "managed" | "excluded";
export type DataWritePosture = "implemented" | "external-unavailable";

export type DataResourceDefinition = {
  readonly id: string;
  readonly system: string;
  readonly sourcePath: string;
  readonly tenantScope: DataTenantScope;
  readonly sensitivity: DataSensitivity;
  readonly pii: readonly string[];
  readonly exportMode: DataExportMode;
  readonly deleteMode: DataDeleteMode;
  readonly retention: DataRetention;
  readonly appendOnly: boolean;
  readonly writePosture: DataWritePosture;
  readonly workspaceLifecycle: WorkspaceLifecyclePosture;
  readonly writeAuthority: string;
  readonly migrationRef: string;
  readonly detail: string;
};

export type DataResourceCatalog = {
  readonly schemaVersion: typeof DATA_RESOURCE_CATALOG_SCHEMA_VERSION;
  readonly resources: readonly DataResourceDefinition[];
};

type UnknownRecord = Record<string, unknown>;

const TENANT_SCOPES = ["global", "organization", "workspace", "user"] as const;
const SENSITIVITIES = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
const EXPORT_MODES = [
  "markdown",
  "json",
  "redacted-json",
  "not-applicable",
] as const;
const DELETE_MODES = [
  "delete",
  "redact",
  "retain-audit",
  "not-applicable",
] as const;
const RETENTION_ACTIONS = [
  "retain-until-workspace-delete",
  "retain-audit-window",
  "hash-or-redact-on-export",
  "retain-until-account-delete",
  "retain-until-organization-delete",
  "retain-configuration",
  "retain-indefinitely-no-cleanup",
] as const;
const WORKSPACE_RETENTION_ACTIONS = new Set<string>([
  "retain-until-workspace-delete",
  "retain-audit-window",
  "hash-or-redact-on-export",
]);
const WORKSPACE_LIFECYCLE_POSTURES = ["managed", "excluded"] as const;
const WRITE_POSTURES = ["implemented", "external-unavailable"] as const;

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

const textList = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new RangeError(`${label} must be an array`);
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
  if (match === undefined) throw new RangeError(`invalid ${label}`);
  return match;
};

const parseResource = (value: unknown): DataResourceDefinition => {
  const input = record(value, "data resource");
  if (typeof input.appendOnly !== "boolean") {
    throw new RangeError("data resource appendOnly must be boolean");
  }

  const tenantScope = member(
    input.tenantScope,
    TENANT_SCOPES,
    "data tenant scope",
  );
  const retention = member(
    input.retention,
    RETENTION_ACTIONS,
    "data retention action",
  );
  const workspaceLifecycle = member(
    input.workspaceLifecycle,
    WORKSPACE_LIFECYCLE_POSTURES,
    "workspace lifecycle posture",
  );
  if (workspaceLifecycle === "managed" && tenantScope !== "workspace") {
    throw new RangeError(
      "managed workspace lifecycle requires workspace tenant scope",
    );
  }
  if (
    workspaceLifecycle === "managed" &&
    !WORKSPACE_RETENTION_ACTIONS.has(retention)
  ) {
    throw new RangeError(
      "managed workspace resource must use a workspace retention action",
    );
  }

  return Object.freeze({
    id: text(input.id, "data resource id"),
    system: text(input.system, "data resource system"),
    sourcePath: text(input.sourcePath, "data resource source path"),
    tenantScope,
    sensitivity: member(input.sensitivity, SENSITIVITIES, "data sensitivity"),
    pii: textList(input.pii, "data resource pii"),
    exportMode: member(input.exportMode, EXPORT_MODES, "data export mode"),
    deleteMode: member(input.deleteMode, DELETE_MODES, "data delete mode"),
    retention,
    appendOnly: input.appendOnly,
    writePosture: member(
      input.writePosture,
      WRITE_POSTURES,
      "data write posture",
    ),
    workspaceLifecycle,
    writeAuthority: text(input.writeAuthority, "data resource write authority"),
    migrationRef: text(input.migrationRef, "data resource migration ref"),
    detail: text(input.detail, "data resource detail"),
  });
};

const assertUniqueResourceIds = (
  resources: readonly DataResourceDefinition[],
): void => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const resource of resources) {
    (seen.has(resource.id) ? duplicates : seen).add(resource.id);
  }
  if (duplicates.size > 0) {
    throw new RangeError(
      `duplicate data resource ids: ${[...duplicates].sort().join(", ")}`,
    );
  }
};

export const parseDataResourceCatalog = (
  value: unknown,
): DataResourceCatalog => {
  const input = record(value, "data resource catalog");
  if (input.schemaVersion !== DATA_RESOURCE_CATALOG_SCHEMA_VERSION) {
    throw new RangeError("invalid data resource catalog schema version");
  }
  if (!Array.isArray(input.resources) || input.resources.length === 0) {
    throw new RangeError("data resource catalog must contain resources");
  }

  const resources = Object.freeze(input.resources.map(parseResource));
  assertUniqueResourceIds(resources);

  return Object.freeze({
    schemaVersion: DATA_RESOURCE_CATALOG_SCHEMA_VERSION,
    resources,
  });
};

const typescriptLiteral = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(
    /^(\s*)"([A-Za-z_$][A-Za-z0-9_$]*)":/gm,
    "$1$2:",
  );

export const renderDataResourceRuntime = (
  catalog: DataResourceCatalog,
): string => {
  const managed = catalog.resources.filter(
    (resource) => resource.workspaceLifecycle === "managed",
  );
  const ids = managed.map(({ id }) => id);
  const plans = managed.map((resource) => ({
    id: resource.id,
    owner: "workspace" as const,
    exportMode: resource.exportMode,
    deleteMode: resource.deleteMode,
    detail: resource.detail,
  }));
  const retention = managed.map((resource) => ({
    resourceId: resource.id,
    action: resource.retention,
    detail: resource.detail,
  }));

  return `// Generated by pnpm data-resources:generate. Do not edit directly.\n\n// prettier-ignore\nexport const currentLifecycleResourceIds = ${typescriptLiteral(ids)} as const;\n\n// prettier-ignore\nexport const workspaceLifecycleResourcePlans = ${typescriptLiteral(plans)} as const;\n\n// prettier-ignore\nexport const workspaceRetentionRules = ${typescriptLiteral(retention)} as const;\n`;
};
