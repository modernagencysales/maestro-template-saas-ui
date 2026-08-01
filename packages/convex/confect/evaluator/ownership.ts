import { sha256Hex } from "../shared/sha256";

export class ChallengeConsumed extends Error {
  readonly _tag = "ChallengeConsumed";
}

export class ChallengeExpired extends Error {
  readonly _tag = "ChallengeExpired";
}

export class ChallengeTokenInvalid extends Error {
  readonly _tag = "ChallengeTokenInvalid";
}

export type EmailVerificationChallenge = {
  readonly reportId: string;
  readonly emailHash: string;
  readonly verificationTokenHash: string;
  readonly ownerAccessTokenHash: string;
  readonly status: "pending" | "consumed";
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly consumedAt?: number;
};

export type ReportOwnershipClaim = {
  readonly reportId: string;
  readonly ownerAccessTokenHash: string;
  readonly emailHash: string;
  readonly claimedAt: number;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const issueEmailVerificationChallenge = (input: {
  readonly reportId: string;
  readonly email: string;
  readonly verificationToken: string;
  readonly ownerAccessToken: string;
  readonly now: number;
  readonly ttlMs: number;
}): {
  readonly challenge: EmailVerificationChallenge;
  readonly delivery: {
    readonly email: string;
    readonly verificationToken: string;
  };
} => {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@"))
    throw new Error("A valid email is required.");
  if (input.ttlMs <= 0) throw new Error("Challenge TTL must be positive.");
  return {
    challenge: {
      reportId: input.reportId,
      emailHash: sha256Hex(email),
      verificationTokenHash: sha256Hex(input.verificationToken),
      ownerAccessTokenHash: sha256Hex(input.ownerAccessToken),
      status: "pending",
      createdAt: input.now,
      expiresAt: input.now + input.ttlMs,
    },
    delivery: { email, verificationToken: input.verificationToken },
  };
};

export const consumeEmailVerificationChallenge = (input: {
  readonly challenge: EmailVerificationChallenge;
  readonly verificationToken: string;
  readonly now: number;
}): {
  readonly challenge: EmailVerificationChallenge;
  readonly claim: ReportOwnershipClaim;
} => {
  if (input.challenge.status === "consumed") throw new ChallengeConsumed();
  if (input.now > input.challenge.expiresAt) throw new ChallengeExpired();
  if (
    sha256Hex(input.verificationToken) !== input.challenge.verificationTokenHash
  )
    throw new ChallengeTokenInvalid();
  return {
    challenge: {
      ...input.challenge,
      status: "consumed",
      consumedAt: input.now,
    },
    claim: {
      reportId: input.challenge.reportId,
      ownerAccessTokenHash: input.challenge.ownerAccessTokenHash,
      emailHash: input.challenge.emailHash,
      claimedAt: input.now,
    },
  };
};
