import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  WorkflowPrincipal,
  WorkflowSystemPrincipal,
  WorkflowUserPrincipal,
  hasReservedWorkflowIdentityField,
} from "../confect/workflows/_kit/principal";
import {
  WorkflowPolicyPosture,
  policyPosture,
} from "../confect/workflows/_kit/policySnapshot";

describe("workflow principal foundation", () => {
  it("decodes versioned user and system principals without credentials", () => {
    const user = {
      version: 1,
      kind: "user",
      workspaceId: "workspace_123",
      actorId: "user_123",
      role: "editor",
      grants: ["brief:write"],
      authEpoch: 7,
      kickoffAt: 100,
      provenance: "authenticated-workflow-start",
    } as const;
    const system = {
      version: 1,
      kind: "system",
      workspaceId: "workspace_123",
      systemId: "retention-sweep",
      reason: "bounded retention sweep",
      grants: ["workflow:cleanup"],
      kickoffAt: 100,
    } as const;

    expect(Schema.decodeUnknownSync(WorkflowUserPrincipal)(user)).toEqual(user);
    expect(Schema.decodeUnknownSync(WorkflowSystemPrincipal)(system)).toEqual(
      system,
    );
    expect(Schema.decodeUnknownSync(WorkflowPrincipal)(user)).toEqual(user);
    expect(JSON.stringify([user, system])).not.toMatch(
      /token|credential|providerPayload/,
    );
  });

  it.each(["workspaceId", "actorId", "role", "grants", "systemId"])(
    "reserves caller-controlled identity field %s",
    (field) =>
      expect(hasReservedWorkflowIdentityField({ [field]: "x" })).toBe(true),
  );

  it("allows public inputs that contain no reserved identity fields", () => {
    expect(
      hasReservedWorkflowIdentityField({ request: "brief", sourceIds: [] }),
    ).toBe(false);
  });
});

describe("workflow policy posture foundation", () => {
  it("requires an explicit reason when no policy snapshot is used", () => {
    expect(policyPosture.none("No policy-dependent decisions.")).toEqual({
      kind: "none",
      reason: "No policy-dependent decisions.",
    });
    expect(() =>
      Schema.decodeUnknownSync(WorkflowPolicyPosture)({
        kind: "none",
        reason: "",
      }),
    ).toThrow();
  });

  it("pins a named schema, version, and hash", () => {
    const pinned = policyPosture.pinned({
      schemaName: "briefPolicy.v1",
      policyVersionId: "policy_123",
      policyHash: "sha256:abc",
    });
    expect(Schema.decodeUnknownSync(WorkflowPolicyPosture)(pinned)).toEqual(
      pinned,
    );
  });
});
