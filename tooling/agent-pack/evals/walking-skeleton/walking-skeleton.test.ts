import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  EvaluationError,
  gradeWalkingSkeleton,
  redactJson,
  redactText,
  type WalkingSkeletonResult,
} from "./contract.js";
import { createHostAdapter, type WalkingSkeletonHostAdapter } from "./hosts.js";
import { parseCliOptions } from "./cli.js";
import { runWalkingSkeleton } from "./runner.js";

const candidateSha = "a".repeat(40);

describe("walking-skeleton evaluation harness", () => {
  it("classifies a missing Claude executable without inspecting authentication", async () => {
    const adapter = createHostAdapter("claude", async () => ({
      exitCode: null,
      stdout: "",
      stderr: "",
      unavailable: true,
    }));
    await expect(
      adapter.preflight({ cwd: "/repo", hostHome: "/isolated/claude" }),
    ).rejects.toMatchObject({
      code: "EVAL_HOST_EXECUTABLE_UNAVAILABLE",
    });
  });

  it("classifies unavailable isolated-host authentication", async () => {
    let invocation = 0;
    const adapter = createHostAdapter("codex", async () => {
      invocation += 1;
      return {
        exitCode: invocation === 1 ? 0 : 1,
        stdout: "",
        stderr: "",
        unavailable: false,
      };
    });
    await expect(
      adapter.preflight({ cwd: "/repo", hostHome: "/isolated/codex-1" }),
    ).rejects.toMatchObject({ code: "EVAL_HOST_AUTH_REQUIRED" });
  });

  it("requires explicit collision-safe run output and isolated host state", () => {
    expect(() =>
      parseCliOptions(
        [
          "--suite",
          "walking-skeleton",
          "--host",
          "codex",
          "--run-id",
          "codex-1",
          "--out",
          "/tmp/runs",
          "--candidate-sha",
          candidateSha,
          "--host-home",
          "/tmp/codex-home-1",
        ],
        "/repo",
      ),
    ).not.toThrow();
  });

  it("refuses to overwrite an existing run directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-eval-collision-"));
    await mkdir(join(root, "same-run"));
    await expect(
      runWalkingSkeleton(options(root, "same-run"), {
        adapter: unusedAdapter(),
      }),
    ).rejects.toMatchObject({ code: "EVAL_OUTPUT_EXISTS" });
  });

  it("records redacted evidence, timings, verdict, retention, and receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "maestro-eval-pass-"));
    const timestamps = ["2026-07-25T12:00:00.000Z", "2026-07-25T12:06:00.000Z"];
    let timeIndex = 0;
    const adapter: WalkingSkeletonHostAdapter = {
      host: "codex",
      preflight: async () => undefined,
      run: async () => ({
        exitCode: 0,
        stdout: "AUTH_TOKEN=very-secret-value",
        stderr: "Bearer another-secret-value",
        unavailable: false,
      }),
    };
    const receipt = await runWalkingSkeleton(options(root, "codex-1"), {
      adapter,
      now: () => new Date(timestamps[timeIndex++] ?? timestamps[1] ?? ""),
      prepareWorkspace: async ({ workspace }) => {
        await mkdir(join(workspace, ".maestro-eval"), { recursive: true });
        await mkdir(join(workspace, "eval-target", "apps", "web", "src"), {
          recursive: true,
        });
        await writeFile(
          join(workspace, "eval-target", "manifest.json"),
          "{}\n",
        );
        await writeFile(join(workspace, "eval-target", "receipt.json"), "{}\n");
        await writeFile(
          join(workspace, "eval-target", "apps", "web", "src", "records.ts"),
          "export {};\n",
        );
        await writeFile(
          join(workspace, ".maestro-eval", "walking-skeleton-result.json"),
          JSON.stringify(validResult()),
        );
      },
    });
    expect(receipt.status).toBe("passed");
    expect(receipt.verdict?.durationsMs).toEqual({
      install: 60_000,
      url: 120_000,
      personalized: 180_000,
      firstRecord: 240_000,
      total: 300_000,
    });
    const runRoot = join(root, "codex-1");
    expect(await readFile(join(runRoot, "host.stdout.log"), "utf8")).toBe(
      "AUTH_TOKEN=[REDACTED]",
    );
    expect(await readFile(join(runRoot, "host.stderr.log"), "utf8")).toBe(
      "Bearer [REDACTED]",
    );
    expect(
      JSON.parse(await readFile(join(runRoot, "retention.json"), "utf8")),
    ).toMatchObject({
      passedRunDays: 14,
      failedRunMaximumDays: 30,
    });
    expect(
      JSON.parse(await readFile(join(runRoot, "receipt.json"), "utf8")),
    ).toMatchObject({
      runId: "codex-1",
      candidateSha,
      status: "passed",
    });
  });

  it("fails deterministic grading on forbidden architecture rescue", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "maestro-eval-grade-"));
    await mkdir(join(workspace, "eval-target"));
    const result = {
      ...validResult(),
      posture: { ...validResult().posture, usedMcp: true },
    };
    const verdict = await gradeWalkingSkeleton({
      result,
      workspace,
      candidateSha,
      startedAt: "2026-07-25T12:00:00.000Z",
    });
    expect(verdict.status).toBe("failed");
    expect(verdict.failures).toContainEqual(
      expect.objectContaining({ code: "POSTURE_VIOLATION" }),
    );
  });

  it("redacts structured and unstructured secret-shaped evidence", () => {
    expect(redactText("API_TOKEN=abc123 Bearer qwerty")).toBe(
      "API_TOKEN=[REDACTED] Bearer [REDACTED]",
    );
    expect(
      redactJson({ nested: { password: "do-not-store", note: "safe" } }),
    ).toEqual({ nested: { password: "[REDACTED]", note: "safe" } });
  });
});

function options(out: string, runId: string) {
  return {
    host: "codex" as const,
    runId,
    out,
    sourceRoot: "/repo",
    candidateSha,
    hostHome: "/tmp/isolated-codex-home",
    productName: "Acme Workspace",
  };
}

function unusedAdapter(): WalkingSkeletonHostAdapter {
  return {
    host: "codex",
    preflight: async () => undefined,
    run: async () => {
      throw new EvaluationError(
        "EVAL_HOST_EXECUTION_FAILED",
        "This adapter should not run.",
      );
    },
  };
}

function validResult(): WalkingSkeletonResult {
  const base = Date.parse("2026-07-25T12:00:00.000Z");
  return {
    schemaVersion: 1,
    status: "passed",
    candidateSha,
    customerTarget: "eval-target",
    milestones: [
      "prerequisites_install_complete",
      "visible_fake_url",
      "personalized_interaction",
      "first_record_persisted",
      "check_complete",
    ].map((id, index) => ({
      id,
      reachedAt: new Date(base + (index + 1) * 60_000).toISOString(),
    })),
    commands: [
      "install",
      "create",
      "start",
      "add_crud",
      "create_record",
      "read_record",
      "check",
    ].map((id) => ({ id, status: "passed", summary: `${id} passed` })),
    interventions: [{ kind: "product-naming", summary: "Named the app." }],
    evidence: {
      visibleUrl: "http://127.0.0.1:4173/records",
      recordId: "record-1",
      manifestPath: "eval-target/manifest.json",
      receiptPath: "eval-target/receipt.json",
      verticalSlicePaths: ["eval-target/apps/web/src/records.ts"],
    },
    posture: {
      fakeLocalOnly: true,
      usedPlugin: false,
      usedMcp: false,
      usedWorkflow: false,
      productionAccess: false,
    },
    explanation: {
      works: "Local record create and read work.",
      demoOnly: "The provider remains fake.",
      nextAction: "Connect a personal Convex dev project when ready.",
    },
  };
}
