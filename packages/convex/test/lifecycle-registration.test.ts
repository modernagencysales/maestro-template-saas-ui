import { describe, expect, it } from "vitest";
import { runAdmittedOperation } from "../confect/capabilities/_kit/admissionGuard";
import { applyFeatureFlagAfterOwnerAdmission } from "../confect/capabilities/_kit/surfaces";
import {
  handleTemplateHttpRequest,
  type HeadlessHttpCtx,
} from "../confect/http";

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

  it("runs the real HTTP adapter in auth, admission, authorization order", async () => {
    const events: string[] = [];
    const ctx: HeadlessHttpCtx = {
      authenticate: async () => {
        events.push("authenticate");
        return { subject: "test-subject" };
      },
      authorize: async () => {
        events.push("authorize");
      },
      runQuery: async () => {
        events.push("run-query");
        return null;
      },
      runMutation: async () => {
        events.push("run-mutation");
        return { id: "page_1" };
      },
      runAction: async () => {
        events.push("run-action");
        return null;
      },
    };

    const response = await handleTemplateHttpRequest(
      ctx,
      new Request("https://template.local/api/brain.pages.createMarkdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "acme-demo",
          input: { slug: "a-note", title: "A note", markdown: "# A note" },
          idempotencyKey: "order-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(events.slice(0, 3)).toEqual([
      "authenticate",
      "authorize",
      "run-mutation",
    ]);
  });
});
