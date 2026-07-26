import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

const codes = (input: unknown): readonly string[] => {
  const result = planUpgrade(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("read-only upgrade planning", () => {
  it("produces a deterministic plan and exact classified diff", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const first = planUpgrade(input);
    const second = planUpgrade({
      ...input,
      manifest: {
        ...input.manifest,
        operations: [...input.manifest.operations].reverse(),
      },
      target: { ...input.target, files: [...input.target.files].reverse() },
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "plan-only",
      writeAvailable: false,
      manifestFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      planFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      diff: [
        { classification: "regenerate-generated" },
        { classification: "move-template" },
        { classification: "modify-template" },
        { classification: "add-template" },
      ],
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    ["older", "UPGRADE_SOURCE_OLDER"],
    ["skipped", "UPGRADE_SOURCE_SKIPPED"],
    ["newer", "UPGRADE_SOURCE_NEWER"],
  ] as const)("fails closed for an unsupported %s source", (relation, code) => {
    const input = fixture();
    expect(
      codes({ ...input, target: { ...input.target, relation } }),
    ).toContain(code);
  });

  it("requires the exact reviewed immediate-prior version", () => {
    const input = fixture();
    expect(
      codes({
        ...input,
        target: { ...input.target, version: "0.1.0-alpha.other" },
      }),
    ).toContain("UPGRADE_SOURCE_MISMATCH");
  });

  it("stops on customer overlap, unexpected hashes, and ambiguous moves", () => {
    const input = fixture();
    const move = input.manifest.operations.find(({ kind }) => kind === "move");
    expect(move).toBeDefined();
    if (!move) return;
    const resultCodes = codes({
      ...input,
      manifest: {
        ...input.manifest,
        operations: [
          ...input.manifest.operations,
          { ...move, id: "second-move", path: "config/other-policy.ts" },
        ],
      },
      target: {
        ...input.target,
        files: input.target.files.map((file) =>
          file.path === "config/template.ts"
            ? {
                ...file,
                ownership: "customer-owned",
                hash: `sha256:${"9".repeat(64)}`,
              }
            : file,
        ),
      },
    });
    expect(resultCodes).toEqual(
      expect.arrayContaining([
        "UPGRADE_CUSTOMER_OVERLAP",
        "UPGRADE_HASH_MISMATCH",
        "UPGRADE_MOVE_AMBIGUOUS",
      ]),
    );
  });

  it.each([
    ["manual-review", "UPGRADE_MANUAL_REVIEW"],
    ["data-migration", "UPGRADE_DATA_MIGRATION"],
    ["provider-change", "UPGRADE_PROVIDER_CHANGE"],
    ["environment-change", "UPGRADE_ENVIRONMENT_CHANGE"],
  ] as const)("blocks manifest requirement %s", (kind, code) => {
    const input = fixture();
    expect(
      codes({
        ...input,
        manifest: {
          ...input.manifest,
          requirements: [{ id: `require-${kind}`, kind, detail: "blocked" }],
        },
      }),
    ).toContain(code);
  });

  it("rejects unknown fields and malformed operation contracts", () => {
    const input = fixture();
    expect(codes({ ...input, write: true })).toEqual(["UPGRADE_INPUT_INVALID"]);
    expect(
      codes({
        ...input,
        manifest: {
          ...input.manifest,
          operations: [
            ...input.manifest.operations,
            {
              id: "unsafe-regeneration",
              kind: "regenerate",
              path: "customer.ts",
              ownership: "template-owned",
              beforeHash: `sha256:${"1".repeat(64)}`,
              afterHash: `sha256:${"2".repeat(64)}`,
            },
          ],
        },
      }),
    ).toEqual(["UPGRADE_INPUT_INVALID"]);
  });
});
