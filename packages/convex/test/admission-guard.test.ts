import { describe, expect, it, vi } from "vitest";

import {
  requireAdmittedOperation,
  requireAdmittedSurfaceFrom,
  runAdmittedSurface,
} from "../confect/capabilities/_kit/admissionGuard";
import { applyFeatureFlagAfterAdmission } from "../confect/capabilities/_kit/surfaces";

const surfaces = [
  {
    id: "assembling_action",
    transport: "ui",
    coverageTag: "@covers_assembling_action",
    activationJourneyId: "journey_draft",
    authPolicyId: "auth_session_membership_editor",
    authority: {
      kind: "ui-action",
      registrationLocator: "draft/create",
    },
  },
  {
    id: "shared_action",
    transport: "ui",
    coverageTag: "@covers_shared_action",
    authPolicyId: "auth_session_membership_editor",
    authority: {
      kind: "ui-action",
      registrationLocator: "shared/read",
    },
  },
] as const;

describe("server admission guard", () => {
  it("fails an assembling raw invocation after authentication and before authorization or handler", async () => {
    const calls: string[] = [];

    await expect(
      runAdmittedSurface({
        surfaceId: "missing",
        emergencyDenied: false,
        authenticate: async () => calls.push("authenticate"),
        authorizeAndRun: async () => calls.push("handler"),
      }),
    ).rejects.toThrow(/unknown public surface/u);
    expect(calls).toEqual(["authenticate"]);
  });

  it("allows shared and admitted surfaces but emergency denial can only disable", () => {
    expect(() =>
      requireAdmittedSurfaceFrom("shared_action", false, surfaces, {
        journey_draft: false,
      }),
    ).not.toThrow();
    expect(() =>
      requireAdmittedSurfaceFrom("assembling_action", false, surfaces, {
        journey_draft: true,
      }),
    ).not.toThrow();
    expect(() =>
      requireAdmittedSurfaceFrom("assembling_action", true, surfaces, {
        journey_draft: true,
      }),
    ).toThrow(/emergency/u);
  });

  it("fails closed for unknown surfaces", () => {
    expect(() =>
      requireAdmittedSurfaceFrom("missing", false, surfaces, {}),
    ).toThrow(/unknown public surface/u);
  });

  it("maps a registered API locator to the generated surface authority", () => {
    expect(() =>
      requireAdmittedOperation("ops/flags:evaluate", "api"),
    ).not.toThrow();
    expect(() =>
      requireAdmittedOperation("not-a-registered-operation", "api"),
    ).toThrow(/unknown admitted api operation/u);
  });

  it("evaluates feature flags after admission and never turns false admission true", () => {
    expect(applyFeatureFlagAfterAdmission(false, false)).toBe(false);
    expect(applyFeatureFlagAfterAdmission(false, true)).toBe(false);
    expect(applyFeatureFlagAfterAdmission(true, false)).toBe(false);
    expect(applyFeatureFlagAfterAdmission(true, true)).toBe(true);
  });

  it("does not invoke business logic when the actual generated guard rejects", async () => {
    const handler = vi.fn();
    await expect(
      runAdmittedSurface({
        surfaceId: "missing",
        emergencyDenied: false,
        authenticate: async () => undefined,
        authorizeAndRun: handler,
      }),
    ).rejects.toThrow(/unknown public surface/u);
    expect(handler).not.toHaveBeenCalled();
  });
});
