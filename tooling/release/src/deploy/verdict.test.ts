import { describe, expect, it } from "vitest";

import {
  MAX_PROMOTION_VERDICT_TTL_MS,
  parsePromotionVerdict,
  PromotionVerdictContractError,
  type PromotionVerdict,
} from "./contract.js";
import {
  hashPromotionVerdictPayload,
  issuePromotionVerdict,
  promotionVerdictPayload,
  type IssuePromotionVerdictInput,
} from "./verdict.js";
import {
  verifyPromotionVerdict,
  type PromotionVerdictExpectation,
} from "./verify.js";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const now = 1_000_000;
const fixedNonce = "promotion_nonce_0001";

const input = (): IssuePromotionVerdictInput => ({
  fromEnvironment: "staging",
  toEnvironment: "production",
  targetId: "customer-app",
  commitSha: "a".repeat(40),
  artifactHash: digest("b"),
  compatibility: [
    { component: "agent-pack", version: "7.2.0" },
    { component: "convex", version: "1.42.1" },
    { component: "workflow", version: "0.4.4" },
  ],
  evidence: [
    { class: "artifact-provenance", fingerprint: digest("c") },
    { class: "build-verification", fingerprint: digest("d") },
    { class: "privacy-verification", fingerprint: digest("e") },
  ],
  workflowCensus: {
    capturedAt: now - 10,
    active: 3,
    restartable: 2,
    fingerprint: digest("f"),
  },
  approverClass: "release-controller",
  ttlMs: 60_000,
});

const issue = (overrides: Partial<IssuePromotionVerdictInput> = {}) =>
  issuePromotionVerdict(
    { ...input(), ...overrides },
    { nowMs: () => now, nonce: () => fixedNonce },
  );

const expectation = (
  verdict: PromotionVerdict,
): PromotionVerdictExpectation => ({
  fromEnvironment: verdict.fromEnvironment,
  toEnvironment: verdict.toEnvironment,
  targetId: verdict.targetId,
  commitSha: verdict.commitSha,
  artifactHash: verdict.artifactHash,
  compatibility: verdict.compatibility,
  evidence: verdict.evidence,
  workflowCensus: verdict.workflowCensus,
  approverClass: verdict.approverClass,
  issuedAt: verdict.issuedAt,
  expiresAt: verdict.expiresAt,
  nonce: verdict.nonce,
});

describe("promotion verdict contract", () => {
  it("issues a deterministic, plan-only, short-lived canonical verdict", () => {
    const first = issue();
    const second = issue();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      kind: "promotion-verdict",
      mode: "plan-only",
      decision: "approve",
      issuedAt: now,
      expiresAt: now + 60_000,
      nonce: fixedNonce,
    });
    expect(first.canonicalHash).toBe(
      hashPromotionVerdictPayload(promotionVerdictPayload(first)),
    );
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.compatibility)).toBe(true);
    expect(Object.isFrozen(first.evidence[0])).toBe(true);
    expect(Object.isFrozen(first.workflowCensus)).toBe(true);
  });

  it("clones caller-owned values and never mutates them", () => {
    const mutable = input();
    const compatibility = [...mutable.compatibility];
    const evidence = [...mutable.evidence];
    const verdict = issue({ compatibility, evidence });

    compatibility.push({ component: "web", version: "1.0.0" });
    evidence[0] = {
      class: "artifact-provenance",
      fingerprint: digest("0"),
    };

    expect(verdict.compatibility).toHaveLength(3);
    expect(verdict.evidence[0]?.fingerprint).toBe(digest("c"));
  });

  it.each([
    [
      "unknown field",
      (value: Record<string, unknown>) => {
        value.extra = true;
      },
    ],
    ["missing field", (value: Record<string, unknown>) => delete value.nonce],
    [
      "duplicate evidence",
      (value: Record<string, unknown>) => {
        const evidence = value.evidence as unknown[];
        evidence.push(evidence[0]);
      },
    ],
    [
      "reordered evidence",
      (value: Record<string, unknown>) => {
        (value.evidence as unknown[]).reverse();
      },
    ],
    [
      "duplicate compatibility component",
      (value: Record<string, unknown>) => {
        const compatibility = value.compatibility as unknown[];
        compatibility.push(compatibility[0]);
      },
    ],
  ] as const)("fails the closed parser for %s", (_label, mutate) => {
    const value = structuredClone(issue()) as unknown as Record<
      string,
      unknown
    >;
    mutate(value);
    expect(() => parsePromotionVerdict(value)).toThrow(
      PromotionVerdictContractError,
    );
  });

  it.each([0, -1, 1.5, MAX_PROMOTION_VERDICT_TTL_MS + 1])(
    "rejects invalid lifetime %s",
    (ttlMs) => {
      expect(() => issue({ ttlMs })).toThrow(PromotionVerdictContractError);
    },
  );
});

describe("promotion verdict verification", () => {
  it("accepts only the exact bound target and facts during the validity window", () => {
    const verdict = issue();
    expect(
      verifyPromotionVerdict(verdict, expectation(verdict), {
        nowMs: () => now + 1,
      }),
    ).toEqual({ ok: true, verdict });
  });

  it("detects payload tampering before expectation comparison", () => {
    const verdict = issue();
    const tampered = { ...verdict, artifactHash: digest("0") };
    expect(
      verifyPromotionVerdict(tampered, expectation(verdict), {
        nowMs: () => now + 1,
      }),
    ).toMatchObject({ ok: false, code: "tampered" });
  });

  it.each([
    ["fromEnvironment", "preview"],
    ["toEnvironment", "preview"],
    ["targetId", "other-app"],
    ["commitSha", "0".repeat(40)],
    ["artifactHash", digest("0")],
    ["approverClass", "security-controller"],
    ["issuedAt", now - 1],
    ["expiresAt", now + 59_999],
    ["nonce", "promotion_nonce_0002"],
  ] as const)("rejects an exact %s mismatch", (key, replacement) => {
    const verdict = issue();
    const expected = { ...expectation(verdict), [key]: replacement };
    expect(
      verifyPromotionVerdict(verdict, expected, { nowMs: () => now + 1 }),
    ).toMatchObject({ ok: false, code: "expectation-mismatch" });
  });

  it("rejects recomputed evidence substitution, census drift, and reordering", () => {
    const verdict = issue();
    const substitutedPayload = {
      ...promotionVerdictPayload(verdict),
      evidence: verdict.evidence.map((entry, index) =>
        index === 0 ? { ...entry, fingerprint: digest("0") } : entry,
      ),
    };
    const substituted = {
      ...substitutedPayload,
      canonicalHash: hashPromotionVerdictPayload(substitutedPayload),
    };
    expect(
      verifyPromotionVerdict(substituted, expectation(verdict), {
        nowMs: () => now + 1,
      }),
    ).toMatchObject({ ok: false, code: "expectation-mismatch" });

    const census = {
      ...expectation(verdict),
      workflowCensus: { ...verdict.workflowCensus, active: 4 },
    };
    expect(
      verifyPromotionVerdict(verdict, census, { nowMs: () => now + 1 }),
    ).toMatchObject({ ok: false, code: "expectation-mismatch" });

    const reordered = {
      ...expectation(verdict),
      evidence: [...verdict.evidence].reverse(),
    };
    expect(
      verifyPromotionVerdict(verdict, reordered, { nowMs: () => now + 1 }),
    ).toMatchObject({ ok: false, code: "expectation-mismatch" });
  });

  it("rejects stale, future-issued, and consumed-nonce verdicts", () => {
    const verdict = issue();
    const expected = expectation(verdict);
    expect(
      verifyPromotionVerdict(verdict, expected, {
        nowMs: () => verdict.expiresAt,
      }),
    ).toMatchObject({ ok: false, code: "expired" });
    expect(
      verifyPromotionVerdict(verdict, expected, { nowMs: () => now - 1 }),
    ).toMatchObject({ ok: false, code: "not-yet-valid" });
    expect(
      verifyPromotionVerdict(verdict, expected, {
        nowMs: () => now + 1,
        consumedNonces: new Set([fixedNonce]),
      }),
    ).toMatchObject({ ok: false, code: "nonce-replayed" });
  });
});
