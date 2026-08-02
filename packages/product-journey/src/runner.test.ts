import { describe, expect, it } from "vitest";
import { stableJourneyJson } from "./redaction";
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
  expectedRuntimeIdentity: {
    environment: "test",
    deploymentIdentity: "fake-1",
  },
  scenarios: [
    {
      id: "export-fails",
      expectedTerminalOutcome: "export-visible",
      interactions: [
        {
          id: "start",
          receipt: { handle: "first", kind: "export.started" },
          expectedReceipt: { state: "started" },
        },
        { id: "poll", receipt: { handle: "second", kind: "export.ready" } },
        {
          id: "download",
          receipt: { handle: "third", kind: "export.downloaded" },
        },
      ],
    },
  ],
};

const receiptKinds: Record<string, string> = {
  first: "export.started",
  second: "export.ready",
  third: "export.downloaded",
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
    kind: receiptKinds[handle],
    handle,
    state: handle === "first" ? "started" : "ready",
    apiKey: "do-not-leak",
    nested: { token: "also-secret" },
    authorization: "Bearer auth-secret",
    note: "session=string-secret",
  }),
});

describe("runJourney", () => {
  it("orders boundaries and marks later work not reached after the earliest failure", async () => {
    const report = await runJourney(plan, driver("poll"));
    expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual(
      ["passed", "failed", "not_reached"],
    );
    expect(report.scenarios[0]?.earliestFailedBoundary).toBe("poll");
  });

  it.each([
    ["wrong", { kind: "wrong-kind" }],
    ["absent", undefined],
    ["wrong content", { kind: "export.started", state: "wrong" }],
  ] as const)("fails a boundary for a %s receipt", async (_name, receipt) => {
    const testedDriver: JourneyDriver = {
      ...driver(),
      inspectReceipt: async ({ handle }) =>
        handle === "first" ? receipt : { kind: receiptKinds[handle] },
    };
    const report = await runJourney(plan, testedDriver);
    expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual(
      ["failed", "not_reached", "not_reached"],
    );
  });

  it("fails the terminal boundary when the declared terminal outcome is wrong", async () => {
    const testedDriver: JourneyDriver = {
      ...driver(),
      invoke: async () => ({ outcome: "unexpected" }),
    };
    const report = await runJourney(plan, testedDriver);
    expect(report.scenarios[0]?.boundaries.at(-1)?.status).toBe("failed");
    expect(report.scenarios[0]?.earliestFailedBoundary).toBe("download");
  });

  it("requires the final declared interaction itself to produce the terminal outcome", async () => {
    const testedDriver: JourneyDriver = {
      ...driver(),
      invoke: async ({ id }) =>
        id === "start" ? { outcome: "export-visible" } : {},
    };
    const report = await runJourney(plan, testedDriver);
    expect(report.scenarios[0]?.boundaries.at(-1)?.status).toBe("failed");
    expect(report.scenarios[0]?.actualTerminalOutcome).toBeUndefined();
  });

  it("fails closed for a zero-interaction scenario", async () => {
    const report = await runJourney(
      {
        ...plan,
        scenarios: [
          {
            id: "empty-interactions",
            expectedTerminalOutcome: "export-visible",
            interactions: [],
          },
        ],
      },
      driver(),
    );
    expect(report.scenarios[0]?.boundaries).toEqual([
      {
        id: "$terminal",
        status: "failed",
        error: "NO_DECLARED_INTERACTION",
      },
    ]);
    expect(report.scenarios[0]?.earliestFailedBoundary).toBe("$terminal");
  });

  it.each([
    [
      "environment",
      { environment: "production", deploymentIdentity: "fake-1" },
    ],
    ["deployment", { environment: "test", deploymentIdentity: "fake-2" }],
  ] as const)(
    "fails before invoking for a %s identity mismatch",
    async (_name, identity) => {
      let invoked = false;
      const testedDriver: JourneyDriver = {
        ...driver(),
        identity: async () => identity,
        invoke: async () => {
          invoked = true;
        },
      };
      const report = await runJourney(plan, testedDriver);
      expect(invoked).toBe(false);
      expect(
        report.scenarios[0]?.boundaries.map(({ status }) => status),
      ).toEqual(["failed", "not_reached", "not_reached"]);
    },
  );

  it.each([
    [
      "throwing identity",
      async () => {
        throw new Error("identity unavailable");
      },
    ],
    ["null identity", async () => null],
    [
      "hostile identity getter",
      async () =>
        Object.defineProperty({}, "environment", {
          get: () => {
            throw new Error("hostile identity");
          },
        }),
    ],
  ])("emits deterministic failed evidence for %s", async (_name, identity) => {
    let invoked = false;
    const testedDriver: JourneyDriver = {
      ...driver(),
      identity: identity as JourneyDriver["identity"],
      invoke: async () => {
        invoked = true;
      },
    };
    const report = await runJourney(plan, testedDriver);
    expect(invoked).toBe(false);
    expect(report.runtimeIdentity).toEqual({ environment: "unknown" });
    expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual(
      ["failed", "not_reached", "not_reached"],
    );
    expect(report.scenarios[0]?.boundaries[0]?.error).toBe(
      "RUNTIME_IDENTITY_UNAVAILABLE",
    );
  });

  it("requires plan, expected, and actual environments to agree", async () => {
    let invoked = false;
    const testedDriver: JourneyDriver = {
      ...driver(),
      invoke: async () => {
        invoked = true;
      },
    };
    const report = await runJourney(
      { ...plan, environment: "production" },
      testedDriver,
    );
    expect(invoked).toBe(false);
    expect(report.scenarios[0]?.boundaries[0]?.status).toBe("failed");
  });

  it("binds an inspected receipt to both requested handle and kind", async () => {
    const testedDriver: JourneyDriver = {
      ...driver(),
      inspectReceipt: async ({ kind }) => ({
        kind,
        handle: "different-handle",
        state: "started",
      }),
    };
    const report = await runJourney(plan, testedDriver);
    expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual(
      ["failed", "not_reached", "not_reached"],
    );
  });

  it("creates stable JSON and renders redacted receipts in Markdown", async () => {
    const report = await runJourney(plan, driver());
    const json = toJourneyEvidenceJson(report);
    const markdown = toJourneyEvidenceMarkdown(report);
    expect(json).toBe(toJourneyEvidenceJson(JSON.parse(json)));
    expect(markdown).toContain('"handle":"first"');
    expect(markdown).toContain("[REDACTED]");
    expect(markdown).not.toContain("auth-secret");
    expect(markdown).not.toContain("string-secret");
  });

  it("redacts and Markdown-escapes every rendered report field", async () => {
    const unsafePlan: JourneyPlan = {
      ...plan,
      journeyId: "token=journey-secret",
      commitSha: "password=commit-secret",
      environment: "cookie=environment-secret",
      syntheticPersona: "authorization=persona-secret",
      expectedRuntimeIdentity: {
        environment: "cookie=environment-secret",
        deploymentIdentity: "session=deployment-secret",
      },
      scenarios: [
        {
          id: "# injected heading",
          expectedTerminalOutcome: "*terminal*",
          interactions: [
            {
              id: "[injected](https://example.test)",
              receipt: { handle: "unsafe", kind: "unsafe.kind" },
            },
          ],
        },
      ],
    };
    const unsafeDriver: JourneyDriver = {
      identity: async () => unsafePlan.expectedRuntimeIdentity,
      invoke: async () => ({ outcome: "*terminal*" }),
      inspectReceipt: async ({ handle, kind }) => ({ handle, kind }),
    };
    const markdown = toJourneyEvidenceMarkdown(
      await runJourney(unsafePlan, unsafeDriver),
    );
    expect(markdown).not.toMatch(
      /journey-secret|commit-secret|environment-secret|persona-secret|deployment-secret/,
    );
    expect(markdown).toContain("\\# injected heading");
    expect(markdown).toContain("\\[injected\\]\\(https://example\\.test\\)");
    expect(markdown).toContain("\\*terminal\\*");
  });
});

describe("stableJourneyJson", () => {
  it("handles cycles and BigInt without throwing", () => {
    const cyclic: Record<string, unknown> = { count: 12n };
    cyclic.self = cyclic;
    expect(stableJourneyJson(cyclic)).toBe(
      '{"count":"12n","self":"[Circular]"}',
    );
  });

  it("orders keys by deterministic code-point order", () => {
    expect(stableJourneyJson({ ä: 1, z: 2, A: 3 })).toBe('{"A":3,"z":2,"ä":1}');
  });
});
