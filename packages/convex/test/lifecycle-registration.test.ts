import { admittedJourneys } from "@maestro-template/template-core/generated/admittedJourneys";
import { publicSurfaces } from "@maestro-template/template-core/generated/publicSurfaces";
import { describe, expect, it } from "vitest";
import { runAdmittedOperation } from "../confect/capabilities/_kit/admissionGuard";
import { applyFeatureFlagAfterOwnerAdmission } from "../confect/capabilities/_kit/surfaces";
import {
  handleTemplateHttpRequest,
  type HeadlessHttpCtx,
} from "../confect/http";
import templateHttpRouter from "../confect/http";

const createMarkdownRequest = () =>
  new Request("https://template.local/api/brain.pages.createMarkdown", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceSlug: "acme-demo",
      input: { slug: "a-note", title: "A note", markdown: "# A note" },
      idempotencyKey: "order-1",
    }),
  });

const deployableCreateMarkdownHandler = () => {
  const route = templateHttpRouter.lookup(
    "/api/brain.pages.createMarkdown",
    "POST",
  );
  if (route === null) throw new Error("missing deployable HTTP route");
  return (
    route[0] as unknown as {
      readonly _handler: (ctx: unknown, request: Request) => Promise<Response>;
    }
  )._handler;
};

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

  it("denies a real deployable HTTP registration before authorization and its Convex handler", async () => {
    const surface = publicSurfaces.find(
      (candidate) =>
        candidate.transport === "api" &&
        candidate.authority.registrationLocator ===
          "brain.pages.createMarkdown",
    );
    if (surface === undefined) throw new Error("missing HTTP registration");
    const mutableSurface = surface as typeof surface & {
      activationJourneyId?: string;
    };
    const mutableJourneys = admittedJourneys as Record<string, boolean>;
    const events: string[] = [];
    mutableSurface.activationJourneyId = "journey_denied_http";
    mutableJourneys.journey_denied_http = false;
    const handler = deployableCreateMarkdownHandler();

    try {
      await expect(
        handler(
          {
            auth: {
              getUserIdentity: async () => {
                events.push("authenticate");
                return { subject: "test-subject", tokenIdentifier: "test" };
              },
            },
            runQuery: async () => {
              events.push("authorize");
              return null;
            },
            runMutation: async () => {
              events.push("run-mutation");
              return null;
            },
            runAction: async () => {
              events.push("run-action");
              return null;
            },
          } as never,
          createMarkdownRequest(),
        ),
      ).rejects.toThrow("not admitted");
      expect(events).toEqual(["authenticate"]);
    } finally {
      delete mutableSurface.activationJourneyId;
      delete mutableJourneys.journey_denied_http;
    }
  });

  it("runs request-scoped Convex authorization before the deployable HTTP handler", async () => {
    const events: string[] = [];
    const handler = deployableCreateMarkdownHandler();

    await expect(
      handler(
        {
          auth: {
            getUserIdentity: async () => {
              events.push("authenticate");
              return { subject: "test-subject", tokenIdentifier: "test" };
            },
          },
          runQuery: async (_reference: unknown, input: unknown) => {
            events.push(`authorize:${JSON.stringify(input)}`);
            throw new Error("HTTP authorization failed");
          },
          runMutation: async () => {
            events.push("run-mutation");
            return null;
          },
          runAction: async () => {
            events.push("run-action");
            return null;
          },
        } as never,
        createMarkdownRequest(),
      ),
    ).rejects.toThrow("HTTP authorization failed");
    expect(events).toEqual([
      "authenticate",
      'authorize:{"operationId":"brain.pages.createMarkdown","workspaceId":"workspace_123"}',
    ]);
  });
});
