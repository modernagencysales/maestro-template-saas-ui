import { describe, expect, it } from "vitest";
import {
  presentBuildReadiness,
  type BuildReadinessInput,
} from "./presenter.js";

const input = (overrides: Partial<BuildReadinessInput> = {}) => ({
  app: {
    name: "My App",
    firstOutcome: "Track client requests",
    demoOnly: true,
  },
  blueprint: { id: "saas-application", workflowSelected: false },
  recipe: null,
  preflight: {
    worksNow: "The fake app and record create/read loop work now.",
    demoOnly: "Provider-backed persistence is demo-only.",
    safeToStart: true,
    diagnostics: [],
  },
  providers: [{ id: "convex", posture: "sample" as const }],
  providerEnvironments: [],
  surfaces: [
    {
      id: "workspace-membership",
      kind: "screen" as const,
      status: "real" as const,
    },
    { id: "fake-record-crud", kind: "data" as const, status: "fake" as const },
    {
      id: "local-convex-record-crud",
      kind: "data" as const,
      status: "seam" as const,
    },
  ],
  receipt: null,
  ...overrides,
});

describe("build readiness presenter", () => {
  it("presents a useful fake-mode customer summary without claiming automation", () => {
    const view = presentBuildReadiness(input());

    expect(view).toMatchObject({
      title: "My App Build Readiness",
      whatWorksNow: "The fake app and record create/read loop work now.",
      whatIsDemoOnly: "Provider-backed persistence is demo-only.",
      selection: {
        blueprint: "saas-application",
        recipe: "No recipe selected",
      },
      summary: {
        screens: "Available",
        data: "Fake data works now; local persistence is a reviewed seam.",
        connections: "Convex: fake",
      },
      receipt: {
        status: "Not verified",
        subject: "No Maestro verification receipt",
        detail: "Run pnpm maestro -- verify --scope focused",
      },
    });
    expect(view.summary).not.toHaveProperty("automations");
    expect(view.nextActions).toEqual(["pnpm maestro -- check --mode fake"]);
  });

  it("says automation only when a selected recipe actually requires it", () => {
    const view = presentBuildReadiness(
      input({
        blueprint: { id: "saas-application", workflowSelected: true },
        recipe: {
          id: "approval-background-automation",
          outcome: "Run approved background work",
          automationSelected: true,
        },
      }),
    );

    expect(view.summary.automations).toBe("Selected and review-gated");
    expect(view.selection.recipe).toContain("approval-background-automation");
  });

  it.each(["seam", "unverified"] as const)(
    "does not claim a %s screen is available",
    (status) => {
      const view = presentBuildReadiness(
        input({
          surfaces: [
            {
              id: "workspace-membership",
              kind: "screen",
              status,
            },
          ],
        }),
      );

      expect(view.summary.screens).toBe("Not verified");
    },
  );

  it("projects independent per-environment provider posture", () => {
    const view = presentBuildReadiness(
      input({
        providerEnvironments: [
          {
            environment: "dev",
            providers: [
              { id: "email", state: "fake", evidence: [] },
              {
                id: "llm",
                state: "verified",
                evidence: [
                  {
                    kind: "verification",
                    ref: "receipt:llm-dev",
                    secretNames: ["LLM_API_KEY"],
                    expiresAt: "2026-08-02T12:00:00.000Z",
                  },
                ],
              },
            ],
          },
          {
            environment: "production",
            providers: [{ id: "llm", state: "seam", evidence: [] }],
          },
        ],
      }),
    );

    expect(view.details.providerEnvironments).toEqual([
      {
        environment: "dev",
        providers: [
          { id: "email", state: "fake", evidence: [] },
          {
            id: "llm",
            state: "verified",
            evidence: [
              {
                kind: "verification",
                ref: "receipt:llm-dev",
                secretNames: ["LLM_API_KEY"],
                expiresAt: "2026-08-02T12:00:00.000Z",
              },
            ],
          },
        ],
      },
      {
        environment: "production",
        providers: [{ id: "llm", state: "seam", evidence: [] }],
      },
    ]);
  });

  it("presents receipt subject and staleness without exposing fingerprints", () => {
    const view = presentBuildReadiness(
      input({
        receipt: {
          subject: { commit: "abc123", dirty: false },
          createdAt: "2026-07-25T12:00:00.000Z",
          status: "pass",
          staleness: { stale: true, reasons: ["commit-changed"] },
        },
      }),
    );

    expect(view.receipt).toEqual({
      status: "Stale",
      subject: "abc123 (clean)",
      verifiedAt: "2026-07-25T12:00:00.000Z",
      detail: "commit changed",
    });
  });

  it.each([
    [
      "current",
      {
        subject: { commit: "abc123", dirty: false },
        createdAt: "2026-07-25T12:00:00.000Z",
        status: "pass" as const,
        staleness: { stale: false as const, reasons: [] },
      },
      { status: "Passed", subject: "abc123 (clean)" },
    ],
    [
      "failed",
      {
        subject: { commit: "abc123", dirty: true },
        createdAt: "2026-07-25T12:00:00.000Z",
        status: "fail" as const,
        staleness: { stale: false as const, reasons: [] },
      },
      { status: "Failed", subject: "abc123 (dirty)" },
    ],
    [
      "malformed",
      { malformed: true as const },
      {
        status: "Invalid",
        subject: "Malformed Maestro verification receipt",
        detail: "Run pnpm maestro -- verify --scope focused",
      },
    ],
  ])("presents a distinct %s receipt state", (_name, receipt, expected) => {
    expect(presentBuildReadiness(input({ receipt })).receipt).toMatchObject(
      expected,
    );
  });

  it("derives at most three deterministic safe actions", () => {
    const view = presentBuildReadiness(
      input({
        preflight: {
          worksNow: "Fake mode works.",
          demoOnly: "Connections are not configured.",
          safeToStart: false,
          diagnostics: [
            { rerun: "pnpm maestro -- preflight --mode fake" },
            { rerun: "pnpm maestro -- doctor convex --environment fake" },
            { rerun: "pnpm maestro -- check --mode fake" },
            { rerun: "pnpm ignored fourth action" },
          ],
        },
      }),
    );

    expect(view.nextActions).toEqual([
      "pnpm maestro -- preflight --mode fake",
      "pnpm maestro -- doctor convex --environment fake",
      "pnpm maestro -- check --mode fake",
    ]);
  });
});
