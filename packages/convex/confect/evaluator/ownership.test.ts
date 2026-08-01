import { describe, expect, it } from "vitest";

import {
  ChallengeConsumed,
  ChallengeExpired,
  consumeEmailVerificationChallenge,
  issueEmailVerificationChallenge,
} from "./ownership";

describe("evaluation report ownership", () => {
  it("stores hashes instead of raw verification or owner tokens", () => {
    const issued = issueEmailVerificationChallenge({
      reportId: "report_1",
      email: " Founder@Example.test ",
      verificationToken: "verify_secret",
      ownerAccessToken: "owner_secret",
      now: 1_000,
      ttlMs: 60_000,
    });

    expect(JSON.stringify(issued.challenge)).not.toContain("verify_secret");
    expect(JSON.stringify(issued.challenge)).not.toContain("owner_secret");
    expect(JSON.stringify(issued.challenge)).not.toContain(
      "Founder@Example.test",
    );
    expect(issued.delivery.email).toBe("founder@example.test");
  });

  it("consumes a verification challenge exactly once", () => {
    const issued = issueEmailVerificationChallenge({
      reportId: "report_1",
      email: "founder@example.test",
      verificationToken: "verify_secret",
      ownerAccessToken: "owner_secret",
      now: 1_000,
      ttlMs: 60_000,
    });

    const consumed = consumeEmailVerificationChallenge({
      challenge: issued.challenge,
      verificationToken: "verify_secret",
      now: 2_000,
    });
    expect(consumed.claim.reportId).toBe("report_1");
    expect(() =>
      consumeEmailVerificationChallenge({
        challenge: consumed.challenge,
        verificationToken: "verify_secret",
        now: 3_000,
      }),
    ).toThrow(ChallengeConsumed);
  });

  it("fails closed after expiry", () => {
    const issued = issueEmailVerificationChallenge({
      reportId: "report_1",
      email: "founder@example.test",
      verificationToken: "verify_secret",
      ownerAccessToken: "owner_secret",
      now: 1_000,
      ttlMs: 100,
    });

    expect(() =>
      consumeEmailVerificationChallenge({
        challenge: issued.challenge,
        verificationToken: "verify_secret",
        now: 1_101,
      }),
    ).toThrow(ChallengeExpired);
  });
});
