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
    "compatibility-seam",
  ];
  requiredVisualStates: typeof requiredVisualStates;
  repository: "starter";
  source: string;
  composition: string;
  sourceSha256: string;
  destinationSha256: string;
  closureSha256: string;
  destinationClosureSha256: string;
  files: readonly Readonly<{
    source: string;
    destination: string;
    sourceSha256: string;
    destinationSha256: string;
    adapted: boolean;
    allowedPatches: readonly [] | readonly ["compatibility-seam"];
  }>[];
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

type SourceClosureEntry = Readonly<{ source: string; sha256: string }>;

function sourceClosure(
  value: unknown,
  id: string,
): readonly SourceClosureEntry[] {
  if (!Array.isArray(value))
    throw new Error(`Selected screen has no import closure: ${id}`);
  return value.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof (entry as JsonRecord).source !== "string" ||
      typeof (entry as JsonRecord).sha256 !== "string"
    ) {
      throw new Error(`Selected screen has an invalid import closure: ${id}`);
    }
    return {
      source: (entry as JsonRecord).source as string,
      sha256: (entry as JsonRecord).sha256 as string,
    };
  });
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
  return {
    source,
    composition,
    sourceSha256,
    closureSha256,
    closure: sourceClosure(selected.closure, id),
  };
}

function receiptFiles(receipt: JsonRecord): readonly JsonRecord[] {
  if (!Array.isArray(receipt.files))
    throw new Error("Selected screen receipt has no files.");
  return receipt.files.filter(
    (value): value is JsonRecord =>
      value !== null && typeof value === "object" && !Array.isArray(value),
  );
}

function bindDestinationClosure(
  root: string,
  closure: readonly SourceClosureEntry[],
  receipt: readonly JsonRecord[],
) {
  return closure.map(({ source, sha256: sourceSha256 }) => {
    const entry = receipt.find((value) => value.source === source);
    if (
      !entry ||
      entry.sourceSha256 !== sourceSha256 ||
      typeof entry.destination !== "string" ||
      typeof entry.sha256 !== "string" ||
      typeof entry.adapted !== "boolean"
    ) {
      throw new Error(`Import closure is not receipt-bound: ${source}`);
    }
    const content = readFileSync(resolve(root, entry.destination));
    if (sha256(content) !== entry.sha256)
      throw new Error(
        `Import closure destination hash is stale: ${entry.destination}`,
      );
    return {
      source,
      destination: entry.destination,
      sourceSha256,
      destinationSha256: entry.sha256,
      adapted: entry.adapted,
      allowedPatches: entry.adapted
        ? (["compatibility-seam"] as const)
        : ([] as const),
    };
  });
}

export function selectStarterScreen(
  root: string,
  screenCatalogId: string,
): SelectedScreenAuthority {
  const catalog = readJson(
    resolve(root, "docs/template/saas-ui-screen-catalog.json"),
  );
  const selected = selectedFields(
    selectedRoute(catalog, screenCatalogId),
    screenCatalogId,
  );
  const { source, composition, sourceSha256, closureSha256, closure } =
    selected;

  const receiptPath = "docs/template/saas-ui-starter-files.json" as const;
  const receipt = receiptFiles(readJson(resolve(root, receiptPath)));
  const selectedReceipt =
    receipt.find((entry) => entry.source === source) ?? {};
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
  const files = bindDestinationClosure(root, closure, receipt);
  const destinationClosureSha256 = sha256(
    files
      .map(
        ({ destination, destinationSha256 }) =>
          `${destination}\0${destinationSha256}`,
      )
      .join("\n"),
  );

  return {
    screenCatalogId,
    sourceReceipt: receiptPath,
    shellId: "app-shell",
    allowedAdaptations: [
      "route-binding",
      "data-adapter",
      "mutation-adapter",
      "product-label-icon",
      "compatibility-seam",
    ],
    requiredVisualStates,
    repository: "starter",
    source,
    composition,
    sourceSha256,
    destinationSha256: selectedReceipt.sha256,
    closureSha256,
    destinationClosureSha256,
    files,
    routeSource,
  };
}
