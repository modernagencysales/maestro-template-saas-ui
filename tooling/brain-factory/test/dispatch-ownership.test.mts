import { mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireDispatcherLock,
  archiveTerminalTaskRecord,
  promoteTaskReservation,
  preservedResumeDisposition,
  resolvePreservedFactoryBase,
  reconcilePreparingTaskReservation,
  recoveryCoordinatesForRecord,
  recoverTaskReservation,
  reserveTaskPreparing,
  runRecordOwnsTask,
  taskReservationOwnsIntegrationCandidate,
} from "../src/dispatch-ownership.js";
import {
  serializeResumeCommits,
  validateResumeSource,
} from "../src/resume-support.js";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-dispatch-ownership-"));
  roots.push(root);
  return {
    auditPath: resolve(root, "audit.jsonl"),
    lockPath: resolve(root, "dispatch.lock"),
    recordPath: resolve(root, "runs", "S08-T02.json"),
    root,
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("brain dispatch ownership", () => {
  it("keeps active resumed tasks out of integration selection", () => {
    expect(
      taskReservationOwnsIntegrationCandidate(
        {
          branch: "fabro/review-s01-t04",
          mode: "resume-review",
          status: "preparing",
          taskId: "S01-T04",
          workdir: "/tmp/resume-s01-t04",
        },
        "S01-T04",
        () => "running",
      ),
    ).toBe(true);
    expect(
      taskReservationOwnsIntegrationCandidate(
        {
          branch: "fabro/review-s01-t04",
          runId: "01KXKWXJVX88C8HCM9YPP21VZR",
          status: "launched",
          taskId: "S01-T04",
          workdir: "/tmp/resume-s01-t04",
        },
        "S01-T04",
        () => "running",
      ),
    ).toBe(true);
    expect(
      taskReservationOwnsIntegrationCandidate(
        {
          branch: "fabro/review-s01-t03",
          runId: "01KXKZ2RVP6AED7454PP4RJA4H",
          status: "launched",
          taskId: "S01-T03",
          workdir: "/tmp/resume-s01-t03",
        },
        "S01-T03",
        () => "succeeded",
      ),
    ).toBe(false);
  });

  it("fails closed when a task reservation cannot prove ownership", () => {
    expect(() =>
      taskReservationOwnsIntegrationCandidate(
        {
          branch: "fabro/review-s01-t04",
          status: "preparing",
          taskId: "S01-T03",
          workdir: "/tmp/resume-s01-t04",
        },
        "S01-T04",
        () => "running",
      ),
    ).toThrow("reservation task identity mismatch");
    expect(() =>
      taskReservationOwnsIntegrationCandidate(
        {
          branch: "fabro/review-s01-t04",
          status: "launched",
          taskId: "S01-T04",
          workdir: "/tmp/resume-s01-t04",
        },
        "S01-T04",
        () => "running",
      ),
    ).toThrow("launched reservation has no run ID");
  });

  it("keeps resume locked, idempotent, and non-destructive", () => {
    const resume = readFileSync(
      new URL("../src/resume.mts", import.meta.url),
      "utf8",
    );
    expect(resume).toContain("acquireDispatcherLock");
    expect(resume).toContain("resume already owned by");
    expect(resume).toContain("archiveTerminalTaskRecord");
    expect(resume).not.toContain('"worktree", "remove"');
    expect(resume).not.toContain('"-B"');
    const validation = resume.indexOf("validateResumeSource({");
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(
      resume.indexOf("if (existsSync(recordPath))"),
    );
    expect(validation).toBeLessThan(
      resume.indexOf("  archiveTerminalTaskRecord({"),
    );
    expect(validation).toBeLessThan(
      resume.indexOf("reserveTaskPreparing(recordPath"),
    );
    expect(validation).toBeLessThan(
      resume.indexOf('runRtk(["git", "worktree", "add"'),
    );
    const worktreeAdd = resume.indexOf('runRtk(["git", "worktree", "add"');
    const hydration = resume.indexOf(
      "hydrateWorktreeDependencies(root, workdir);",
    );
    const cherryPick = resume.indexOf('runRtk(["git", "cherry-pick", commit]');
    expect(hydration).toBeGreaterThan(worktreeAdd);
    expect(hydration).toBeLessThan(cherryPick);
    expect(resume).toContain('process.argv.includes("--conflict-aware")');
    expect(resume).toContain("`resume_mode=${resumeMode}`");
    expect(resume).toContain("serializeResumeCommits(taskId, taskCommits)");
    expect(resume).toContain("if (!conflictAware)");
    expect(resume.indexOf("if (!conflictAware)")).toBeLessThan(cherryPick);
    expect(resume).toContain("preservedResumeDisposition({");
    expect(resume).toContain('disposition.kind === "create"');
    expect(resume).toContain('disposition.kind === "reuse-conflict"');
    expect(resume).toContain('"preserved-worktree"');
    expect(resume).toContain('"preserved-conflict-aware"');
    expect(resume.indexOf("preservedResumeDisposition({")).toBeLessThan(
      resume.indexOf("  archiveTerminalTaskRecord({"),
    );
    expect(resume.indexOf("  archiveTerminalTaskRecord({")).toBeLessThan(
      resume.indexOf("reserveTaskPreparing(recordPath"),
    );
    expect(resume).not.toContain('"worktree", "remove"');
    expect(resume).not.toContain('"reset", "--hard"');
  });

  it("pins conflict-aware resume commits as immutable workflow input", () => {
    const first = "a".repeat(40);
    const second = "b".repeat(40);
    expect(serializeResumeCommits("S11-T02", [first, second])).toBe(
      `${first},${second}`,
    );
    expect(() => serializeResumeCommits("S11-T02", [])).toThrow(
      "requires task commits",
    );
    expect(() => serializeResumeCommits("S11-T02", ["archive-ref"])).toThrow(
      "invalid resume commit",
    );
  });

  it("validates a nonempty descendant source range before resume side effects", () => {
    const calls: string[] = [];
    const runGit = (args: readonly string[]): string => {
      calls.push(args.join(" "));
      if (args[1] === "rev-parse" && args.at(-1) === "base^{commit}")
        return "base-sha";
      if (args[1] === "rev-parse" && args.at(-1) === "source^{commit}")
        return "source-sha";
      if (args[1] === "rev-list") return "commit-a\ncommit-b";
      if (args[1] === "diff-tree") return "owned.ts";
      return "";
    };
    expect(
      validateResumeSource({
        runGit,
        sourceRef: "source",
        taskBase: "base",
        taskId: "S00-T04",
      }),
    ).toEqual({
      sourceHeadSha: "source-sha",
      taskBaseSha: "base-sha",
      taskCommits: ["commit-a", "commit-b"],
    });
    expect(calls).toEqual([
      "git rev-parse --verify base^{commit}",
      "git rev-parse --verify source^{commit}",
      "git merge-base --is-ancestor base-sha source-sha",
      "git rev-list --reverse base-sha..source-sha",
      "git diff-tree --no-commit-id --name-only -r commit-a",
      "git diff-tree --no-commit-id --name-only -r commit-b",
    ]);

    expect(() =>
      validateResumeSource({
        runGit: (args) => {
          if (args[1] === "rev-parse")
            return args.at(-1) === "base^{commit}" ? "same" : "same";
          return "";
        },
        sourceRef: "reset-source",
        taskBase: "base",
        taskId: "S00-T04",
      }),
    ).toThrow("has no commits after");
  });

  it("recovers the exact recorded resume-review coordinates", () => {
    expect(
      recoveryCoordinatesForRecord({
        record: {
          branch: "fabro/review-s00-t04",
          mode: "resume-review",
          taskId: "S00-T04",
          workdir: "/tmp/resume-s00-t04",
        },
        requestedTaskId: "S00-T04",
      }),
    ).toEqual({
      branch: "fabro/review-s00-t04",
      workdir: "/tmp/resume-s00-t04",
    });
    expect(() =>
      recoveryCoordinatesForRecord({
        record: {
          branch: "fabro/review-s00-t04",
          taskId: "S00-T03",
          workdir: "/tmp/resume-s00-t04",
        },
        requestedTaskId: "S00-T04",
      }),
    ).toThrow("record taskId S00-T03 does not match");
  });

  it("dispatch recovery inspects recorded coordinates before archiving", () => {
    const dispatch = readFileSync(
      new URL("../src/dispatch.mts", import.meta.url),
      "utf8",
    );
    const recoveryBlock = dispatch.slice(
      dispatch.indexOf("if (recoverTaskId)"),
      dispatch.indexOf("const completedTaskIds"),
    );
    expect(recoveryBlock).toContain("recoveryCoordinatesForRecord({");
    expect(recoveryBlock).toContain("gitBranchExists(recovery.branch, root)");
    expect(recoveryBlock).toContain("existsSync(recovery.workdir)");
    expect(
      recoveryBlock.indexOf("recoveryCoordinatesForRecord({"),
    ).toBeLessThan(recoveryBlock.indexOf("recoverTaskReservation({"));
    expect(recoveryBlock).not.toContain(
      "const branch = `fabro/brain-${task.taskId.toLowerCase()}`;\n  const workdir",
    );
  });

  it("acquires one exclusive dispatcher lock", () => {
    const value = fixture();
    const release = acquireDispatcherLock({
      auditPath: value.auditPath,
      lockPath: value.lockPath,
      now: "2026-07-14T00:00:00.000Z",
      owner: { pid: 1 },
    });
    expect(() =>
      acquireDispatcherLock({
        auditPath: value.auditPath,
        lockPath: value.lockPath,
        now: "2026-07-14T00:00:01.000Z",
        owner: { pid: 2 },
      }),
    ).toThrow("explicit audited recovery is required");
    release();
  });

  it("atomically reserves preparing before promotion", () => {
    const value = fixture();
    reserveTaskPreparing(value.recordPath, {
      status: "preparing",
      taskId: "S08-T02",
    });
    expect(() =>
      reserveTaskPreparing(value.recordPath, {
        status: "preparing",
        taskId: "S08-T02",
      }),
    ).toThrow("task reservation already exists");
    promoteTaskReservation(value.recordPath, {
      runId: "run-1",
      status: "launched",
      taskId: "S08-T02",
    });
    expect(JSON.parse(readFileSync(value.recordPath, "utf8"))).toMatchObject({
      runId: "run-1",
      status: "launched",
    });
  });

  it("treats inspection errors and unknown status as owned", () => {
    expect(
      runRecordOwnsTask({
        inspect: () => {
          throw new Error("inspect unavailable");
        },
        recordExists: true,
      }),
    ).toBe(true);
    expect(
      runRecordOwnsTask({ inspect: () => undefined, recordExists: true }),
    ).toBe(true);
  });

  it("releases terminal records only after authoritative inspection", () => {
    expect(
      runRecordOwnsTask({ inspect: () => "preparing", recordExists: true }),
    ).toBe(true);
    expect(
      runRecordOwnsTask({ inspect: () => "running", recordExists: true }),
    ).toBe(true);
    for (const status of ["canceled", "cancelled", "failed", "succeeded"]) {
      expect(
        runRecordOwnsTask({ inspect: () => status, recordExists: true }),
      ).toBe(false);
    }
    expect(
      runRecordOwnsTask({ inspect: () => "failed", recordExists: false }),
    ).toBe(false);
  });

  const exactResumeRecord = {
    branch: "fabro/review-s11-t02",
    mode: "resume-review",
    resumeStrategy: "in-lane-cherry-pick",
    sourceHeadSha: "a".repeat(40),
    taskBaseSha: "b".repeat(40),
    taskId: "S11-T02",
    workdir: "/tmp/resume-s11-t02",
  } as const;
  const exactResumeObservation = {
    branchExists: true,
    controlCommonDir: "/repo/.git",
    headSha: "c".repeat(40),
    proofHeadIsAncestor: true,
    statusPorcelain: "",
    taskBaseIsAncestor: true,
    worktreeBranch: exactResumeRecord.branch,
    worktreeCommonDir: "/repo/.git",
    worktreeExists: true,
  } as const;

  it("reuses only an exact clean preserved resume worktree", () => {
    expect(
      preservedResumeDisposition({
        expected: exactResumeRecord,
        observation: exactResumeObservation,
        record: exactResumeRecord,
      }),
    ).toEqual({ kind: "reuse-clean", startSha: "c".repeat(40) });
    expect(
      preservedResumeDisposition({
        expected: exactResumeRecord,
        observation: {
          ...exactResumeObservation,
          branchExists: false,
          worktreeExists: false,
        },
        record: exactResumeRecord,
      }),
    ).toEqual({ kind: "create" });
  });

  it("reuses only an explicit in-lane cherry-pick conflict", () => {
    expect(
      preservedResumeDisposition({
        expected: exactResumeRecord,
        observation: {
          ...exactResumeObservation,
          cherryPickHead: "d".repeat(40),
          statusPorcelain: "UU packages/convex/confect/example.ts",
        },
        record: exactResumeRecord,
      }),
    ).toEqual({ kind: "reuse-conflict", startSha: "c".repeat(40) });
    expect(() =>
      preservedResumeDisposition({
        expected: exactResumeRecord,
        observation: {
          ...exactResumeObservation,
          cherryPickHead: "d".repeat(40),
          statusPorcelain: "?? unrelated.ts",
        },
        record: exactResumeRecord,
      }),
    ).toThrow("untracked files");
  });

  it("fails closed on any preserved resume identity drift", () => {
    const cases = [
      {
        observation: exactResumeObservation,
        record: { ...exactResumeRecord, sourceHeadSha: "f".repeat(40) },
        message: "source HEAD mismatch",
      },
      {
        observation: {
          ...exactResumeObservation,
          worktreeBranch: "fabro/review-other",
        },
        record: exactResumeRecord,
        message: "worktree branch mismatch",
      },
      {
        observation: {
          ...exactResumeObservation,
          worktreeCommonDir: "/other/.git",
        },
        record: exactResumeRecord,
        message: "repository mismatch",
      },
      {
        observation: {
          ...exactResumeObservation,
          taskBaseIsAncestor: false,
        },
        record: exactResumeRecord,
        message: "task base is not an ancestor",
      },
      {
        observation: {
          ...exactResumeObservation,
          proofHeadIsAncestor: false,
        },
        record: exactResumeRecord,
        message: "proof head is not an ancestor",
      },
      {
        observation: {
          ...exactResumeObservation,
          branchExists: false,
        },
        record: exactResumeRecord,
        message: "branch/worktree presence mismatch",
      },
    ] as const;
    for (const item of cases) {
      expect(() =>
        preservedResumeDisposition({
          expected: exactResumeRecord,
          observation: item.observation,
          record: item.record,
        }),
      ).toThrow(item.message);
    }
  });

  it("binds preserved resume to its recorded or exact proof base", () => {
    const proof = {
      baseSha: "d".repeat(40),
      headSha: "c".repeat(40),
      taskId: "S11-T02",
    };
    expect(() =>
      resolvePreservedFactoryBase({
        proof,
        recordFactoryBaseSha: "e".repeat(40),
        taskId: "S11-T02",
      }),
    ).toThrow("recorded factory base differs from proof");
    expect(
      resolvePreservedFactoryBase({
        proof,
        recordFactoryBaseSha: "d".repeat(40),
        taskId: "S11-T02",
      }),
    ).toEqual({ baseSha: "d".repeat(40), proofHeadSha: "c".repeat(40) });
    expect(
      resolvePreservedFactoryBase({
        recordFactoryBaseSha: "e".repeat(40),
        taskId: "S11-T02",
      }),
    ).toEqual({ baseSha: "e".repeat(40) });
    expect(resolvePreservedFactoryBase({ proof, taskId: "S11-T02" })).toEqual({
      baseSha: "d".repeat(40),
      proofHeadSha: "c".repeat(40),
    });
    expect(() => resolvePreservedFactoryBase({ taskId: "S11-T02" })).toThrow(
      "factory base is missing",
    );
    expect(() =>
      resolvePreservedFactoryBase({
        proof: { ...proof, taskId: "S11-T03" },
        taskId: "S11-T02",
      }),
    ).toThrow("proof task identity mismatch");
  });

  it("requires explicit audited recovery and no unresolved worktree", () => {
    const value = fixture();
    reserveTaskPreparing(value.recordPath, {
      status: "preparing",
      taskId: "S08-T02",
    });
    expect(() =>
      recoverTaskReservation({
        auditPath: value.auditPath,
        branchExists: false,
        now: "2026-07-14T00:00:00.000Z",
        reason: "operator is attempting recovery",
        recordPath: value.recordPath,
        taskId: "S08-T02",
        worktreeExists: true,
      }),
    ).toThrow("unresolved worktree or branch still exists");
    recoverTaskReservation({
      auditPath: value.auditPath,
      branchExists: false,
      now: "2026-07-14T00:00:00.000Z",
      reason: "operator verified failed launch and removed the worktree",
      recordPath: value.recordPath,
      taskId: "S08-T02",
      worktreeExists: false,
    });
    expect(readFileSync(value.auditPath, "utf8")).toContain(
      "recover-task-reservation",
    );
  });

  it("archives only terminal ownership without removing its worktree", () => {
    const value = fixture();
    reserveTaskPreparing(value.recordPath, {
      runId: "run-1",
      taskId: "S08-T02",
    });
    expect(() =>
      archiveTerminalTaskRecord({
        auditPath: value.auditPath,
        now: "2026-07-14T00:00:00.000Z",
        recordPath: value.recordPath,
        runId: "run-1",
        status: "running",
        taskId: "S08-T02",
      }),
    ).toThrow(/refusing to archive non-terminal/);
    const archived = archiveTerminalTaskRecord({
      auditPath: value.auditPath,
      now: "2026-07-14T00:00:00.000Z",
      recordPath: value.recordPath,
      runId: "run-1",
      status: "failed",
      taskId: "S08-T02",
    });
    expect(readFileSync(archived, "utf8")).toContain("run-1");
  });

  it("replays one deterministic terminal archive without duplicating audit", () => {
    const value = fixture();
    const actionId = "a".repeat(64);
    reserveTaskPreparing(value.recordPath, {
      runId: "run-1",
      status: "launched",
      taskId: "S08-T02",
    });
    const first = archiveTerminalTaskRecord({
      actionId,
      auditPath: value.auditPath,
      now: "2026-07-14T00:00:00.000Z",
      recordPath: value.recordPath,
      runId: "run-1",
      status: "failed",
      taskId: "S08-T02",
    });
    const replay = archiveTerminalTaskRecord({
      actionId,
      auditPath: value.auditPath,
      now: "2026-07-14T00:05:00.000Z",
      recordPath: value.recordPath,
      runId: "run-1",
      status: "failed",
      taskId: "S08-T02",
    });
    expect(replay).toBe(first);
    expect(first).toBe(`${value.recordPath}.terminal-${actionId}`);
    expect(
      readFileSync(value.auditPath, "utf8").trim().split("\n"),
    ).toHaveLength(1);
  });

  it("finishes audit after a crash between deterministic rename and append", () => {
    const value = fixture();
    const actionId = "b".repeat(64);
    reserveTaskPreparing(value.recordPath, {
      runId: "run-2",
      status: "launched",
      taskId: "S08-T02",
    });
    const archivedPath = `${value.recordPath}.terminal-${actionId}`;
    renameSync(value.recordPath, archivedPath);

    expect(
      archiveTerminalTaskRecord({
        actionId,
        auditPath: value.auditPath,
        now: "2026-07-14T00:00:00.000Z",
        recordPath: value.recordPath,
        runId: "run-2",
        status: "succeeded",
        taskId: "S08-T02",
      }),
    ).toBe(archivedPath);
    expect(readFileSync(value.auditPath, "utf8")).toContain(actionId);
  });

  it("rejects conflicting deterministic archive or audit replay", () => {
    const value = fixture();
    const actionId = "c".repeat(64);
    const archivedPath = `${value.recordPath}.terminal-${actionId}`;
    reserveTaskPreparing(value.recordPath, {
      runId: "other-run",
      status: "launched",
      taskId: "S08-T02",
    });
    renameSync(value.recordPath, archivedPath);
    expect(() =>
      archiveTerminalTaskRecord({
        actionId,
        auditPath: value.auditPath,
        now: "2026-07-14T00:00:00.000Z",
        recordPath: value.recordPath,
        runId: "run-3",
        status: "failed",
        taskId: "S08-T02",
      }),
    ).toThrow("archive identity mismatch");

    reserveTaskPreparing(value.recordPath, {
      runId: "run-3",
      status: "launched",
      taskId: "S08-T02",
    });
    const validAction = "e".repeat(64);
    archiveTerminalTaskRecord({
      actionId: validAction,
      auditPath: value.auditPath,
      now: "2026-07-14T00:00:00.000Z",
      recordPath: value.recordPath,
      runId: "run-3",
      status: "failed",
      taskId: "S08-T02",
    });
    expect(() =>
      archiveTerminalTaskRecord({
        actionId: validAction,
        auditPath: value.auditPath,
        now: "2026-07-14T00:01:00.000Z",
        recordPath: value.recordPath,
        runId: "run-3",
        status: "succeeded",
        taskId: "S08-T02",
      }),
    ).toThrow("archive audit identity mismatch");
  });

  const preparingConfigInputs = {
    base_sha: "d".repeat(40),
    evidence_dir: "/tmp/evidence",
    start_sha: "d".repeat(40),
    task_id: "S08-T02",
    workdir: "/tmp/s08-t02",
  } as const;
  const preparingReservation = {
    baseSha: "d".repeat(40),
    branch: "fabro/brain-s08-t02",
    status: "preparing",
    taskId: "S08-T02",
    workdir: "/tmp/s08-t02",
  } as const;

  const preparingInspection = (runId: string) => ({
    branch: preparingReservation.branch,
    inspection: {
      run_id: runId,
      run_spec: {
        settings: {
          run: {
            inputs: preparingConfigInputs,
            metadata: { task: preparingReservation.taskId },
          },
        },
      },
    },
  });

  it("reconciles zero candidates as retry and one exact candidate as promote", () => {
    expect(
      reconcilePreparingTaskReservation({
        candidates: [],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "not-launched" });
    expect(
      reconcilePreparingTaskReservation({
        candidates: [preparingInspection("run-exact")],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "launched", runId: "run-exact" });
  });

  it("fails closed for multiple exact preparing launches", () => {
    expect(
      reconcilePreparingTaskReservation({
        candidates: [
          preparingInspection("run-one"),
          preparingInspection("run-two"),
        ],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "ambiguous" });
  });

  it("fails closed for unavailable, malformed, or drifted inspection", () => {
    expect(
      reconcilePreparingTaskReservation({
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "unknown" });
    expect(
      reconcilePreparingTaskReservation({
        candidates: [{ branch: preparingReservation.branch, inspection: {} }],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "unknown" });
    expect(
      reconcilePreparingTaskReservation({
        candidates: [
          {
            ...preparingInspection("run-drift"),
            branch: "fabro/brain-something-else",
          },
        ],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "unknown" });
    expect(
      reconcilePreparingTaskReservation({
        candidates: [
          {
            ...preparingInspection("run-input-drift"),
            inspection: {
              ...preparingInspection("run-input-drift").inspection,
              run_spec: {
                settings: {
                  run: {
                    inputs: {
                      ...preparingConfigInputs,
                      base_sha: "e".repeat(40),
                    },
                    metadata: { task: preparingReservation.taskId },
                  },
                },
              },
            },
          },
        ],
        expectedConfigInputs: preparingConfigInputs,
        reservation: preparingReservation,
      }),
    ).toEqual({ kind: "unknown" });
  });
});
