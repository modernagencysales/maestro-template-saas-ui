import { describe, expect, it } from "vitest";

import {
  registerAdmittedActionFrom,
  registerAdmittedUiEntryFrom,
} from "./admitted-action";

const surfaces = [
  {
    id: "draft_action",
    transport: "ui",
    coverageTag: "@covers_draft_action",
    activationJourneyId: "journey_draft",
    authPolicyId: "auth_session_membership_editor",
    authority: { kind: "ui-action", registrationLocator: "draft" },
  },
  {
    id: "shared_action",
    transport: "ui",
    coverageTag: "@covers_shared_action",
    authPolicyId: "auth_session_membership_editor",
    authority: { kind: "ui-action", registrationLocator: "shared" },
  },
] as const;

describe("admitted UI action registration", () => {
  it("omits assembling actions and retains admitted or shared actions", () => {
    const action = () => "ran";
    expect(
      registerAdmittedActionFrom("draft_action", action, surfaces, {
        journey_draft: false,
      }),
    ).toBeUndefined();
    expect(
      registerAdmittedActionFrom("draft_action", action, surfaces, {
        journey_draft: true,
      }),
    ).toBe(action);
    expect(
      registerAdmittedActionFrom("shared_action", action, surfaces, {}),
    ).toBe(action);
  });

  it("fails closed for an unknown or non-UI surface", () => {
    expect(() =>
      registerAdmittedActionFrom("missing", () => undefined, surfaces, {}),
    ).toThrow(/unknown public surface/u);
    expect(() =>
      registerAdmittedActionFrom(
        "command",
        () => undefined,
        [
          {
            ...surfaces[0],
            id: "command",
            transport: "cli",
            authority: { kind: "command", registrationLocator: "draft" },
          },
        ],
        { journey_draft: true },
      ),
    ).toThrow(/not a UI registration/u);
  });

  it("uses the same generated admission map for route registration", () => {
    const route = { path: "/draft" };
    const routeSurface = {
      ...surfaces[0],
      id: "draft_route",
      authority: { kind: "route", registrationLocator: "/draft" },
    } as const;

    expect(
      registerAdmittedUiEntryFrom("draft_route", route, [routeSurface], {
        journey_draft: false,
      }),
    ).toBeUndefined();
    expect(
      registerAdmittedUiEntryFrom("draft_route", route, [routeSurface], {
        journey_draft: true,
      }),
    ).toBe(route);
  });
});
