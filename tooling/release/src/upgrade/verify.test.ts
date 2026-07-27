import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { verifyAppliedUpgrade } from "./verify.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

const candidate = () => {
  const planInput = fixture();
  const plan = planUpgrade(planInput);
  if (!plan.ok) throw new Error("fixture must plan successfully");
  const paths = plan.diff.flatMap((entry) => {
    if (entry.kind === "delete")
      return [{ path: entry.path, state: "absent" as const }];
    if (entry.kind === "move")
      return [
        { path: entry.fromPath ?? "", state: "absent" as const },
        {
          path: entry.path,
          state: "present" as const,
          hash: entry.afterHash ?? "",
        },
      ];
    return [
      {
        path: entry.path,
        state: "present" as const,
        hash: entry.afterHash ?? "",
      },
    ];
  });
  return {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: plan.planFingerprint,
    observed: {
      preUpgradeCommit: plan.targetCommit,
      upgradedCommit: "b".repeat(40),
      clean: true,
      paths,
    },
  };
};

const codes = (input: unknown): readonly string[] => {
  const result = verifyAppliedUpgrade(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("applied upgrade verification", () => {
  it("binds an exact clean after-state to the reviewed plan and commits", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = verifyAppliedUpgrade(input);
    const second = verifyAppliedUpgrade({
      observed: {
        ...input.observed,
        paths: [...input.observed.paths].reverse(),
      },
      expectedPlanFingerprint: input.expectedPlanFingerprint,
      planInput: input.planInput,
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "verify-only",
      writeAvailable: false,
      applied: true,
      verified: true,
      preUpgradeCommit: "a".repeat(40),
      upgradedCommit: "b".repeat(40),
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("cannot mistake a plan-only result for an applied upgrade", () => {
    const input = candidate();
    expect(
      codes({
        schemaVersion: 1,
        planInput: input.planInput,
        expectedPlanFingerprint: input.expectedPlanFingerprint,
      }),
    ).toEqual(["UPGRADE_VERIFY_INPUT_INVALID"]);
  });

  it("rejects a blocked plan and stale plan fingerprint", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        planInput: {
          ...input.planInput,
          target: { ...input.planInput.target, relation: "older" },
        },
      }),
    ).toEqual(["UPGRADE_VERIFY_PLAN_BLOCKED"]);
    expect(
      codes({
        ...input,
        expectedPlanFingerprint: `sha256:${"0".repeat(64)}`,
      }),
    ).toEqual(["UPGRADE_VERIFY_FINGERPRINT_MISMATCH"]);
  });

  it("rejects dirty, mismatched, or unchanged commits", () => {
    const input = candidate();
    expect(
      codes({ ...input, observed: { ...input.observed, clean: false } }),
    ).toContain("UPGRADE_VERIFY_TARGET_DIRTY");
    expect(
      codes({
        ...input,
        observed: { ...input.observed, preUpgradeCommit: "c".repeat(40) },
      }),
    ).toContain("UPGRADE_VERIFY_PRE_COMMIT_MISMATCH");
    expect(
      codes({
        ...input,
        observed: {
          ...input.observed,
          upgradedCommit: input.observed.preUpgradeCommit,
        },
      }),
    ).toContain("UPGRADE_VERIFY_COMMIT_NOT_ADVANCED");
  });

  it("rejects mismatched after hashes", () => {
    const input = candidate();
    const paths = input.observed.paths.map((entry, index) =>
      index === 0 && entry.state === "present"
        ? { ...entry, hash: `sha256:${"0".repeat(64)}` }
        : entry,
    );
    expect(
      codes({ ...input, observed: { ...input.observed, paths } }),
    ).toContain("UPGRADE_VERIFY_AFTER_HASH_MISMATCH");
  });

  it("requires explicit absence for deletes and move sources", () => {
    const input = candidate();
    const absentIndex = input.observed.paths.findIndex(
      ({ state }) => state === "absent",
    );
    expect(absentIndex).toBeGreaterThanOrEqual(0);
    const absent = input.observed.paths[absentIndex];
    if (!absent) return;
    const paths = input.observed.paths.map((entry, index) =>
      index === absentIndex
        ? {
            path: absent.path,
            state: "present" as const,
            hash: `sha256:${"9".repeat(64)}`,
          }
        : entry,
    );
    expect(
      codes({ ...input, observed: { ...input.observed, paths } }),
    ).toContain("UPGRADE_VERIFY_EXPECTED_ABSENT");
  });

  it("rejects missing, duplicate, unexpected, and unknown evidence", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        observed: { ...input.observed, paths: input.observed.paths.slice(1) },
      }),
    ).toContain("UPGRADE_VERIFY_EVIDENCE_MISSING");
    expect(
      codes({
        ...input,
        observed: {
          ...input.observed,
          paths: [...input.observed.paths, input.observed.paths[0]],
        },
      }),
    ).toEqual(["UPGRADE_VERIFY_INPUT_INVALID"]);
    expect(
      codes({
        ...input,
        observed: {
          ...input.observed,
          paths: [
            ...input.observed.paths,
            { path: "unexpected.ts", state: "absent" },
          ],
        },
      }),
    ).toContain("UPGRADE_VERIFY_EVIDENCE_UNEXPECTED");
    expect(codes({ ...input, execute: true })).toEqual([
      "UPGRADE_VERIFY_INPUT_INVALID",
    ]);
  });
});
