import { describe, expect, it } from "vitest";
import {
  assertNoAdmittedActivationOwnedRegistrations,
  runAdmittedOperation,
  type ActivationRegistration,
} from "../confect/capabilities/_kit/admissionGuard";
import { applyFeatureFlagAfterOwnerAdmission } from "../confect/capabilities/_kit/surfaces";

describe("lifecycle registration guards", () => {
  it("authenticates, admits, then authorizes before running a handler", async () => {
    const events: string[] = [];
    const result = await runAdmittedOperation({
      operationId: "ops/flags:evaluate",
      transport: "api",
      authenticate: async () => {
        events.push("authenticate");
      },
      authorize: async () => {
        events.push("authorize");
      },
      run: async () => {
        events.push("run");
        return "ok";
      },
    });
    expect(result).toBe("ok");
    expect(events).toEqual(["authenticate", "authorize", "run"]);
  });

  it("does not authorize or run an assembling operation", async () => {
    const events: string[] = [];
    await expect(
      runAdmittedOperation({
        operationId: "ops/flags:evaluate",
        transport: "api",
        journeys: { journey_flags: false },
        surfaces: [
          {
            id: "surface_flags",
            transport: "api",
            coverageTag: "@covers_flags",
            activationJourneyId: "journey_flags",
            authPolicyId: "auth_workspace_member",
            authority: {
              kind: "convex-function",
              registrationLocator: "ops/flags:evaluate",
            },
          },
        ],
        authenticate: async () => {
          events.push("authenticate");
        },
        authorize: async () => {
          events.push("authorize");
        },
        run: async () => {
          events.push("run");
          return "unexpected";
        },
      }),
    ).rejects.toThrow("not admitted");
    expect(events).toEqual(["authenticate"]);
  });

  it("proves every activation-owned registration is dark for no-admitted", () => {
    const registrations: readonly ActivationRegistration[] = [
      {
        surfaceId: "surface_flags",
        journeyId: "journey_flags",
        transport: "api",
      },
    ];
    expect(() =>
      assertNoAdmittedActivationOwnedRegistrations(registrations, {
        journey_flags: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertNoAdmittedActivationOwnedRegistrations(registrations, {
        journey_flags: true,
      }),
    ).toThrow("surface_flags");
  });

  it("uses each flag owner's journey instead of one global admission bit", () => {
    const journeys = { journey_flags: false, journey_other: true };
    expect(
      applyFeatureFlagAfterOwnerAdmission(
        "template.onboarding.workspaceBrief",
        true,
        journeys,
        { "template.onboarding.workspaceBrief": "journey_flags" },
      ),
    ).toBe(false);
    expect(
      applyFeatureFlagAfterOwnerAdmission(
        "template.workflow.liveRuns",
        true,
        journeys,
        { "template.workflow.liveRuns": "journey_other" },
      ),
    ).toBe(true);
  });
});
