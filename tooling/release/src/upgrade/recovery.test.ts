import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UpgradePlanInputV1 } from "./contract.js";
import { planUpgrade } from "./plan.js";
import { planUpgradeRecovery } from "./recovery.js";

const fixture = (): UpgradePlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL("../../__fixtures__/upgrade/clean.json", import.meta.url),
      "utf8",
    ),
  ) as UpgradePlanInputV1;

const verification = () => {
  const planInput = fixture();
  const plan = planUpgrade(planInput);
  if (!plan.ok) throw new Error("fixture must plan successfully");
  return {
    schemaVersion: 1,
    planInput,
    expectedPlanFingerprint: plan.planFingerprint,
    observed: {
      preUpgradeCommit: plan.targetCommit,
      upgradedCommit: "b".repeat(40),
      clean: true,
      paths: plan.diff.flatMap((entry) =>
        entry.kind === "delete"
          ? [{ path: entry.path, state: "absent" as const }]
          : entry.kind === "move"
            ? [
                { path: entry.fromPath ?? "", state: "absent" as const },
                {
                  path: entry.path,
                  state: "present" as const,
                  hash: entry.afterHash ?? "",
                },
              ]
            : [
                {
                  path: entry.path,
                  state: "present" as const,
                  hash: entry.afterHash ?? "",
                },
              ],
      ),
    },
  };
};

const candidate = () => ({
  schemaVersion: 1,
  verification: verification(),
  request: {
    id: "recover-upgrade-001",
    requestedAt: "2026-08-09T00:00:00.000Z",
    reason: "Verified upgrade must be reverted after review.",
    operatorApprovalRequired: true,
  },
});

const codes = (input: unknown): readonly string[] => {
  const result = planUpgradeRecovery(input);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.resolutions.map(({ code }) => code);
};

describe("upgrade recovery planning", () => {
  it("binds an inert reviewed Git recovery plan to the verified commits", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const first = planUpgradeRecovery(input);
    const second = planUpgradeRecovery({
      request: {
        operatorApprovalRequired: true,
        reason: input.request.reason,
        requestedAt: input.request.requestedAt,
        id: input.request.id,
      },
      verification: input.verification,
      schemaVersion: 1,
    });
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mode: "plan-only",
      executionAvailable: false,
      strategy: "reviewed-git-revert",
      fromCommit: "b".repeat(40),
      restoreCommit: "a".repeat(40),
      operatorApprovalRequired: true,
      operatorCommand: `git revert --no-commit ${"a".repeat(40)}..${"b".repeat(40)}`,
      customRollbackEngine: false,
      dataRecovery: "separate-authorized-plan",
      providerRecovery: "separate-operator-plan",
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("fails closed when the applied after-state is not verified", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        verification: {
          ...input.verification,
          expectedPlanFingerprint: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toEqual(["UPGRADE_RECOVERY_VERIFICATION_FAILED"]);
  });

  it("requires explicit approval posture and canonical request facts", () => {
    const input = candidate();
    expect(
      codes({
        ...input,
        request: { ...input.request, operatorApprovalRequired: false },
      }),
    ).toEqual(["UPGRADE_RECOVERY_INPUT_INVALID"]);
    expect(
      codes({
        ...input,
        request: { ...input.request, requestedAt: "not-a-timestamp" },
      }),
    ).toEqual(["UPGRADE_RECOVERY_INPUT_INVALID"]);
  });

  it("rejects mutation controls and data or provider recovery payloads", () => {
    const input = candidate();
    expect(codes({ ...input, write: true })).toEqual([
      "UPGRADE_RECOVERY_INPUT_INVALID",
    ]);
    expect(codes({ ...input, dataRecovery: { execute: true } })).toEqual([
      "UPGRADE_RECOVERY_INPUT_INVALID",
    ]);
    expect(codes({ ...input, providerRecovery: { execute: true } })).toEqual([
      "UPGRADE_RECOVERY_INPUT_INVALID",
    ]);
  });
});
