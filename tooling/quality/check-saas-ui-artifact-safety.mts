import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  readSaasUiAcceptance,
  readSaasUiManifest,
  readSaasUiRegistryFiles,
} from "./saas-ui-foundation";
import { isDirectRun } from "./src/direct-run.mts";

const PUBLIC_ARTIFACT_ROOT = "apps/web/dist/client";
const STARTER_RECEIPT = "docs/template/saas-ui-starter-files.json";
const LICENSE_ROOT = "docs/licenses/saas-ui/";

type PackageJson = Readonly<{
  private?: boolean;
  files?: readonly unknown[];
}>;

type PaidPath = Readonly<{
  path: string;
  source: "manifest" | "registry" | "license";
}>;

const normalizeRepositoryPath = (value: string): string | undefined => {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "..")
  )
    return undefined;
  return normalized;
};

const readPackage = (path: string): PackageJson | undefined => {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return undefined;
    return value as PackageJson;
  } catch {
    return undefined;
  }
};

const packageFor = (
  root: string,
  repositoryPath: string,
): { root: string; path: string; json: PackageJson } | undefined => {
  let directory = resolve(root, dirname(repositoryPath));
  const rootPath = resolve(root);
  while (directory.startsWith(rootPath)) {
    const packagePath = join(directory, "package.json");
    if (existsSync(packagePath)) {
      const json = readPackage(packagePath);
      return {
        root: directory,
        path: relative(rootPath, packagePath).replaceAll(sep, "/"),
        json: json ?? {},
      };
    }
    if (directory === rootPath) break;
    directory = dirname(directory);
  }
  return undefined;
};

const npmPatternMatches = (packageRelativePath: string, pattern: string) => {
  const normalized = pattern.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized.length === 0) return false;
  if (normalized === packageRelativePath) return true;
  if (normalized.endsWith("/"))
    return packageRelativePath.startsWith(normalized);
  if (packageRelativePath.startsWith(`${normalized}/`)) return true;
  if (!normalized.includes("*")) return false;
  const expression = new RegExp(
    `^${normalized
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join(".*")}(?:/.*)?$`,
  );
  return expression.test(packageRelativePath);
};

const hasNpmPacklistInclusion = (
  root: string,
  packageRoot: string,
  packageJson: PackageJson,
  repositoryPath: string,
): boolean => {
  if (!Array.isArray(packageJson.files)) return false;
  const relativePath = relative(
    packageRoot,
    resolve(root, repositoryPath),
  ).replaceAll(sep, "/");
  return packageJson.files.some(
    (pattern) =>
      typeof pattern === "string" && npmPatternMatches(relativePath, pattern),
  );
};

type StarterReceiptEntry = Readonly<{
  source: string;
  destination: string;
  sourceSha256: string;
  sha256: string;
  adapted: boolean;
}>;

export const readRequiredStarterReceipt = (
  root: string,
  errors: string[],
  starterDestinations: readonly string[],
  // eslint-disable-next-line complexity -- validates one fixed provenance receipt schema.
): readonly string[] => {
  const path = resolve(root, STARTER_RECEIPT);
  if (!existsSync(path)) {
    errors.push(
      `required Saas UI starter receipt is missing: ${STARTER_RECEIPT}`,
    );
    return [];
  }
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(
        `required Saas UI starter receipt is invalid: ${STARTER_RECEIPT}`,
      );
      return [];
    }
    const receipt = value as {
      schemaVersion?: unknown;
      sourceCommit?: unknown;
      files?: unknown;
    };
    if (
      receipt.schemaVersion !== 1 ||
      receipt.sourceCommit !== "b76cb4514b9ab47f7db87901cb9b593b4adc3129" ||
      !Array.isArray(receipt.files)
    ) {
      errors.push(
        `required Saas UI starter receipt is invalid: ${STARTER_RECEIPT}`,
      );
      return [];
    }
    const files: StarterReceiptEntry[] = [];
    for (const [index, value] of receipt.files.entries()) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(
          `required Saas UI starter receipt entry ${index} is invalid`,
        );
        continue;
      }
      const file = value as Record<string, unknown>;
      if (
        typeof file.source !== "string" ||
        typeof file.destination !== "string" ||
        typeof file.sourceSha256 !== "string" ||
        typeof file.sha256 !== "string" ||
        typeof file.adapted !== "boolean" ||
        !SHA256.test(file.sourceSha256) ||
        !SHA256.test(file.sha256) ||
        normalizeRepositoryPath(file.destination) === undefined
      ) {
        errors.push(
          `required Saas UI starter receipt entry ${index} is invalid`,
        );
        continue;
      }
      files.push(file as StarterReceiptEntry);
    }
    for (const { destination, sha256 } of files) {
      const destinationPath = resolve(root, destination);
      if (
        existsSync(destinationPath) &&
        createHash("sha256")
          .update(readFileSync(destinationPath))
          .digest("hex") !== sha256
      )
        errors.push(
          `starter receipt destination hash mismatch: ${destination}`,
        );
    }
    const destinations = new Set(files.map(({ destination }) => destination));
    for (const destination of starterDestinations) {
      if (!destinations.has(destination))
        errors.push(
          `starter receipt does not cover paid source: ${destination}`,
        );
    }
    return files.map(({ destination }) => destination);
  } catch {
    errors.push(
      `unable to read required Saas UI starter receipt: ${STARTER_RECEIPT}`,
    );
    return [];
  }
};

const SHA256 = /^[a-f0-9]{64}$/u;

const addPaidPath = (
  paths: Map<string, PaidPath>,
  value: string,
  source: PaidPath["source"],
  errors: string[],
): void => {
  const normalized = normalizeRepositoryPath(value);
  if (normalized === undefined) {
    errors.push(`paid source path is not repository-relative: ${value}`);
    return;
  }
  if (!paths.has(normalized))
    paths.set(normalized, { path: normalized, source });
};

// eslint-disable-next-line complexity -- this is the single fail-closed boundary aggregator.
export function assertSaasUiArtifactSafety(root: string): readonly string[] {
  const errors: string[] = [];
  const paid = new Map<string, PaidPath>();
  let manifest: ReturnType<typeof readSaasUiManifest> | undefined;

  try {
    manifest = readSaasUiManifest(root);
  } catch (error) {
    errors.push(
      `unable to read Saas UI upstream manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (manifest !== undefined) {
    let acceptedSources = new Map<string, "starter" | "pro">();
    try {
      acceptedSources = new Map(
        readSaasUiAcceptance(root).entries.map((entry) => [
          entry.id,
          entry.upstream.repository,
        ]),
      );
    } catch {
      // The acceptance map is optional for this boundary; the manifest remains authoritative.
    }
    for (const composition of manifest.compositions) {
      const source =
        acceptedSources.get(composition.id) ??
        (/^starter(?:\/|$)/u.test(composition.source)
          ? "starter"
          : /^pro(?:\/|$)/u.test(composition.source)
            ? "pro"
            : undefined);
      if (source !== undefined)
        for (const file of composition.files)
          addPaidPath(paid, file.destination, "manifest", errors);
    }
    const starterDestinations = manifest.compositions
      .filter(
        (composition) => acceptedSources.get(composition.id) === "starter",
      )
      .flatMap(({ files }) => files.map(({ destination }) => destination));
    for (const destination of readRequiredStarterReceipt(
      root,
      errors,
      starterDestinations,
    ))
      addPaidPath(paid, destination, "manifest", errors);
    for (const license of manifest.licenses)
      addPaidPath(paid, license.destination, "license", errors);
  }

  try {
    for (const file of readSaasUiRegistryFiles(root).files) {
      addPaidPath(paid, file.destination, "registry", errors);
      const destination = resolve(root, file.destination);
      if (
        existsSync(destination) &&
        createHash("sha256").update(readFileSync(destination)).digest("hex") !==
          file.sha256
      )
        errors.push(
          `registry receipt destination hash mismatch: ${file.destination}`,
        );
    }
  } catch (error) {
    errors.push(
      `unable to read Saas UI registry receipt: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const { path } of paid.values()) {
    const fullPath = resolve(root, path);
    if (!existsSync(fullPath)) {
      errors.push(`paid source destination is missing: ${path}`);
      continue;
    }
    if (
      path === PUBLIC_ARTIFACT_ROOT ||
      path.startsWith(`${PUBLIC_ARTIFACT_ROOT}/`)
    )
      errors.push(`paid source enters public artifact: ${path}`);

    const owner = packageFor(root, path);
    if (owner === undefined) {
      errors.push(`paid source has no owning package: ${path}`);
      continue;
    }
    if (owner.json.private !== true)
      errors.push(`paid source package ${owner.path} must be private: ${path}`);
    if (hasNpmPacklistInclusion(root, owner.root, owner.json, path))
      errors.push(`paid source enters npm packlist: ${path}`);
  }

  if (manifest !== undefined) {
    for (const license of manifest.licenses) {
      const destination = normalizeRepositoryPath(license.destination);
      if (
        destination === undefined ||
        !existsSync(resolve(root, license.destination))
      )
        errors.push(
          `missing paid source license notice: ${license.destination}`,
        );
      else if (!destination.startsWith(LICENSE_ROOT))
        errors.push(
          `paid source license notice must remain under ${LICENSE_ROOT}: ${destination}`,
        );
      else if (
        readFileSync(resolve(root, destination), "utf8").trim().length === 0
      )
        errors.push(`empty paid source license notice: ${destination}`);
    }
  }

  return [...new Set(errors)].sort((left, right) => left.localeCompare(right));
}

if (isDirectRun(import.meta.url)) {
  const errors = assertSaasUiArtifactSafety(process.cwd());
  if (errors.length > 0) {
    for (const error of errors)
      console.error(`check:saas-ui-artifact-safety: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("check:saas-ui-artifact-safety: ok");
  }
}
