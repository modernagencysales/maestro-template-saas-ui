import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const requiredVisualStates = [
  "loading",
  "empty",
  "error",
  "populated",
  "selected",
  "mutation",
] as const;

export type SelectedScreenAuthority = Readonly<{
  screenCatalogId: string;
  sourceReceipt: "docs/template/saas-ui-starter-files.json";
  shellId: "app-shell";
  allowedAdaptations: readonly [
    "route-binding",
    "data-adapter",
    "mutation-adapter",
    "product-label-icon",
  ];
  requiredVisualStates: typeof requiredVisualStates;
  repository: "starter";
  source: string;
  composition: string;
  sourceSha256: string;
  destinationSha256: string;
  closureSha256: string;
  routeSource: string;
}>;

type JsonRecord = Readonly<Record<string, unknown>>;

function readJson(path: string): JsonRecord {
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Frontend authority must be an object: ${path}`);
  return value as JsonRecord;
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function isRecordWith(
  value: unknown,
  field: string,
  expected: string,
): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as JsonRecord)[field] === expected
  );
}

function selectedRoute(catalog: JsonRecord, id: string): JsonRecord {
  if (!Array.isArray(catalog.starterRoutes))
    throw new Error("Saas UI screen catalog has no Starter route index.");
  const selected = catalog.starterRoutes.find((value) =>
    isRecordWith(value, "id", id),
  );
  if (!selected) {
    throw new Error(
      `Unknown or unsupported --screen-catalog-id: ${id}. template:add-feature requires a complete Starter route composition.`,
    );
  }
  return selected as JsonRecord;
}

function selectedFields(selected: JsonRecord, id: string) {
  const { source, composition, sha256: sourceSha256, closureSha256 } = selected;
  if (
    typeof source !== "string" ||
    typeof composition !== "string" ||
    typeof sourceSha256 !== "string" ||
    typeof closureSha256 !== "string"
  ) {
    throw new Error(`Selected screen is missing composition closure: ${id}`);
  }
  return { source, composition, sourceSha256, closureSha256 };
}

function sourceReceipt(receipt: JsonRecord, source: string): JsonRecord {
  if (!Array.isArray(receipt.files))
    throw new Error("Selected screen receipt has no files.");
  return (receipt.files.find((value) =>
    isRecordWith(value, "source", source),
  ) ?? {}) as JsonRecord;
}

export function selectStarterScreen(
  root: string,
  screenCatalogId: string,
): SelectedScreenAuthority {
  const catalog = readJson(
    resolve(root, "docs/template/saas-ui-screen-catalog.json"),
  );
  const { source, composition, sourceSha256, closureSha256 } = selectedFields(
    selectedRoute(catalog, screenCatalogId),
    screenCatalogId,
  );

  const receiptPath = "docs/template/saas-ui-starter-files.json" as const;
  const receipt = readJson(resolve(root, receiptPath));
  const selectedReceipt = sourceReceipt(receipt, source);
  if (
    selectedReceipt.sourceSha256 !== sourceSha256 ||
    typeof selectedReceipt.destination !== "string" ||
    typeof selectedReceipt.sha256 !== "string"
  ) {
    throw new Error(
      `Selected screen is not bound to its pinned source receipt: ${screenCatalogId}`,
    );
  }
  const destination = resolve(root, selectedReceipt.destination);
  const routeSource = readFileSync(destination, "utf8");
  if (sha256(routeSource) !== selectedReceipt.sha256) {
    throw new Error(
      `Selected screen destination hash is stale: ${selectedReceipt.destination}`,
    );
  }

  return {
    screenCatalogId,
    sourceReceipt: receiptPath,
    shellId: "app-shell",
    allowedAdaptations: [
      "route-binding",
      "data-adapter",
      "mutation-adapter",
      "product-label-icon",
    ],
    requiredVisualStates,
    repository: "starter",
    source,
    composition,
    sourceSha256,
    destinationSha256: selectedReceipt.sha256,
    closureSha256,
    routeSource,
  };
}
