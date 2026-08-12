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
}): GoldenAuthorityMetadata {
  assertDigest(input.starterContentDigest, "starterContentDigest");
  return {
    schemaVersion: 1,
    authority: "reference",
    root: "factory-reference",
    digest: input.starterContentDigest,
    provenance: {
      repository: "starter",
      commit: input.starterPin,
      path: "apps/web",
      contentDigest: input.starterContentDigest,
    },
  };
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
