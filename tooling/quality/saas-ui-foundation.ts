import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
    sourceCommit?: string;
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

export type SaasUiDeviation = Readonly<{
  source: string;
  destination: string;
  change: string;
  reason: string;
  evidence: string;
  evidencePaths: readonly string[];
  evidenceChecks: readonly string[];
  sourceAuthority: "starter-receipt" | "factory-support";
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
  files: readonly Readonly<{
    destination: string;
    sha256: string;
  }>[];
}>;

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
      ...(typeof registry.sourceCommit === "string"
        ? { sourceCommit: registry.sourceCommit }
        : {}),
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

// eslint-disable-next-line complexity -- validates the fixed deviation authority schema.
export function readSaasUiDeviations(root: string): readonly SaasUiDeviation[] {
  const value = readJson(root, DEVIATIONS_PATH);
  const authority = record(value, DEVIATIONS_PATH);
  if (authority.schemaVersion !== 1)
    throw new Error("deviations schemaVersion must be 1");
  if (typeof authority.authorityDigest !== "string")
    throw new Error("deviations authorityDigest must be a string");
  if (!Array.isArray(authority.deviations))
    throw new Error("deviations.deviations must be an array");
  const deviations = authority.deviations.map((itemValue, index) => {
    const item = record(itemValue, `deviation[${index}]`);
    return {
      source: string(item.source, "deviation.source"),
      destination: string(item.destination, "deviation.destination"),
      change: string(item.change, "deviation.change"),
      reason: string(item.reason, "deviation.reason"),
      evidence: string(item.evidence, "deviation.evidence"),
      evidencePaths: stringArray(item.evidencePaths, "deviation.evidencePaths"),
      evidenceChecks: stringArray(
        item.evidenceChecks,
        "deviation.evidenceChecks",
      ),
      sourceAuthority: (() => {
        const value = string(item.sourceAuthority, "deviation.sourceAuthority");
        if (value !== "starter-receipt" && value !== "factory-support")
          throw new Error(`unsupported deviation source authority: ${value}`);
        return value;
      })(),
    };
  });
  const digest = createHash("sha256")
    .update(JSON.stringify(deviations))
    .digest("hex");
  if (digest !== authority.authorityDigest)
    throw new Error("deviations authority digest mismatch");
  for (const deviation of deviations) {
    for (const path of deviation.evidencePaths) {
      if (
        path.includes("..") ||
        path.startsWith("/") ||
        !existsSync(resolve(root, path))
      )
        throw new Error(`deviation evidence path is missing: ${path}`);
    }
    for (const check of deviation.evidenceChecks) {
      const [path, ...name] = check.split("#");
      if (!existsSync(resolve(root, path)))
        throw new Error(`deviation evidence check file is missing: ${path}`);
      if (
        name.length > 0 &&
        !readFileSync(resolve(root, path), "utf8").includes(name.join("#"))
      )
        throw new Error(`deviation evidence check is not present: ${check}`);
    }
  }
  return deviations;
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
  if (!Array.isArray(root.files))
    throw new Error("registry files.files must be an array");
  const files = root.files.map((fileValue, index) => {
    const file = record(fileValue, `registry files.files[${index}]`);
    const destination = string(file.destination, "registry files.destination");
    const sha256 = string(file.sha256, "registry files.sha256");
    if (!/^[a-f0-9]{64}$/.test(sha256))
      throw new Error(`registry files.files[${index}] sha256 is invalid`);
    return { destination, sha256 };
  });
  return { schemaVersion: 1, sourceCommit, files };
}

export function readSaasUiAcceptance(root: string): SaasUiAcceptanceMap {
  return readAcceptanceValue(readJson(root, ACCEPTANCE_PATH));
}

export function readSaasUiRegistryFiles(root: string): SaasUiRegistryFiles {
  return readRegistryFilesValue(readJson(root, REGISTRY_FILES_PATH));
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

function validateRegistryFiles(
  registryFiles: SaasUiRegistryFiles,
  manifest: SaasUiManifest,
  root: string,
): readonly string[] {
  const errors: string[] = [];
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

const FACTORY_SUPPORT_DESTINATIONS = new Set([
  "tsconfig.base.json",
  "apps/web/tsconfig.json",
  "apps/web/src/features/common/components/client-resizer.tsx",
  "apps/web/src/routes/__root.tsx",
  "apps/web/src/lib/trpc/react.tsx",
  "apps/web/src/components/back-button.tsx",
  "apps/web/src/features/contacts/list/list-page.tsx",
  "patches/@saas-ui-pro__react@1.0.0-next.4.patch",
]);

function deviationDestinationPaths(destination: string): readonly string[] {
  return destination.split(";").flatMap((entry) => {
    const path = entry.trim().split(":", 1)[0];
    return path === undefined ? [] : [path];
  });
}

// eslint-disable-next-line complexity -- validates the bounded deviation authority fields.
function validateDeviations(
  deviations: readonly SaasUiDeviation[],
  root: string,
): readonly string[] {
  const errors: string[] = [];
  const receipt = readJson(root, "docs/template/saas-ui-starter-files.json");
  const receiptFiles = Array.isArray(record(receipt, "starter receipt").files)
    ? (record(receipt, "starter receipt").files as readonly unknown[])
    : [];
  const adaptedDestinations = new Set(
    receiptFiles.flatMap((value) => {
      const item = record(value, "starter receipt file");
      return item.adapted === true && typeof item.destination === "string"
        ? [item.destination]
        : [];
    }),
  );
  for (const deviation of deviations) {
    for (const path of deviation.evidencePaths) {
      if (
        path.includes("..") ||
        path.startsWith("/") ||
        !existsSync(resolve(root, path))
      )
        errors.push(`deviation evidence path is missing: ${path}`);
    }
    for (const check of deviation.evidenceChecks) {
      const [path, ...name] = check.split("#");
      if (!existsSync(resolve(root, path)))
        errors.push(`deviation evidence check file is missing: ${path}`);
      else if (
        name.length > 0 &&
        !readFileSync(resolve(root, path), "utf8").includes(name.join("#"))
      )
        errors.push(`deviation evidence check is not present: ${check}`);
    }
    const paths = deviationDestinationPaths(deviation.destination);
    for (const path of paths) {
      if (deviation.sourceAuthority === "factory-support") {
        if (!FACTORY_SUPPORT_DESTINATIONS.has(path))
          errors.push(
            `factory-support deviation destination is not approved: ${path}`,
          );
      } else if (
        !existsSync(resolve(root, "docs/template/saas-ui-starter-files.json"))
      ) {
        errors.push("starter-receipt deviation authority is missing");
      } else if (!adaptedDestinations.has(path)) {
        errors.push(
          `starter-receipt deviation destination is not adapted: ${path}`,
        );
      }
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
  const deviations = readAuthority(() => readSaasUiDeviations(root), errors);
  for (const deviation of deviations ?? [])
    if (deviation.reason.toLowerCase().includes("aesthetic"))
      errors.push(`deviation ${deviation.source} uses an aesthetic reason`);
  if (!manifest || !acceptance || !registryFiles) return errors;
  errors.push(...validateManifest(manifest));
  errors.push(
    ...validateAcceptance(
      acceptance,
      manifest.compositions.map(({ id }) => id),
    ),
  );
  errors.push(...validateRegistryFiles(registryFiles, manifest, root));
  errors.push(...validateDeviations(deviations ?? [], root));
  return errors;
}

export { COMPOSITION_IDS, PINS };
