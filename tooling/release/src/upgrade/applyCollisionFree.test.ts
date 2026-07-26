import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { prepareCollisionFreeApply } from "./applyCollisionFree.js";
import { planUpgrade } from "./plan.js";

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
  if (!plan.ok) throw new Error("clean fixture must plan");
  return {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: plan.planFingerprint,
    write: true,
    staging: {
      status: "complete",
      preUpgradeCommit: plan.targetCommit,
      targetClean: true,
      beforePaths: [
        {
          path: "apps/web/src/routeTree.gen.ts",
          state: "present",
          hash: `sha256:${"c".repeat(64)}`,
        },
        {
          path: "config/policy-old.ts",
          state: "present",
          hash: `sha256:${"e".repeat(64)}`,
        },
        { path: "config/policy.ts", state: "absent" },
        {
          path: "config/template.ts",
          state: "present",
          hash: `sha256:${"a".repeat(64)}`,
        },
        { path: "docs/template/new.md", state: "absent" },
      ],
      afterPaths: [
        {
          path: "apps/web/src/routeTree.gen.ts",
          state: "present",
          hash: `sha256:${"d".repeat(64)}`,
        },
        { path: "config/policy-old.ts", state: "absent" },
        {
          path: "config/policy.ts",
          state: "present",
          hash: `sha256:${"f".repeat(64)}`,
        },
        {
          path: "config/template.ts",
          state: "present",
          hash: `sha256:${"b".repeat(64)}`,
        },
        {
          path: "docs/template/new.md",
          state: "present",
          hash: `sha256:${"1".repeat(64)}`,
        },
      ],
    },
  };
};

const codes = (input: unknown): readonly string[] => {
  const result = prepareCollisionFreeApply(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("collision-free apply preparation", () => {
  it("revalidates a bounded staged result without claiming writes or apply", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    expect(prepareCollisionFreeApply(input)).toMatchObject({
      ok: true,
      mode: "apply-safe-preparation",
      promotionReady: true,
      applied: false,
      writePerformed: false,
      executionAvailable: false,
      preUpgradeCommit: "a".repeat(40),
      verifiedPaths: [
        "apps/web/src/routeTree.gen.ts",
        "config/policy-old.ts",
        "config/policy.ts",
        "config/template.ts",
        "docs/template/new.md",
      ],
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    ["write", false, "UPGRADE_APPLY_WRITE_REQUIRED"],
    [
      "expectedPlanFingerprint",
      `sha256:${"9".repeat(64)}`,
      "UPGRADE_APPLY_STALE_PLAN",
    ],
  ] as const)("fails closed for invalid %s authority", (key, value, code) => {
    expect(codes({ ...candidate(), [key]: value })).toContain(code);
  });

  it("rejects a dirty or changed target before promotion", () => {
    const dirty = candidate();
    dirty.staging.targetClean = false;
    expect(codes(dirty)).toContain("UPGRADE_APPLY_TARGET_DIRTY");

    const changed = candidate();
    const path = changed.staging.beforePaths.find(
      (entry) => entry.path === "config/template.ts",
    );
    if (path?.state === "present") path.hash = `sha256:${"9".repeat(64)}`;
    expect(codes(changed)).toContain("UPGRADE_APPLY_BEFORE_MISMATCH");
  });

  it.each(["interrupted", "failed"] as const)(
    "rejects %s staging without partial-apply claims",
    (status) => {
      const input = candidate();
      input.staging.status = status;
      expect(prepareCollisionFreeApply(input)).toMatchObject({
        ok: false,
        applied: false,
        writePerformed: false,
        resolutions: [{ code: "UPGRADE_APPLY_STAGING_INCOMPLETE" }],
      });
    },
  );

  it("rejects staged after-state drift and blocked source plans", () => {
    const drift = candidate();
    drift.staging.afterPaths = drift.staging.afterPaths.filter(
      ({ path }) => path !== "config/policy-old.ts",
    );
    expect(codes(drift)).toContain("UPGRADE_APPLY_AFTER_MISMATCH");

    const blocked = candidate();
    expect(
      codes({
        ...blocked,
        planInput: {
          ...blocked.planInput,
          manifest: {
            ...blocked.planInput.manifest,
            requirements: [
              {
                id: "manual",
                kind: "manual-review",
                detail: "operator review",
              },
            ],
          },
        },
      }),
    ).toContain("UPGRADE_APPLY_PLAN_BLOCKED");
  });

  it("uses a closed input contract and never mutates rejected input", () => {
    const input = { ...candidate(), execute: true };
    const before = JSON.stringify(input);
    expect(codes(input)).toEqual(["UPGRADE_APPLY_INPUT_INVALID"]);
    expect(JSON.stringify(input)).toBe(before);
  });
});
