type JsonRecord = Record<string, unknown>;

export type CompatibilityResult = {
  readonly status: "pass" | "fail";
  readonly findings: readonly string[];
};

export type WorkpoolProductionSupportResult = {
  readonly status: "supported" | "unsupported";
  readonly findings: readonly string[];
  readonly supportedAlternative: string;
};

export function evaluateCompatibilitySet(
  matrixInput: unknown,
  fixtureInput: unknown,
): CompatibilityResult {
  const matrix = record(matrixInput, "matrix");
  const fixture = record(fixtureInput, "fixture");
  const versions = record(fixture.versions, "fixture.versions");
  const expected = stringValue(fixture.expected, "fixture.expected");
  const authority = stringValue(
    fixture.authority ?? "current",
    "fixture.authority",
  );
  const missingProofs = stringArray(
    fixture.missingProofs ?? [],
    "missingProofs",
  );

  if (expected === "pass") {
    const target = record(matrix[authority], `matrix.${authority}`);
    const versionPairs = [
      ["convex", "convex"],
      ["workflow", "@convex-dev/workflow"],
      ["workpool", "@convex-dev/workpool"],
      ["convexTest", "convex-test"],
    ] as const;
    const versionFindings = versionPairs.flatMap(([fixtureKey, matrixKey]) =>
      versions[fixtureKey] === target[matrixKey]
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

export function evaluateWorkpoolProductionSupport(
  matrixInput: unknown,
  fixtureInput: unknown,
): WorkpoolProductionSupportResult {
  const matrix = record(matrixInput, "matrix");
  const fixture = record(fixtureInput, "fixture");
  const authority = stringValue(
    fixture.authority ?? "current",
    "fixture.authority",
  );
  const expected = stringValue(
    fixture.expectedProductionSupport,
    "fixture.expectedProductionSupport",
  );
  if (expected !== "supported" && expected !== "unsupported") {
    throw new TypeError(
      "fixture.expectedProductionSupport must be supported or unsupported",
    );
  }

  const safety = record(matrix.workpoolSafety, "matrix.workpoolSafety");
  const set = record(safety[authority], `matrix.workpoolSafety.${authority}`);
  const outcomes = record(
    set.behavioralOutcomes,
    `matrix.workpoolSafety.${authority}.behavioralOutcomes`,
  );
  const requiredRules = stringArray(
    safety.requiredBehaviorRules,
    "matrix.workpoolSafety.requiredBehaviorRules",
  );
  const findings = requiredRules.filter(
    (ruleId) => outcomes[ruleId] !== "safe",
  );
  const status = findings.length === 0 ? "supported" : "unsupported";
  const declared = stringValue(
    set.productionSupport,
    `matrix.workpoolSafety.${authority}.productionSupport`,
  );
  if (declared !== status) {
    findings.push(`authority-disposition-mismatch:${declared}:${status}`);
  }
  if (expected !== status) {
    findings.push(`fixture-disposition-mismatch:${expected}:${status}`);
  }
  return {
    status,
    findings,
    supportedAlternative: stringValue(
      safety.supportedAlternative,
      "matrix.workpoolSafety.supportedAlternative",
    ),
  };
}

export function validateInlineTransactionCompatibility(
  matrixInput: unknown,
  runtimeInput: unknown,
): readonly string[] {
  try {
    const matrix = record(matrixInput, "matrix");
    const authority = record(
      matrix.inlineTransactions,
      "matrix.inlineTransactions",
    );
    const runtime = record(runtimeInput, "runtime.inlineTransactions");
    const findings: string[] = [];
    const authorityVersion = stringValue(
      authority.supportedConvexVersion,
      "matrix.inlineTransactions.supportedConvexVersion",
    );
    const runtimeVersion = stringValue(
      runtime.supportedConvexVersion,
      "runtime.inlineTransactions.supportedConvexVersion",
    );
    if (authorityVersion !== runtimeVersion) {
      findings.push("inline-version-mismatch");
    }

    const authorityFields = stringArray(
      authority.supportedFields,
      "matrix.inlineTransactions.supportedFields",
    );
    const runtimeFields = stringArray(
      runtime.supportedFields,
      "runtime.inlineTransactions.supportedFields",
    );
    compareExactNames("inline-field", authorityFields, runtimeFields, findings);

    const authorityPresets = record(
      authority.presets,
      "matrix.inlineTransactions.presets",
    );
    const runtimePresets = record(
      runtime.presets,
      "runtime.inlineTransactions.presets",
    );
    compareExactNames(
      "inline-preset",
      Object.keys(authorityPresets),
      Object.keys(runtimePresets),
      findings,
    );
    for (const presetName of unionNames(
      Object.keys(authorityPresets),
      Object.keys(runtimePresets),
    )) {
      const authorityPreset = authorityPresets[presetName];
      const runtimePreset = runtimePresets[presetName];
      if (authorityPreset === undefined || runtimePreset === undefined)
        continue;
      comparePreset(
        presetName,
        authorityPreset,
        runtimePreset,
        authorityFields,
        runtimeFields,
        findings,
      );
    }
    return [...new Set(findings)].sort();
  } catch (error) {
    return [
      `inline-authority-invalid:${error instanceof Error ? error.message : String(error)}`,
    ];
  }
}

const comparePreset = (
  presetName: string,
  authorityInput: unknown,
  runtimeInput: unknown,
  authorityFields: readonly string[],
  runtimeFields: readonly string[],
  findings: string[],
): void => {
  const authority = record(
    authorityInput,
    `matrix.inlineTransactions.presets.${presetName}`,
  );
  const runtime = record(
    runtimeInput,
    `runtime.inlineTransactions.presets.${presetName}`,
  );
  const authorityCounters = Object.keys(authority);
  const runtimeCounters = Object.keys(runtime);
  compareExactNames(
    `inline-preset-counter:${presetName}`,
    authorityCounters,
    runtimeCounters,
    findings,
  );
  if (authorityCounters.length === 0 || runtimeCounters.length === 0) {
    findings.push(`inline-preset-empty:${presetName}`);
  }
  for (const counter of unionNames(authorityCounters, runtimeCounters)) {
    if (!authorityFields.includes(counter)) {
      findings.push(
        `inline-authority-counter-unsupported:${presetName}:${counter}`,
      );
    }
    if (!runtimeFields.includes(counter)) {
      findings.push(
        `inline-runtime-counter-unsupported:${presetName}:${counter}`,
      );
    }
    const authorityValue = authority[counter];
    const runtimeValue = runtime[counter];
    if (!isValidCounter(authorityValue)) {
      findings.push(
        `inline-authority-counter-invalid:${presetName}:${counter}`,
      );
    }
    if (!isValidCounter(runtimeValue)) {
      findings.push(`inline-runtime-counter-invalid:${presetName}:${counter}`);
    }
    if (authorityValue !== runtimeValue) {
      findings.push(`inline-counter-mismatch:${presetName}:${counter}`);
    }
  }
};

const compareExactNames = (
  prefix: string,
  authority: readonly string[],
  runtime: readonly string[],
  findings: string[],
): void => {
  const authorityNames = new Set(authority);
  const runtimeNames = new Set(runtime);
  if (authorityNames.size !== authority.length)
    findings.push(`${prefix}-duplicate:authority`);
  if (runtimeNames.size !== runtime.length)
    findings.push(`${prefix}-duplicate:runtime`);
  for (const name of authorityNames) {
    if (!runtimeNames.has(name)) findings.push(`${prefix}-missing:${name}`);
  }
  for (const name of runtimeNames) {
    if (!authorityNames.has(name)) findings.push(`${prefix}-unknown:${name}`);
  }
};

const unionNames = (
  left: readonly string[],
  right: readonly string[],
): readonly string[] => [...new Set([...left, ...right])].sort();

const isValidCounter = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0;

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
