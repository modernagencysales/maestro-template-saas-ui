import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MigrationPlanInputV1 } from "./contract.js";
import { planMigrationHandoff } from "./plan.js";

const fixtureNames = [
  "workflow-graph-v1-to-v2",
  "template-instance-v1-to-v2",
  "provider-posture-v1-to-v2",
] as const;

const fixture = (name: (typeof fixtureNames)[number]): MigrationPlanInputV1 =>
  JSON.parse(
    readFileSync(
      new URL(`../../__fixtures__/upgrade/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as MigrationPlanInputV1;

describe("WP-6.4 representative migration fixtures", () => {
  it.each(fixtureNames)(
    "proves the one-prior compatibility handoff for %s",
    (name) => {
      const input = fixture(name);
      const plan = planMigrationHandoff(input);

      expect(plan).toMatchObject({
        ok: true,
        executionAvailable: false,
        steps: [
          { kind: "expand" },
          { kind: "backward-compatible-code" },
          { kind: "preview" },
          { kind: "migrate" },
          { kind: "compatibility-window" },
          { kind: "contract" },
        ],
        fileUpgrade: {
          blocked: true,
          code: "MIGRATION_RECEIPT_REQUIRED",
        },
      });
      expect(input.transition).toMatchObject({
        fromVersion: "0.1.0-alpha.1",
        toVersion: "0.2.0-alpha.1",
        immediatePriorVersion: "0.1.0-alpha.1",
      });
      expect(input.target).toEqual({
        version: "0.1.0-alpha.1",
        relation: "immediate-prior",
      });
      expect(input.phases.map(({ kind }) => kind)).toEqual([
        "expand",
        "backward-compatible-code",
      ]);
      expect(
        input.migration.compatibilityWindow.contractNotBefore >=
          input.migration.compatibilityWindow.endsAt,
      ).toBe(true);
    },
  );

  it("covers rollback and fully evidenced roll-forward recovery", () => {
    const recoveries = fixtureNames.map(
      (name) => fixture(name).migration.recovery,
    );

    expect(recoveries.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["rollback", "roll-forward-only"]),
    );
    for (const recovery of recoveries) {
      if (recovery.kind !== "roll-forward-only") continue;
      expect(recovery).toMatchObject({
        approvalEvidenceRef: expect.any(String),
        backupOrExportEvidenceRef: expect.any(String),
        rollForwardPlan: expect.any(String),
      });
    }
  });
});
