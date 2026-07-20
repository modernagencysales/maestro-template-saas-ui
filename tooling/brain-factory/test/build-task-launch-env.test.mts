import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { buildTaskLaunchEnv } from "../src/build-task-launch-env.js";
import { materializeBuildTaskRunConfig } from "../src/build-task-run-config.js";

const valid = {
  authorityRepairArchive: "none",
  baseSha: "a".repeat(40),
  controlRoot: "/tmp/control root",
  controlCommonDir: "/tmp/control common",
  evidence: "/tmp/evidence with spaces;$(false)",
  hostTestMaxLoad1m: "20",
  reproofRequest: "none",
  resumeCommits: "none",
  resumeBranch: "none",
  resumeExpectedCommit: "none",
  resumeProofHead: "none",
  resumeMode: "none",
  resumeSourceHead: "none",
  resumeTaskBase: "none",
  startSha: "b".repeat(40),
  taskId: "S03-T03",
  workdir: "/tmp/work dir';$(false)",
};

describe("build task launch environment", () => {
  it("preserves metacharacters as one environment value", () => {
    const env = buildTaskLaunchEnv(valid);
    expect(env).toMatchObject({
      BRAIN_WORKDIR: valid.workdir,
      BRAIN_EVIDENCE_DIR: valid.evidence,
      BRAIN_TASK_ID: valid.taskId,
      BRAIN_CONTROL_ROOT: valid.controlRoot,
      BRAIN_CONTROL_COMMON_DIR: valid.controlCommonDir,
    });
    expect(env.BRAIN_REVIEW_ATTEMPT).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const root = mkdtempSync(resolve(tmpdir(), "brain-launch-env-"));
    try {
      const path = resolve(root, "run.toml");
      materializeBuildTaskRunConfig({
        env,
        graph: "/tmp/workflow.fabro",
        path,
      });
      const config = readFileSync(path, "utf8");
      expect(config).toContain('[environments.local]\nprovider = "local"');
      expect(config).toContain(
        `BRAIN_WORKDIR = ${JSON.stringify(valid.workdir)}`,
      );
      expect(config).toContain(
        `BRAIN_EVIDENCE_DIR = ${JSON.stringify(valid.evidence)}`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects missing or mismatched coordinates", () => {
    expect(() => buildTaskLaunchEnv({ ...valid, taskId: "bad" })).toThrow(
      "task",
    );
    expect(() => buildTaskLaunchEnv({ ...valid, startSha: "short" })).toThrow(
      "start",
    );
    expect(() => buildTaskLaunchEnv({ ...valid, workdir: "relative" })).toThrow(
      "absolute",
    );
  });
});
