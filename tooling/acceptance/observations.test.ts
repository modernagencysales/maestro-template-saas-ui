import { describe, expect, it, vi } from "vitest";

import * as observationModule from "../../features/support/observations";
import { BrowserDriver } from "../../features/support/browser-driver";
import { CliDriver } from "../../features/support/cli-driver";
import { buildObservationEnvelope } from "../../features/support/world";

const actionStep = "step_sha256:action";
const outcomeStep = "step_sha256:outcome";

describe("trusted scenario observations", () => {
  it("does not expose an optimistic markCovered escape hatch", () => {
    expect(observationModule).not.toHaveProperty("markCovered");
  });

  it("binds each observation to the current stable step and clears it after the step", () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({
      stepKey: actionStep,
      kind: "action",
      correlationNonce: "correlation-action",
    });
    observations.recordBoundary({
      kind: "action",
      surfaceId: "surface_web_action",
      transport: "ui",
    });
    observations.finishStep("PASSED");

    expect(observations.snapshot()).toEqual([
      {
        stepKey: actionStep,
        kind: "action",
        correlationNonce: "correlation-action",
        surfaceId: "surface_web_action",
        transport: "ui",
      },
    ]);
    expect(() =>
      observations.recordBoundary({
        kind: "action",
        surfaceId: "surface_web_action",
        transport: "ui",
      }),
    ).toThrow(/current stable step/u);
  });

  it.each(["action", "outcome"] as const)(
    "rejects a passing %s step without its matching trusted observation",
    (kind) => {
      const observations = new observationModule.ScenarioObservations();
      observations.beginStep({
        stepKey: kind === "action" ? actionStep : outcomeStep,
        kind,
        ...(kind === "action"
          ? { correlationNonce: "correlation-action" }
          : {}),
      });
      expect(() => observations.finishStep("PASSED")).toThrow(
        /matching.*observation/u,
      );
    },
  );

  it("rejects the wrong kind and duplicate BeforeStep/AfterStep markers", () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({
      stepKey: outcomeStep,
      kind: "outcome",
    });
    expect(() =>
      observations.recordBoundary({
        kind: "action",
        surfaceId: "surface_web_outcome",
        transport: "ui",
      }),
    ).toThrow(/kind/u);
    expect(() =>
      observations.beginStep({ stepKey: outcomeStep, kind: "outcome" }),
    ).toThrow(/BeforeStep|already bound/u);
    observations.recordBoundary({
      kind: "outcome",
      surfaceId: "surface_web_outcome",
      transport: "ui",
    });
    observations.finishStep("PASSED");
    expect(() => observations.finishStep("PASSED")).toThrow(
      /AfterStep|current stable step/u,
    );
  });

  it("builds the exact verifier envelope from drained server evidence", async () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({
      stepKey: actionStep,
      kind: "action",
      correlationNonce: "correlation-action",
    });
    observations.recordBoundary({
      kind: "action",
      surfaceId: "surface_web_action",
      transport: "ui",
    });
    observations.finishStep("PASSED");
    observations.beginStep({ stepKey: outcomeStep, kind: "outcome" });
    observations.recordBoundary({
      kind: "outcome",
      surfaceId: "surface_web_outcome",
      transport: "ui",
    });
    observations.finishStep("PASSED");
    const backend = {
      deploymentId: "deployment-one",
      inputDigest: `sha256:${"a".repeat(64)}` as const,
      startNonce: "server-start-one",
    };

    await expect(
      buildObservationEnvelope({
        runtime: {
          pickleKey: "pickle_sha256:one",
          checkoutSha: "checkout-one",
          webArtifactDigest: `sha256:${"b".repeat(64)}`,
          cliArtifactDigest: `sha256:${"c".repeat(64)}`,
          webBuildSourceSha: "checkout-one",
          cliBuildSourceSha: "checkout-one",
          backends: { controller: backend, web: backend, cli: backend },
          scenarioNonce: "scenario-one",
          drainServerEvidence: async () => [
            {
              scenarioNonce: "scenario-one",
              correlationNonce: "correlation-action",
              principalDigest: `sha256:${"d".repeat(64)}`,
              surfaceId: "surface_web_action",
              transport: "ui",
              backend,
            },
          ],
        },
        observations,
      }),
    ).resolves.toMatchObject({
      schemaVersion: 1,
      pickleKey: "pickle_sha256:one",
      scenarioNonce: "scenario-one",
      serverCorrelations: [
        {
          stepKey: actionStep,
          actorPrincipalDigest: `sha256:${"d".repeat(64)}`,
        },
      ],
      hooks: {
        beforeStepKeys: [actionStep, outcomeStep],
        afterStepKeys: [actionStep, outcomeStep],
      },
    });

    await expect(
      buildObservationEnvelope({
        runtime: {
          pickleKey: "pickle_sha256:one",
          checkoutSha: "checkout-one",
          webArtifactDigest: `sha256:${"b".repeat(64)}`,
          cliArtifactDigest: `sha256:${"c".repeat(64)}`,
          webBuildSourceSha: "checkout-one",
          cliBuildSourceSha: "checkout-one",
          backends: { controller: backend, web: backend, cli: backend },
          scenarioNonce: "scenario-one",
          drainServerEvidence: async () => [],
        },
        observations,
      }),
    ).rejects.toThrow(/server evidence/iu);
  });
});

describe("trusted drivers", () => {
  it("records a browser action only after the accessible interaction resolves", async () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({
      stepKey: actionStep,
      kind: "action",
      correlationNonce: "correlation-browser",
    });
    let resolveClick!: () => void;
    const click = vi.fn(
      () => new Promise<void>((resolve) => (resolveClick = resolve)),
    );
    const page = {
      getByRole: vi.fn(() => ({ click })),
      getByLabel: vi.fn(),
      getByText: vi.fn(),
    };
    const driver = new BrowserDriver({
      page,
      observations,
      surfaceId: "surface_browser",
      transport: "ui",
    });

    const pending = driver.clickByRole("button", "Save");
    expect(observations.snapshot()).toEqual([]);
    resolveClick();
    await pending;
    observations.finishStep("PASSED");
    expect(observations.snapshot()).toEqual([
      expect.objectContaining({
        stepKey: actionStep,
        kind: "action",
        surfaceId: "surface_browser",
        transport: "ui",
      }),
    ]);
  });

  it("does not record a failed actor-visible browser assertion", async () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({ stepKey: outcomeStep, kind: "outcome" });
    const page = {
      getByRole: vi.fn(),
      getByLabel: vi.fn(),
      getByText: vi.fn(() => ({
        waitFor: vi.fn().mockRejectedValue(new Error("not visible")),
      })),
    };
    const driver = new BrowserDriver({
      page,
      observations,
      surfaceId: "surface_browser",
      transport: "ui",
    });
    await expect(driver.expectVisibleText("Saved")).rejects.toThrow(
      /not visible/u,
    );
    expect(observations.snapshot()).toEqual([]);
  });

  it("launches the CLI without a shell, keeps credentials outside argv, and records after assertions", async () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({
      stepKey: actionStep,
      kind: "action",
      correlationNonce: "correlation-cli",
    });
    const launcher = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '{"ok":true}\n',
      stderr: "",
    });
    const driver = new CliDriver({
      executable: "/isolated/maestro.mjs",
      launcher,
      environment: { LANG: "C", MAESTRO_API_BASE_URL: "http://backend" },
      credentials: { MAESTRO_API_KEY: "secret-outside-argv" },
      observations,
      surfaceId: "surface_cli",
      transport: "cli",
    });

    await driver.runAction(["capability", "run", "thing"], {
      exitCode: 0,
      stdoutIncludes: '"ok":true',
    });
    observations.finishStep("PASSED");

    expect(launcher).toHaveBeenCalledWith({
      executable: "/isolated/maestro.mjs",
      args: ["capability", "run", "thing"],
      env: { LANG: "C", MAESTRO_API_BASE_URL: "http://backend" },
      credentials: { MAESTRO_API_KEY: "secret-outside-argv" },
      shell: false,
    });
    expect(launcher.mock.calls[0]?.[0].args).not.toContain(
      "secret-outside-argv",
    );
    expect(observations.snapshot()).toEqual([
      expect.objectContaining({
        stepKey: actionStep,
        kind: "action",
        surfaceId: "surface_cli",
        transport: "cli",
      }),
    ]);
  });

  it("does not record optimistic CLI output when an assertion fails", async () => {
    const observations = new observationModule.ScenarioObservations();
    observations.beginStep({ stepKey: outcomeStep, kind: "outcome" });
    const driver = new CliDriver({
      executable: "/isolated/maestro.mjs",
      launcher: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "hardcoded success\n",
        stderr: "",
      }),
      environment: {},
      credentials: {},
      observations,
      surfaceId: "surface_cli",
      transport: "cli",
    });
    await expect(
      driver.runOutcome(["identity"], { stdoutIncludes: "deployment-real" }),
    ).rejects.toThrow(/stdout/u);
    expect(observations.snapshot()).toEqual([]);
  });
});
