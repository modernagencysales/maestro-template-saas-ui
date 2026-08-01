import { describe, expect, it } from "vitest";
import type { JourneyDriver, JourneyPlan } from "./runner";
import {
  runJourney,
  toJourneyEvidenceJson,
  toJourneyEvidenceMarkdown,
} from "./runner";

const plan: JourneyPlan = {
  journeyId: "workspace-export",
  journeyVersion: 1,
  commitSha: "commit-1",
  environment: "test",
  providerPosture: "fake",
  syntheticPersona: "synthetic-admin",
  scenarios: [
    {
      id: "export-fails",
      expectedTerminalOutcome: "export-visible",
      interactions: [
        { id: "start", receipt: { handle: "first", kind: "export.started" } },
        { id: "poll", receipt: { handle: "second", kind: "export.ready" } },
        {
          id: "download",
          receipt: { handle: "third", kind: "export.downloaded" },
        },
      ],
    },
  ],
};

const driver = (failure?: string): JourneyDriver => ({
  identity: async () => ({ environment: "test", deploymentIdentity: "fake-1" }),
  invoke: async (interaction) => {
    if (interaction.id === failure) throw new Error("password=top-secret");
    return {
      outcome: interaction.id === "download" ? "export-visible" : "pending",
    };
  },
  inspectReceipt: async ({ handle }) => ({
    kind: "receipt",
    handle,
    apiKey: "do-not-leak",
    nested: { token: "also-secret" },
  }),
});

describe("runJourney", () => {
  it("orders boundaries and marks later work not reached after the earliest failure", async () => {
    const report = await runJourney(plan, driver("poll"));

    expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual(
      ["passed", "failed", "not_reached"],
    );
    expect(report.scenarios[0]?.earliestFailedBoundary).toBe("poll");
    expect(report.scenarios[0]?.boundaries[1]?.error).not.toContain(
      "top-secret",
    );
  });

  it("creates stable JSON and redacted human-readable evidence", async () => {
    const report = await runJourney(plan, driver());
    const json = toJourneyEvidenceJson(report);
    const markdown = toJourneyEvidenceMarkdown(report);

    expect(json).toBe(toJourneyEvidenceJson(JSON.parse(json)));
    expect(json).not.toContain("do-not-leak");
    expect(markdown).not.toContain("also-secret");
    expect(markdown).toContain("workspace-export");
  });
});
