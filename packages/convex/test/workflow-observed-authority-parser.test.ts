import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

import { decodeObservedWorkflowAuthority } from "../confect/workflows/_kit/observedAuthority";
import { bindObservedWorkflowAuthority as bindCanonicalAuthority } from "../confect/workflows/_kit/observedStage";
import { bindObservedWorkflowAuthority as bindCurrentAuthority } from "../confect/workflows/_kit/observedStageCurrent";

const authority = {
  principal: {
    version: 2,
    kind: "user",
    workspaceId: "workspace-1",
    actorId: "user-1",
    role: "editor",
    grants: ["fixture:dispatch"],
    authEpoch: 1,
    kickoffAt: 1,
    provenance: "authenticated-workflow-start",
  },
  policySnapshot: { version: 1, kind: "none", reason: "No policy." },
} as const;

describe("observed workflow authority parser", () => {
  it("returns the decoded authority through Exit", () => {
    const decoded = decodeObservedWorkflowAuthority(authority);
    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) expect(decoded.value).toEqual(authority);
  });

  it("rejects invalid and excess authority fields", () => {
    expect(
      Exit.isFailure(
        decodeObservedWorkflowAuthority({ ...authority, unexpected: true }),
      ),
    ).toBe(true);
    expect(
      Exit.isFailure(
        decodeObservedWorkflowAuthority({
          ...authority,
          principal: { ...authority.principal, authEpoch: -1 },
        }),
      ),
    ).toBe(true);
  });

  it.each([bindCanonicalAuthority, bindCurrentAuthority])(
    "binds the shared decoded authority in both observed-stage runners",
    (bind) => {
      const decoded = decodeObservedWorkflowAuthority(authority);
      if (Exit.isFailure(decoded)) throw new Error("expected authority");
      expect(
        bind(
          { principal: null, policySnapshot: null },
          { generation: 1, observedAt: 2, authority: decoded.value },
        ),
      ).toEqual(authority);
    },
  );
});
