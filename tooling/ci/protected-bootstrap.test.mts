import { describe, expect, it } from "vitest";
import {
  planProtectedTransition,
  verifyProtectedBootstrap,
  type ProtectedTransitionJournal,
} from "./protected-bootstrap.mts";

const sha = (value: string) => `sha256:${value.padEnd(64, "0")}` as const;

const journal: ProtectedTransitionJournal = {
  schemaVersion: 1,
  observation: {
    repository: "modernagencysales/maestro-template-saas-ui",
    baseRef: "main",
    protectedBaseOid: "15d2269f2b22e3a52e3a98c481b7d69cb7fef12f",
    controllerImageDigest: sha("1"),
    appId: 123,
    canonicalContext: "ci/woodpecker/pr/verify",
    temporaryContext: "ci/woodpecker/pr/protected-bootstrap",
    woodpeckerConfigDigest: sha("2"),
    githubRulesetDigest: sha("3"),
  },
  steps: [],
};

describe("protected CI bootstrap", () => {
  it("rejects observations that are not bound to the protected trust root", () => {
    expect(verifyProtectedBootstrap(journal.observation)).toEqual([]);
    expect(
      verifyProtectedBootstrap({ ...journal.observation, appId: 0 }),
    ).toContain("appId must be a positive integer");
    expect(
      verifyProtectedBootstrap({
        ...journal.observation,
        temporaryContext: "ci/woodpecker/pr/verify",
      }),
    ).toContain("temporaryContext must differ from canonicalContext");
  });

  it("creates an exact preview confirmation bound to live state", () => {
    const plan = planProtectedTransition({
      action: "install-temporary",
      journal,
      expectedLiveDigest: sha("4"),
    });
    expect(plan.previewFingerprint).toMatch(
      /^protected_transition_sha256:[a-f0-9]{64}$/u,
    );
    expect(plan.confirmationArgv).toEqual([
      "install-temporary",
      "--expected-live-digest",
      sha("4"),
      "--confirm",
      plan.previewFingerprint,
    ]);
  });
});
