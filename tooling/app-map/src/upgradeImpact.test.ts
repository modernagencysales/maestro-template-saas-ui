import { describe, expect, it } from "vitest";

import { readFixture } from "./test-fixtures";
import { projectReviewedUpgradeImpact } from "./upgradeImpact";

const targetCommit = "1".repeat(40);
const reviewedPaths = ["docs/template/data-resources.json"];
const review = () => ({
  schemaVersion: 1 as const,
  authority: "reviewed-upgrade-plan" as const,
  transitionId: "v0.1.0-alpha.1-to-v0.2.0-alpha.1",
  manifestFingerprint: `sha256:${"a".repeat(64)}`,
  planFingerprint: `sha256:${"b".repeat(64)}`,
  targetCommit,
  reviewedPaths,
  impactInput: {
    schemaVersion: 1 as const,
    baseRevision: targetCommit,
    mapInput: readFixture("valid"),
    changedPaths: reviewedPaths,
  },
});

describe("reviewed upgrade impact projection", () => {
  it("binds reviewed upgrade authority to complete canonical App Map impact", () => {
    const result = projectReviewedUpgradeImpact(review());

    expect(result).toMatchObject({
      ok: true,
      value: {
        schemaVersion: 1,
        authority: "reviewed-upgrade-plan",
        transitionId: "v0.1.0-alpha.1-to-v0.2.0-alpha.1",
        targetCommit,
        impact: {
          complete: true,
          risk: "high",
          changedPaths: reviewedPaths,
          affected: { durableData: ["table:brainPages"] },
        },
      },
    });
  });

  it.each([
    { reviewedPaths: ["apps/web/src/routeTree.gen.ts"] },
    { targetCommit: "2".repeat(40) },
    {
      reviewedPaths: ["docs/unmapped.md"],
      impactInput: {
        ...review().impactInput,
        changedPaths: ["docs/unmapped.md"],
      },
    },
    { authority: "self-asserted" },
    { extra: true },
  ])("fails closed for unreviewed or incomplete impact", (override) => {
    expect(
      projectReviewedUpgradeImpact({ ...review(), ...override }),
    ).toMatchObject({
      ok: false,
      diagnostic: {
        code: expect.stringMatching(
          /^APP_MAP_UPGRADE_IMPACT_(?:INVALID_REVIEW|INCOMPLETE)$/,
        ),
      },
    });
  });
});
