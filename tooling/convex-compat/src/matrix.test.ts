import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INLINE_TRANSACTION_LIMIT_FIELDS,
  INLINE_TRANSACTION_PRESETS,
  PINNED_INLINE_CONVEX_VERSION,
} from "../../../packages/convex/confect/workflows/_kit/inlineTransactions";
import {
  evaluateCompatibilitySet,
  evaluateWorkpoolProductionSupport,
  validateInlineTransactionCompatibility,
  validatePinnedManifests,
} from "./matrix";

const repoRoot = resolve(import.meta.dirname, "../../..");

describe("Convex compatibility matrix", () => {
  it("accepts current and reports isolated candidate source regressions", async () => {
    const [matrix, current, candidate] = await Promise.all([
      readJson("docs/template/convex-compatibility.json"),
      readJson("tooling/convex-compat/__fixtures__/current.json"),
      readJson("tooling/convex-compat/__fixtures__/candidate.json"),
    ]);

    expect(evaluateCompatibilitySet(matrix, current)).toEqual({
      status: "pass",
      findings: [],
    });
    expect(evaluateCompatibilitySet(matrix, candidate)).toEqual({
      status: "fail",
      findings: ["WF-WORKPOOL-DUPLICATE-COMPLETION", "WF-WORKPOOL-CANCEL-RACE"],
    });
  });

  it("pins package declarations to the machine-readable authority", async () => {
    const matrix = await readJson("docs/template/convex-compatibility.json");
    const [convexPackage, proofPackage] = await Promise.all([
      readJson("packages/convex/package.json"),
      readJson("tooling/effectified-api-proof/package.json"),
    ]);

    expect(
      validatePinnedManifests(matrix, convexPackage, proofPackage),
    ).toEqual([]);
  });

  it("fails production support closed for current and candidate Workpool", async () => {
    const [matrix, current, candidate] = await Promise.all([
      readJson("docs/template/convex-compatibility.json"),
      readJson("tooling/convex-compat/__fixtures__/current.json"),
      readJson("tooling/convex-compat/__fixtures__/candidate.json"),
    ]);
    const supportedAlternative =
      "Use workflow-optional mode: reject Workpool retry and cancellation activation and make no production workflow compatibility claim.";

    expect(evaluateWorkpoolProductionSupport(matrix, current)).toEqual({
      status: "unsupported",
      findings: ["WF-WORKPOOL-DUPLICATE-COMPLETION", "WF-WORKPOOL-CANCEL-RACE"],
      supportedAlternative,
    });
    expect(evaluateWorkpoolProductionSupport(matrix, candidate)).toEqual({
      status: "unsupported",
      findings: ["WF-WORKPOOL-DUPLICATE-COMPLETION", "WF-WORKPOOL-CANCEL-RACE"],
      supportedAlternative,
    });
  });

  it("rejects a false Workpool production-support declaration", async () => {
    const [matrix, current] = (await Promise.all([
      readJson("docs/template/convex-compatibility.json"),
      readJson("tooling/convex-compat/__fixtures__/current.json"),
    ])) as [Record<string, unknown>, unknown];
    const safety = matrix.workpoolSafety as Record<string, unknown>;
    const currentAuthority = safety.current as Record<string, unknown>;
    const result = evaluateWorkpoolProductionSupport(
      {
        ...matrix,
        workpoolSafety: {
          ...safety,
          current: { ...currentAuthority, productionSupport: "supported" },
        },
      },
      current,
    );

    expect(result.findings).toContain(
      "authority-disposition-mismatch:supported:unsupported",
    );
  });

  it("derives runtime inline parity from the canonical authority", async () => {
    const matrix = await readJson("docs/template/convex-compatibility.json");
    expect(
      validateInlineTransactionCompatibility(matrix, runtimeInline),
    ).toEqual([]);
  });

  it.each([
    ["version drift", { supportedConvexVersion: "1.42.2" }],
    [
      "field addition",
      { supportedFields: [...runtimeInline.supportedFields, "rogue"] },
    ],
    [
      "field removal",
      { supportedFields: runtimeInline.supportedFields.slice(1) },
    ],
    [
      "preset addition",
      { presets: { ...runtimeInline.presets, rogue: { bytesRead: 1 } } },
    ],
    ["preset removal", { presets: { tiny: runtimeInline.presets.tiny } }],
    [
      "counter drift",
      {
        presets: {
          ...runtimeInline.presets,
          tiny: { documentsRead: 6, bytesWritten: 100 },
        },
      },
    ],
    [
      "invalid counter",
      {
        presets: {
          ...runtimeInline.presets,
          tiny: { documentsRead: -1, bytesWritten: 100 },
        },
      },
    ],
  ])("rejects inline compatibility %s", async (_name, override) => {
    const matrix = (await readJson(
      "docs/template/convex-compatibility.json",
    )) as Record<string, unknown>;
    const authority = matrix.inlineTransactions as Record<string, unknown>;
    expect(
      validateInlineTransactionCompatibility(
        { ...matrix, inlineTransactions: { ...authority, ...override } },
        runtimeInline,
      ),
    ).not.toEqual([]);
  });

  it("evaluates candidates without changing the working lockfile", async () => {
    const before = await readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");
    const matrix = await readJson("docs/template/convex-compatibility.json");
    const candidate = await readJson(
      "tooling/convex-compat/__fixtures__/candidate.json",
    );
    evaluateCompatibilitySet(matrix, candidate);
    const after = await readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");
    expect(after).toBe(before);
  });
});

const runtimeInline = {
  supportedConvexVersion: PINNED_INLINE_CONVEX_VERSION,
  supportedFields: INLINE_TRANSACTION_LIMIT_FIELDS,
  presets: INLINE_TRANSACTION_PRESETS,
} as const;

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}
