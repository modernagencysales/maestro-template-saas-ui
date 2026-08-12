import { createHash } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/u;
const ABSOLUTE_PATH = /(?:^|[\s":])\/(?!\/)[^\s"`]+/u;

export type GoldenAuthority = "reference" | "generated";

export type GoldenAuthorityMetadata = Readonly<{
  schemaVersion: 1;
  authority: GoldenAuthority;
  root: "factory-reference" | "materialized-generated-target";
  digest: string;
  provenance:
    | Readonly<{
        repository: "starter";
        commit: string;
        path: "apps/web";
        contentDigest: string;
        sourceContentDigest: string;
        receiptPath: "docs/template/saas-ui-starter-files.json";
        receiptDigest: string;
        mappedFileCount: number;
        adaptedFileCount: number;
      }>
    | Readonly<{
        repository: "generated-target";
        source: "buildSaasApplicationTargetPlan";
        contentDigest: string;
      }>;
}>;

function assertDigest(value: string, label: string): void {
  if (!SHA256.test(value)) throw new Error(`${label} must be a SHA-256 digest`);
}

export function createReferenceAuthorityMetadata(input: {
  starterPin: string;
  starterContentDigest: string;
  servedContentDigest: string;
  receiptDigest: string;
  receiptPath: "docs/template/saas-ui-starter-files.json";
  mappedFileCount: number;
  adaptedFileCount: number;
}): GoldenAuthorityMetadata {
  assertDigest(input.starterContentDigest, "starterContentDigest");
  assertDigest(input.servedContentDigest, "servedContentDigest");
  assertDigest(input.receiptDigest, "receiptDigest");
  if (input.mappedFileCount <= 0)
    throw new Error("mappedFileCount must be positive");
  if (
    input.adaptedFileCount < 0 ||
    input.adaptedFileCount > input.mappedFileCount
  )
    throw new Error("adaptedFileCount must be within mappedFileCount");
  return {
    schemaVersion: 1,
    authority: "reference",
    root: "factory-reference",
    digest: input.servedContentDigest,
    provenance: {
      repository: "starter",
      commit: input.starterPin,
      path: "apps/web",
      contentDigest: input.servedContentDigest,
      sourceContentDigest: input.starterContentDigest,
      receiptPath: input.receiptPath,
      receiptDigest: input.receiptDigest,
      mappedFileCount: input.mappedFileCount,
      adaptedFileCount: input.adaptedFileCount,
    },
  };
}

export function proveReferenceServedFiles(input: {
  starterPin: string;
  starterContentDigest: string;
  receiptDigest: string;
  receiptPath: "docs/template/saas-ui-starter-files.json";
  files: readonly Readonly<{
    destination: string;
    content: Uint8Array;
    sourceSha256: string;
    sha256: string;
    adapted: boolean;
  }>[];
}): GoldenAuthorityMetadata {
  const files = [...input.files].sort((left, right) =>
    left.destination.localeCompare(right.destination, "en"),
  );
  if (files.length === 0)
    throw new Error("Reference served file receipt has no files");
  const destinations = new Set<string>();
  let adaptedFileCount = 0;
  const hash = createHash("sha256");
  for (const file of files) {
    if (destinations.has(file.destination))
      throw new Error(`Duplicate reference served file: ${file.destination}`);
    destinations.add(file.destination);
    assertDigest(file.sourceSha256, `sourceSha256 for ${file.destination}`);
    assertDigest(file.sha256, `sha256 for ${file.destination}`);
    const actual = createHash("sha256").update(file.content).digest("hex");
    if (actual !== file.sha256)
      throw new Error(
        `Reference served file hash mismatch: ${file.destination}`,
      );
    if (file.adapted) adaptedFileCount += 1;
    hash.update(file.destination);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return createReferenceAuthorityMetadata({
    starterPin: input.starterPin,
    starterContentDigest: input.starterContentDigest,
    servedContentDigest: hash.digest("hex"),
    receiptDigest: input.receiptDigest,
    receiptPath: input.receiptPath,
    mappedFileCount: files.length,
    adaptedFileCount,
  });
}

export function createGeneratedAuthorityMetadata(input: {
  generatedDigest: string;
}): GoldenAuthorityMetadata {
  assertDigest(input.generatedDigest, "generatedDigest");
  return {
    schemaVersion: 1,
    authority: "generated",
    root: "materialized-generated-target",
    digest: input.generatedDigest,
    provenance: {
      repository: "generated-target",
      source: "buildSaasApplicationTargetPlan",
      contentDigest: input.generatedDigest,
    },
  };
}

export function assertDistinctAuthorities(
  reference: GoldenAuthorityMetadata,
  generated: GoldenAuthorityMetadata,
): void {
  if (
    reference.authority !== "reference" ||
    generated.authority !== "generated" ||
    reference.root === generated.root ||
    reference.digest === generated.digest
  ) {
    throw new Error(
      "Generated golden authority must have a distinct root and digest",
    );
  }
}

export function serializeAuthorityMetadata(
  metadata: GoldenAuthorityMetadata,
): string {
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`;
  if (ABSOLUTE_PATH.test(serialized))
    throw new Error(
      "Authority metadata must not contain host or temporary paths",
    );
  return serialized;
}
