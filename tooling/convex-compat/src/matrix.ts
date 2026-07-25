type JsonRecord = Record<string, unknown>;

export type CompatibilityResult = {
  readonly status: "pass" | "fail";
  readonly findings: readonly string[];
};

export function evaluateCompatibilitySet(
  matrixInput: unknown,
  fixtureInput: unknown,
): CompatibilityResult {
  const matrix = record(matrixInput, "matrix");
  const fixture = record(fixtureInput, "fixture");
  const versions = record(fixture.versions, "fixture.versions");
  const current = record(matrix.current, "matrix.current");
  const expected = stringValue(fixture.expected, "fixture.expected");
  const missingProofs = stringArray(
    fixture.missingProofs ?? [],
    "missingProofs",
  );

  if (expected === "pass") {
    const versionPairs = [
      ["convex", "convex"],
      ["workflow", "@convex-dev/workflow"],
      ["workpool", "@convex-dev/workpool"],
      ["convexTest", "convex-test"],
    ] as const;
    const versionFindings = versionPairs.flatMap(([fixtureKey, matrixKey]) =>
      versions[fixtureKey] === current[matrixKey]
        ? []
        : [`version-mismatch:${fixtureKey}`],
    );
    return versionFindings.length === 0
      ? { status: "pass", findings: [] }
      : { status: "fail", findings: versionFindings };
  }

  return {
    status: "fail",
    findings:
      missingProofs.length > 0 ? missingProofs : ["candidate-not-approved"],
  };
}

export function validatePinnedManifests(
  matrixInput: unknown,
  convexPackageInput: unknown,
  proofPackageInput: unknown,
): readonly string[] {
  const matrix = record(matrixInput, "matrix");
  const current = record(matrix.current, "matrix.current");
  const convexPackage = record(convexPackageInput, "convex package");
  const proofPackage = record(proofPackageInput, "proof package");
  const convexDeps = record(convexPackage.dependencies, "convex dependencies");
  const proofDeps = record(proofPackage.dependencies, "proof dependencies");
  const checked = [
    "convex",
    "@convex-dev/workflow",
    "@convex-dev/migrations",
    "@confect/core",
    "@confect/server",
    "@confect/test",
    "effect",
  ];
  const findings: string[] = [];

  for (const name of checked) {
    if (convexDeps[name] !== current[name])
      findings.push(`packages/convex:${name}`);
    if (proofDeps[name] !== undefined && proofDeps[name] !== current[name]) {
      findings.push(`effectified-api-proof:${name}`);
    }
  }
  if (convexDeps["@convex-dev/workpool"] !== current["@convex-dev/workpool"]) {
    findings.push("packages/convex:@convex-dev/workpool");
  }
  if (convexDeps["convex-test"] !== current["convex-test"]) {
    findings.push("packages/convex:convex-test");
  }
  return findings;
}

function record(value: unknown, name: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value as JsonRecord;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${name} must be a string`);
  return value;
}

function stringArray(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${name} must be a string array`);
  }
  return value;
}
