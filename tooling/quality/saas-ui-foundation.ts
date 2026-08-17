import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MANIFEST_PATH = "docs/template/saas-ui-upstream.json";
const DEVIATIONS_PATH = "docs/template/saas-ui-deviations.json";
const ACCEPTANCE_PATH = "docs/template/saas-ui-acceptance.json";
const REGISTRY_FILES_PATH = "docs/template/saas-ui-registry-files.json";
const PINS = {
  template: "acf0bc4be38dea842f321831387fc77cf7242439",
  starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
  pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
} as const;
const COMPOSITION_IDS = [
  "app-shell",
  "dashboard-report",
  "data-grid",
  "filterable-collection",
  "list-detail",
  "split-inbox",
  "record-aside",
  "settings",
  "form",
  "onboarding",
  "kanban",
  "showcase",
  "auth",
  "billing",
  "search-command",
  "states",
] as const;

type ReadonlyRecord = Readonly<Record<string, unknown>>;

export type SaasUiManifest = Readonly<{
  schemaVersion: 1;
  pins: Readonly<Record<keyof typeof PINS, string>>;
  registry: Readonly<{
    catalog: string;
    config: string;
    installRoot: string;
    sourceRoot?: string;
    sourceCommit: string;
    installed?: readonly string[];
  }>;
  compositions: readonly Readonly<{
    id: string;
    source: string;
    factoryDestination: string;
    generatedDestination: string;
    files: readonly Readonly<{ source: string; destination: string }>[];
  }>[];
  licenses: readonly Readonly<{
    source: "starter" | "pro";
    path: string;
    destination: string;
  }>[];
}>;

export type SaasUiAcceptanceMap = Readonly<{
  schemaVersion: 1;
  entries: readonly Readonly<{
    id: string;
    upstream: Readonly<{
      repository: "starter" | "pro";
      commit: string;
      path: string;
    }>;
    factoryDestination: string;
    generatedDestination: string;
    route: string;
    behaviorCheck: string;
    evidence: readonly string[];
  }>[];
}>;

export type SaasUiRegistryFiles = Readonly<{
  schemaVersion: 1;
  sourceCommit: string;
  installed: readonly string[];
  files: readonly Readonly<{
    source: string;
    destination: string;
    sha256: string;
  }>[];
}>;

type SaasUiComponentsConfig = Readonly<{ installed: readonly string[] }>;

function readJson(root: string, relativePath: string): unknown {
  return JSON.parse(
    readFileSync(resolve(root, relativePath), "utf8"),
  ) as unknown;
}

function record(value: unknown, label: string): ReadonlyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as ReadonlyRecord;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function readManifestValue(value: unknown): SaasUiManifest {
  const root = record(value, MANIFEST_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("manifest schemaVersion must be 1");
  const pins = record(root.pins, "manifest.pins");
  for (const key of Object.keys(PINS) as (keyof typeof PINS)[]) {
    if (pins[key] !== PINS[key])
      throw new Error(`manifest pin ${key} is not approved`);
  }
  const registry = record(root.registry, "manifest.registry");
  const compositionsValue = root.compositions;
  if (!Array.isArray(compositionsValue))
    throw new Error("manifest.compositions must be an array");
  const compositions = compositionsValue.map((value, index) => {
    const item = record(value, `manifest.compositions[${index}]`);
    const filesValue = item.files;
    if (!Array.isArray(filesValue))
      throw new Error(`manifest composition ${index} files must be an array`);
    const files = filesValue.map((fileValue, fileIndex) => {
      const file = record(
        fileValue,
        `manifest.compositions[${index}].files[${fileIndex}]`,
      );
      return {
        source: string(file.source, "file.source"),
        destination: string(file.destination, "file.destination"),
      };
    });
    return {
      id: string(item.id, "composition.id"),
      source: string(item.source, "composition.source"),
      factoryDestination: string(
        item.factoryDestination,
        "composition.factoryDestination",
      ),
      generatedDestination: string(
        item.generatedDestination,
        "composition.generatedDestination",
      ),
      files,
    };
  });
  const licensesValue = root.licenses;
  if (!Array.isArray(licensesValue))
    throw new Error("manifest.licenses must be an array");
  const licenses = licensesValue.map((value, index) => {
    const item = record(value, `manifest.licenses[${index}]`);
    const source = string(item.source, "license.source");
    if (source !== "starter" && source !== "pro")
      throw new Error(`license ${index} source must be starter or pro`);
    return {
      source,
      path: string(item.path, "license.path"),
      destination: string(item.destination, "license.destination"),
    } as const;
  });
  return {
    schemaVersion: 1,
    pins: {
      template: pins.template as string,
      starter: pins.starter as string,
      pro: pins.pro as string,
    },
    registry: {
      catalog: string(registry.catalog, "registry.catalog"),
      config: string(registry.config, "registry.config"),
      installRoot: string(registry.installRoot, "registry.installRoot"),
      ...(typeof registry.sourceRoot === "string"
        ? { sourceRoot: registry.sourceRoot }
        : {}),
      sourceCommit: string(registry.sourceCommit, "registry.sourceCommit"),
      ...(Array.isArray(registry.installed)
        ? { installed: stringArray(registry.installed, "registry.installed") }
        : {}),
    },
    compositions,
    licenses,
  };
}

export function readSaasUiManifest(root: string): SaasUiManifest {
  return readManifestValue(readJson(root, MANIFEST_PATH));
}

export function readSaasUiDeviations(root: string): readonly [] {
  const value = readJson(root, DEVIATIONS_PATH);
  if (!Array.isArray(value) || value.length > 0)
    throw new Error("Saas UI deviations must remain an empty array");
  return [];
}

function readAcceptanceValue(value: unknown): SaasUiAcceptanceMap {
  const root = record(value, ACCEPTANCE_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("acceptance schemaVersion must be 1");
  if (!Array.isArray(root.entries))
    throw new Error("acceptance.entries must be an array");
  return {
    schemaVersion: 1,
    entries: root.entries.map((entryValue, index) => {
      const entry = record(entryValue, `acceptance.entries[${index}]`);
      const upstream = record(entry.upstream, "acceptance.upstream");
      const repository = string(
        upstream.repository,
        "acceptance.upstream.repository",
      );
      if (repository !== "starter" && repository !== "pro")
        throw new Error(
          `acceptance entry ${index} repository must be starter or pro`,
        );
      return {
        id: string(entry.id, "acceptance.id"),
        upstream: {
          repository,
          commit: string(upstream.commit, "acceptance.upstream.commit"),
          path: string(upstream.path, "acceptance.upstream.path"),
        } as const,
        factoryDestination: string(
          entry.factoryDestination,
          "acceptance.factoryDestination",
        ),
        generatedDestination: string(
          entry.generatedDestination,
          "acceptance.generatedDestination",
        ),
        route: string(entry.route, "acceptance.route"),
        behaviorCheck: string(entry.behaviorCheck, "acceptance.behaviorCheck"),
        evidence: stringArray(entry.evidence, "acceptance.evidence"),
      };
    }),
  };
}

function readRegistryFilesValue(value: unknown): SaasUiRegistryFiles {
  const root = record(value, REGISTRY_FILES_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("registry files schemaVersion must be 1");
  const sourceCommit = string(root.sourceCommit, "registry files.sourceCommit");
  const installed = stringArray(root.installed, "registry files.installed");
  if (!Array.isArray(root.files))
    throw new Error("registry files.files must be an array");
  const files = root.files.map((fileValue, index) => {
    const file = record(fileValue, `registry files.files[${index}]`);
    const source = string(file.source, "registry files.source");
    const destination = string(file.destination, "registry files.destination");
    const sha256 = string(file.sha256, "registry files.sha256");
    if (!/^[a-f0-9]{64}$/.test(sha256))
      throw new Error(`registry files.files[${index}] sha256 is invalid`);
    return { source, destination, sha256 };
  });
  return { schemaVersion: 1, sourceCommit, installed, files };
}

export function readSaasUiAcceptance(root: string): SaasUiAcceptanceMap {
  return readAcceptanceValue(readJson(root, ACCEPTANCE_PATH));
}

export function readSaasUiRegistryFiles(root: string): SaasUiRegistryFiles {
  return readRegistryFilesValue(readJson(root, REGISTRY_FILES_PATH));
}

function readComponentsConfig(root: string): SaasUiComponentsConfig {
  const config = record(
    readJson(root, "apps/web/components.json"),
    "components.json",
  );
  return {
    installed: stringArray(config.installed, "components.json installed"),
  };
}

function registryIdsFromReceipt(
  registryFiles: SaasUiRegistryFiles,
): readonly string[] {
  return [
    ...new Set(
      registryFiles.files.flatMap(({ source }) => {
        if (!source.startsWith("packages/blocks/")) return [];
        const parts = source.split("/");
        const id =
          parts[2] === "hooks" ? parts[3]?.replace(/\.[^.]+$/u, "") : parts[3];
        return id ? [id] : [];
      }),
    ),
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function duplicateValues(values: readonly string[]): readonly string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

function readAuthority<T>(read: () => T, errors: string[]): T | undefined {
  try {
    return read();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function validateManifest(manifest: SaasUiManifest): readonly string[] {
  const errors: string[] = [];
  const compositionIds = manifest.compositions.map(({ id }) => id);
  if (compositionIds.join("\u0000") !== COMPOSITION_IDS.join("\u0000"))
    errors.push(
      "manifest compositions do not match the approved acceptance set",
    );
  for (const duplicate of duplicateValues(compositionIds))
    errors.push(`duplicate composition id: ${duplicate}`);
  for (const composition of manifest.compositions) {
    if (composition.files.length === 0)
      errors.push(`composition ${composition.id} has no source files`);
    for (const file of composition.files) {
      if (file.source.startsWith("/") || file.destination.startsWith("/"))
        errors.push(`composition ${composition.id} contains an absolute path`);
    }
  }
  return errors;
}

function validateAcceptance(
  acceptance: SaasUiAcceptanceMap,
  compositionIds: readonly string[],
): readonly string[] {
  const errors: string[] = [];
  const acceptanceIds = acceptance.entries.map(({ id }) => id);
  if (new Set(acceptanceIds).size !== acceptanceIds.length)
    errors.push("acceptance entries contain duplicate ids");
  if (
    new Set(acceptanceIds).size !== new Set(compositionIds).size ||
    acceptanceIds.some((id) => !compositionIds.includes(id))
  )
    errors.push("acceptance entries do not cover every composition");
  for (const entry of acceptance.entries) {
    const expectedCommit =
      entry.upstream.repository === "starter" ? PINS.starter : PINS.pro;
    if (entry.upstream.commit !== expectedCommit)
      errors.push(
        `acceptance ${entry.id} has an unpinned ${entry.upstream.repository} commit`,
      );
    if (!entry.route.startsWith("/"))
      errors.push(`acceptance ${entry.id} route must start with /`);
    if (entry.evidence.length === 0)
      errors.push(`acceptance ${entry.id} has no evidence`);
  }
  return errors;
}

function validateRegistryIds(
  registryFiles: SaasUiRegistryFiles,
  manifest: SaasUiManifest,
  components: SaasUiComponentsConfig,
): readonly string[] {
  const errors: string[] = [];
  const receiptIds = registryIdsFromReceipt(registryFiles);
  const installed = [...(manifest.registry.installed ?? [])].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  const configured = [...components.installed].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const catalog = [...registryFiles.installed].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (catalog.length === 0)
    errors.push("registry receipt installed ids must not be empty");
  if (new Set(catalog).size !== catalog.length)
    errors.push("registry receipt installed ids contain duplicates");
  if (JSON.stringify(catalog) !== JSON.stringify(receiptIds))
    errors.push("registry receipt installed ids do not match its file roots");
  if (JSON.stringify(installed) !== JSON.stringify(catalog))
    errors.push(
      "upstream manifest installed registry ids do not match the pinned receipt",
    );
  if (JSON.stringify(configured) !== JSON.stringify(catalog))
    errors.push(
      "components.json installed registry ids do not match the pinned receipt",
    );
  return errors;
}

function validateRegistryFiles(
  registryFiles: SaasUiRegistryFiles,
  manifest: SaasUiManifest,
  components: SaasUiComponentsConfig,
  root: string,
): readonly string[] {
  const errors: string[] = [];
  if (manifest.registry.sourceCommit !== manifest.pins.pro)
    errors.push("manifest registry source commit is not the approved Pro pin");
  if (manifest.registry.sourceCommit !== registryFiles.sourceCommit)
    errors.push(
      "manifest registry source commit does not match registry receipt",
    );
  if (registryFiles.sourceCommit !== manifest.pins.pro)
    errors.push("registry files source commit is not the approved Pro pin");
  const destinations = registryFiles.files.map(
    ({ destination }) => destination,
  );
  for (const duplicate of duplicateValues(destinations))
    errors.push(`duplicate registry file destination: ${duplicate}`);
  for (const destination of destinations) {
    if (destination.startsWith("/") || destination.includes(".."))
      errors.push(
        `registry file destination is not repository-relative: ${destination}`,
      );
  }
  if (registryFiles.files.length === 0)
    errors.push("registry files receipt has no files");
  errors.push(...validateRegistryIds(registryFiles, manifest, components));
  for (const file of registryFiles.files) {
    try {
      const actual = createHash("sha256")
        .update(readFileSync(resolve(root, file.destination)))
        .digest("hex");
      if (actual !== file.sha256)
        errors.push(`registry file hash mismatch: ${file.destination}`);
    } catch {
      errors.push(`registry file destination is missing: ${file.destination}`);
    }
  }
  return errors;
}

export function checkSaasUiFoundation(root: string): readonly string[] {
  const errors: string[] = [];
  const manifest = readAuthority(() => readSaasUiManifest(root), errors);
  const acceptance = readAuthority(() => readSaasUiAcceptance(root), errors);
  const registryFiles = readAuthority(
    () => readSaasUiRegistryFiles(root),
    errors,
  );
  const components = readAuthority(() => readComponentsConfig(root), errors);
  const deviations = readAuthority(() => readSaasUiDeviations(root), errors);
  if (!manifest || !acceptance || !registryFiles || !components || !deviations)
    return errors;
  errors.push(...validateManifest(manifest));
  errors.push(
    ...validateAcceptance(
      acceptance,
      manifest.compositions.map(({ id }) => id),
    ),
  );
  errors.push(
    ...validateRegistryFiles(registryFiles, manifest, components, root),
  );
  return errors;
}

export { COMPOSITION_IDS, PINS };
