import { describe, expect, it } from "vitest";
import {
  findingFingerprint,
  formatFreezeComment,
  freezeFindingSet,
  readReviewHistory,
  readFrozenFiles,
  runRounds,
  verifyFrozenFindingSet,
  type ReviewFinding,
} from "./ai-review-cycle.mts";

const finding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  gate: "contract",
  rubricVersion: "contract-v1",
  clause: "ARCH-1",
  path: "apps/web/src/a.ts",
  line: 10,
  issue: "mixed responsibility",
  ...overrides,
});

describe("bounded AI review", () => {
  it("fingerprints ignore line drift but bind rubric clause path and issue", () => {
    expect(findingFingerprint(finding())).toBe(
      findingFingerprint(finding({ line: 40 })),
    );
    expect(findingFingerprint(finding())).not.toBe(
      findingFingerprint(finding({ clause: "ARCH-2" })),
    );
  });

  it("never expands the frozen blocking set", async () => {
    const frozen = freezeFindingSet([finding()]);
    const frozenFinding = frozen.findings[0];
    if (frozenFinding === undefined)
      throw new Error("test fixture did not freeze");
    const verdict = await verifyFrozenFindingSet(frozen, {
      round: 1,
      judge: async () => ({
        resolutions: [
          { fingerprint: frozenFinding.fingerprint, status: "resolved" },
          { fingerprint: "brand-new", status: "unresolved" },
        ],
        followUpFindings: [finding({ issue: "brand new issue" })],
      }),
    });
    expect(verdict.blockingFingerprints).toEqual([]);
    expect(verdict.followUpFindings).toHaveLength(1);
  });

  it("stops after two repair rounds with the original unresolved set", async () => {
    const frozen = freezeFindingSet([finding()]);
    const result = await runRounds(
      frozen,
      async (supplied) => ({
        resolutions: supplied.map(({ fingerprint }) => ({
          fingerprint,
          status: "unresolved" as const,
        })),
        followUpFindings: [],
      }),
      { maxRepairRounds: 2 },
    );
    expect(result.status).toBe("escalated");
    expect(result.round).toBe(2);
    expect(result.blockingFingerprints).toEqual(result.frozenFingerprints);
  });

  it("provider failures consume no repair round", async () => {
    const frozen = freezeFindingSet([finding()]);
    const verdict = await verifyFrozenFindingSet(frozen, {
      round: 1,
      judge: async () => {
        throw new Error("provider unavailable");
      },
    });
    expect(verdict.status).toBe("infrastructure_blocked");
    expect(verdict.roundConsumed).toBe(false);
  });

  it("uses the oldest valid immutable freeze and rejects conflicting freezes", () => {
    const first = formatFreezeComment({
      prNumber: 12,
      headSha: "a".repeat(40),
      frozen: freezeFindingSet([finding()]),
    });
    const same = formatFreezeComment({
      prNumber: 12,
      headSha: "a".repeat(40),
      frozen: freezeFindingSet([finding()]),
    });
    expect(
      readReviewHistory([
        { id: 2, body: same },
        { id: 1, body: first },
      ]).freeze?.headSha,
    ).toBe("a".repeat(40));
    const conflict = formatFreezeComment({
      prNumber: 12,
      headSha: "b".repeat(40),
      frozen: freezeFindingSet([finding({ issue: "other" })]),
    });
    expect(() =>
      readReviewHistory([
        { id: 1, body: first },
        { id: 2, body: conflict },
      ]),
    ).toThrow(/conflicting freeze/);
  });

  it("rejects frozen paths outside the candidate root", () => {
    const frozenFinding = freezeFindingSet([finding({ path: "../secret" })])
      .findings[0];
    if (frozenFinding === undefined)
      throw new Error("test fixture did not freeze");
    expect(() =>
      readFrozenFiles("/repo", [frozenFinding], () => "secret"),
    ).toThrow(/outside candidate root/);
  });
});
