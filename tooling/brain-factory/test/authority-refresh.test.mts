import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  admitAuthorityRefresh,
  assertAuthorityRefreshTerminalStatus,
  authorityRefreshCoordinates,
  preserveAuthorityRefreshEvidence,
} from "../src/authority-refresh.js";
import { runAuthorityRefreshTransition } from "../src/authority-refresh-launch.js";
import {
  recordPreparingTaskLaunch,
  replaceTerminalTaskRecord,
} from "../src/dispatch-ownership.js";

const roots: string[] = [];
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "brain-authority-refresh-"));
  roots.push(root);
  const repo = join(root, "repo");
  const sourceWorkdir = join(root, "source-worktree");
  const evidence = join(root, "evidence");
  mkdirSync(repo);
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "factory@example.invalid");
  git(repo, "config", "user.name", "Factory Test");
  writeFileSync(join(repo, ".gitignore"), ".tokensave\n");
  writeFileSync(join(repo, "owned.txt"), "base\n");
  writeFileSync(join(repo, "plan.md"), "old authority\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  const baseSha = git(repo, "rev-parse", "HEAD");
  git(repo, "branch", "source");
  git(repo, "worktree", "add", sourceWorkdir, "source");
  writeFileSync(join(sourceWorkdir, "owned.txt"), "source one\n");
  git(sourceWorkdir, "commit", "-am", "source one");
  const firstCommit = git(sourceWorkdir, "rev-parse", "HEAD");
  writeFileSync(join(sourceWorkdir, "owned.txt"), "source two\n");
  git(sourceWorkdir, "commit", "-am", "source two");
  const headSha = git(sourceWorkdir, "rev-parse", "HEAD");
  const treeSha = git(sourceWorkdir, "rev-parse", "HEAD^{tree}");
  writeFileSync(join(repo, "plan.md"), "current authority\n");
  git(repo, "commit", "-am", "advance authority");
  const controlHeadSha = git(repo, "rev-parse", "HEAD");
  const taskId = "S03-T03";
  const laneDirectory = join(evidence, "lane-results", taskId);
  mkdirSync(laneDirectory, { recursive: true });
  const oldPlanSha256 = "a".repeat(64);
  const oldTaskBlockHash = "b".repeat(64);
  const proof = {
    schemaVersion: "maestro-brain-ci-proof/v1",
    taskId,
    planSha256: oldPlanSha256,
    taskBlockHash: oldTaskBlockHash,
    baseSha,
    headSha,
    changedFiles: ["owned.txt"],
    focusedCommands: ["rtk test focused"],
    testsAdded: ["owned.test.ts"],
    reviewVerdict: "pass",
    reviewHeadSha: headSha,
    reviewFindings: [],
    knownRisks: [],
  };
  const gate = {
    schemaVersion: "maestro-brain-lane-gate/v1",
    taskId,
    stage: "final",
    status: "passed",
    headSha,
    currentHeadSha: headSha,
    currentTreeSha: treeSha,
    planSha256: oldPlanSha256,
    taskBlockHash: oldTaskBlockHash,
  };
  const lane = {
    schemaVersion: "maestro-brain-lane-result/v1",
    taskId,
    status: "lane_green",
    headSha,
    treeSha,
  };
  for (const [name, value] of [
    ["ci-proof-packet.json", proof],
    ["lane-gate-report.json", gate],
    ["lane-result.json", lane],
  ] as const) {
    writeFileSync(
      join(laneDirectory, name),
      `${JSON.stringify(value, null, 2)}\n`,
    );
  }
  return {
    baseSha,
    controlHeadSha,
    evidence,
    firstCommit,
    headSha,
    oldPlanSha256,
    oldTaskBlockHash,
    repo,
    sourceWorkdir,
    taskId,
    treeSha,
  };
};

const admit = (value: ReturnType<typeof fixture>, overrides = {}) =>
  admitAuthorityRefresh({
    controlHeadSha: value.controlHeadSha,
    evidence: value.evidence,
    root: value.repo,
    runGit: (cwd, args) => git(cwd, ...args),
    sourceBranch: "source",
    sourceWorkdir: value.sourceWorkdir,
    task: {
      fileLocks: ["owned.txt"],
      planSha256: "c".repeat(64),
      sourceSliceBudget: 300,
      sourceSliceLimit: 4,
      taskBlockHash: "d".repeat(64),
      taskId: value.taskId,
    },
    ...overrides,
  });

const repairAdmission = (value: ReturnType<typeof fixture>) => {
  const laneDirectory = join(value.evidence, "lane-results", value.taskId);
  rmSync(join(laneDirectory, "lane-result.json"));
  const proofPath = join(laneDirectory, "ci-proof-packet.json");
  const proof = JSON.parse(readFileSync(proofPath, "utf8"));
  proof.reviewVerdict = "rework";
  proof.reviewFindings = [
    {
      id: "S03-T03-SAFETY-001",
      lens: "safety",
      severity: "high",
      summary: "repair required",
      details: "exact terminal finding",
      evidence: ["owned.txt"],
    },
  ];
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
  const gatePath = join(laneDirectory, "lane-gate-report.json");
  const gate = JSON.parse(readFileSync(gatePath, "utf8"));
  gate.stage = "pre-review";
  writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
  const lenses = join(laneDirectory, "review-lenses", value.headSha);
  mkdirSync(lenses, { recursive: true });
  for (const lens of ["contract", "safety", "quality"]) {
    writeFileSync(
      join(lenses, `${lens}.json`),
      `${JSON.stringify({
        lens,
        taskId: value.taskId,
        planSha256: value.oldPlanSha256,
        taskBlockHash: value.oldTaskBlockHash,
        baseSha: value.baseSha,
        headSha: value.headSha,
        treeSha: value.treeSha,
        reviewerRunId: `review-${lens}`,
        rubricDispositions: [],
        findings: lens === "safety" ? proof.reviewFindings : [],
        verdict: lens === "safety" ? "rework" : "pass",
      })}\n`,
    );
  }
  const reviewContent = "independent terminal rework\n";
  const objectSha = execFileSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: value.repo,
    encoding: "utf8",
    input: reviewContent,
  }).trim();
  return admitAuthorityRefresh({
    authorityRepairTransition: {
      schemaVersion: "maestro-brain-authority-repair-transition/v1",
      fromPlanSha256: value.oldPlanSha256,
      fromTaskBlockHash: value.oldTaskBlockHash,
      sourceRunId: "01KXZP38CAC2GYAF2YA7NRTBQK",
      sourceBaseSha: value.baseSha,
      sourceHeadSha: value.headSha,
      sourceTreeSha: value.treeSha,
      requiredIntegratedTaskIds: ["S01-T01"],
      immutableFindings: [
        { kind: "git-blob", objectSha, contentSha256: sha256(reviewContent) },
      ],
      supersededPaths: [
        {
          path: "obsolete.txt",
          replacementPath: "replacement.txt",
          disposition: "replaced-by-current-owned-artifact",
        },
      ],
    },
    controlHeadSha: value.controlHeadSha,
    evidence: value.evidence,
    integratedTaskIds: ["S01-T01"],
    readGitBlob: (cwd, objectSha) =>
      execFileSync("git", ["cat-file", "blob", objectSha], {
        cwd,
        encoding: "utf8",
      }),
    root: value.repo,
    runGit: (cwd, args) => git(cwd, ...args),
    sourceBranch: "source",
    sourceRunId: "01KXZP38CAC2GYAF2YA7NRTBQK",
    sourceWorkdir: value.sourceWorkdir,
    task: {
      fileLocks: ["owned.txt", "replacement.txt"],
      planSha256: "c".repeat(64),
      sourceSliceBudget: 300,
      sourceSliceLimit: 4,
      taskBlockHash: "d".repeat(64),
      taskId: value.taskId,
    },
  });
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

describe("authority refresh admission", () => {
  it("admits exact terminal rework without fabricating a lane result", () => {
    const value = fixture();
    writeFileSync(join(value.sourceWorkdir, "obsolete.txt"), "legacy\n");
    git(value.sourceWorkdir, "add", "obsolete.txt");
    git(value.sourceWorkdir, "commit", "-m", "legacy ownership");
    const headSha = git(value.sourceWorkdir, "rev-parse", "HEAD");
    const treeSha = git(value.sourceWorkdir, "rev-parse", "HEAD^{tree}");
    const laneDirectory = join(value.evidence, "lane-results", value.taskId);
    for (const file of ["ci-proof-packet.json", "lane-gate-report.json"]) {
      const path = join(laneDirectory, file);
      const payload = JSON.parse(readFileSync(path, "utf8"));
      payload.headSha = headSha;
      if (file === "lane-gate-report.json") {
        payload.currentHeadSha = headSha;
        payload.currentTreeSha = treeSha;
      } else {
        payload.changedFiles = ["obsolete.txt", "owned.txt"];
        payload.reviewHeadSha = headSha;
      }
      writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
    }
    const admission = repairAdmission({ ...value, headSha, treeSha });

    expect(admission.transitionKind).toBe("authority-repair");
    expect(admission.supersededPaths).toEqual([
      {
        path: "obsolete.txt",
        replacementPath: "replacement.txt",
        disposition: "replaced-by-current-owned-artifact",
      },
    ]);
    const artifactFiles = admission.artifacts.map(({ file }) => file);
    expect(artifactFiles).toEqual(
      expect.arrayContaining([
        "prior-proof.json",
        "prior-pre-review-gate.json",
        "authority-repair-transition.json",
      ]),
    );
    expect(
      artifactFiles.some((file) =>
        /^independent-finding-[0-9a-f]{40}\.txt$/.test(file),
      ),
    ).toBe(true);
  });
  it("wires the explicit CLI mode to the normal conflict-aware workflow", () => {
    const resumeSource = readFileSync(
      fileURLToPath(new URL("../src/resume.mts", import.meta.url)),
      "utf8",
    );
    const launchSource = readFileSync(
      fileURLToPath(
        new URL("../src/authority-refresh-launch.ts", import.meta.url),
      ),
      "utf8",
    );
    expect(resumeSource).toContain(
      'process.argv.includes("--authority-refresh")',
    );
    expect(resumeSource).toContain(
      'process.argv.includes("--authority-repair")',
    );
    expect(resumeSource).toContain("launchAuthorityRefresh({");
    expect(launchSource).toContain('"authority-refresh"');
    expect(launchSource).toContain('"authority-repair"');
    expect(launchSource).toContain('"supersession.json"');
    expect(launchSource).toContain("resume_mode=conflict-aware");
  });

  it("requires an exact terminal source run", () => {
    expect(() =>
      assertAuthorityRefreshTerminalStatus("running", "S03-T03"),
    ).toThrow("source run is not terminal");
    expect(() =>
      assertAuthorityRefreshTerminalStatus("unknown", "S03-T03"),
    ).toThrow("source run status is unknown");
    expect(() =>
      assertAuthorityRefreshTerminalStatus("succeeded", "S03-T03"),
    ).not.toThrow();
  });

  it("binds exact terminal lane evidence and the complete source commit range", () => {
    const value = fixture();
    const admission = admit(value);

    expect(admission.sourceCommits).toEqual([value.firstCommit, value.headSha]);
    expect(admission.sourceHeadSha).toBe(value.headSha);
    expect(admission.taskBaseSha).toBe(value.baseSha);
    expect(admission.oldAuthority).toEqual({
      planSha256: value.oldPlanSha256,
      taskBlockHash: value.oldTaskBlockHash,
    });
    expect(admission.coordinates.branch).toMatch(
      /^fabro\/review-s03-t03-authority-[0-9a-f]{12}$/,
    );
    expect(admission.coordinates.workdir).toContain(
      `resume-s03-t03-authority-${admission.coordinates.authorityId}`,
    );
  });

  it("fails closed on dirty or drifted source and stale current ownership", () => {
    const value = fixture();
    writeFileSync(join(value.sourceWorkdir, "untracked.txt"), "dirty\n");
    expect(() => admit(value)).toThrow("source worktree is dirty");
    rmSync(join(value.sourceWorkdir, "untracked.txt"));

    writeFileSync(join(value.sourceWorkdir, "owned.txt"), "drift\n");
    git(value.sourceWorkdir, "commit", "-am", "source drift");
    expect(() => admit(value)).toThrow("source worktree HEAD mismatch");

    git(value.sourceWorkdir, "reset", "--hard", value.headSha);
    expect(() =>
      admit(value, {
        task: {
          fileLocks: ["somewhere-else.txt"],
          planSha256: "c".repeat(64),
          sourceSliceBudget: 300,
          sourceSliceLimit: 4,
          taskBlockHash: "d".repeat(64),
          taskId: value.taskId,
        },
      }),
    ).toThrow("not declared in current manifest fileLocks");
  }, 30_000);

  it("requires the current controller authority to be an exact clean HEAD", () => {
    const value = fixture();
    writeFileSync(join(value.repo, "controller-drift.txt"), "dirty\n");
    expect(() => admit(value)).toThrow("controller worktree is dirty");
    rmSync(join(value.repo, "controller-drift.txt"));
    expect(() => admit(value, { controlHeadSha: value.baseSha })).toThrow(
      "controller HEAD mismatch",
    );
  });

  it("fails closed on evidence mismatch, unchanged authority, and slice overflow", () => {
    const value = fixture();
    const gatePath = join(
      value.evidence,
      "lane-results",
      value.taskId,
      "lane-gate-report.json",
    );
    const gate = JSON.parse(readFileSync(gatePath, "utf8"));
    gate.taskBlockHash = "e".repeat(64);
    writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
    expect(() => admit(value)).toThrow("final lane gate receipt is invalid");

    gate.taskBlockHash = value.oldTaskBlockHash;
    writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
    const proofPath = join(
      value.evidence,
      "lane-results",
      value.taskId,
      "ci-proof-packet.json",
    );
    const proof = JSON.parse(readFileSync(proofPath, "utf8"));
    proof.baseSha = value.controlHeadSha;
    writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
    expect(() => admit(value)).toThrow("proof base is not an ancestor");
    proof.baseSha = value.baseSha;
    writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
    expect(() =>
      admit(value, {
        task: {
          fileLocks: ["owned.txt"],
          planSha256: value.oldPlanSha256,
          sourceSliceBudget: 300,
          sourceSliceLimit: 4,
          taskBlockHash: value.oldTaskBlockHash,
          taskId: value.taskId,
        },
      }),
    ).toThrow("already matches current authority");
    expect(() =>
      admit(value, {
        task: {
          fileLocks: ["owned.txt"],
          planSha256: "c".repeat(64),
          sourceSliceBudget: 300,
          sourceSliceLimit: 1,
          taskBlockHash: "d".repeat(64),
          taskId: value.taskId,
        },
      }),
    ).toThrow("source slice limit");
  });

  it("preserves content-hashed evidence exactly once and rejects coordinate reuse", () => {
    const value = fixture();
    const admission = admit(value);
    preserveAuthorityRefreshEvidence(admission);

    const manifestPath = join(admission.archiveDirectory, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const artifact of manifest.artifacts) {
      const content = readFileSync(
        join(admission.archiveDirectory, artifact.file),
        "utf8",
      );
      expect(sha256(content)).toBe(artifact.sha256);
    }
    expect(() => preserveAuthorityRefreshEvidence(admission)).toThrow(
      "authority refresh evidence coordinates already exist",
    );

    mkdirSync(admission.coordinates.workdir, { recursive: true });
    expect(() =>
      authorityRefreshCoordinates({
        controlHeadSha: value.controlHeadSha,
        planSha256: "c".repeat(64),
        root: value.repo,
        taskBlockHash: "d".repeat(64),
        taskId: value.taskId,
      }),
    ).toThrow("authority refresh worktree already exists");
  });

  it("removes staged evidence when an artifact write fails", () => {
    const value = fixture();
    const admission = admit(value);
    let writes = 0;
    expect(() =>
      preserveAuthorityRefreshEvidence(admission, {
        rename: renameSync,
        remove: (path) => rmSync(path, { force: true, recursive: true }),
        write: (path, content, options) => {
          writes += 1;
          if (writes === 2) throw new Error("injected evidence write failure");
          writeFileSync(path, content, options);
        },
      }),
    ).toThrow("injected evidence write failure");
    expect(existsSync(admission.archiveDirectory)).toBe(false);
    expect(existsSync(`${admission.archiveDirectory}.next`)).toBe(false);
  });

  it.each([
    ["reservation replacement", "replace"],
    ["worktree creation", "worktree"],
    ["Fabro launch", "launch"],
    ["reservation promotion", "promote"],
  ] as const)(
    "leaves deterministic recovery state after %s failure",
    (_label, failure) => {
      const value = fixture();
      const admission = admit(value);
      const recordPath = join(value.repo, "task-record.json");
      const auditPath = join(value.repo, "recovery-audit.jsonl");
      const terminalRecord = `${JSON.stringify(
        {
          branch: "source",
          runId: "terminal-run",
          status: "launched",
          taskId: value.taskId,
          workdir: value.sourceWorkdir,
        },
        null,
        2,
      )}\n`;
      const preparingRecord = {
        branch: admission.coordinates.branch,
        status: "preparing",
        taskId: value.taskId,
        workdir: admission.coordinates.workdir,
      };
      writeFileSync(recordPath, terminalRecord);
      const expectedError =
        failure === "replace"
          ? "compare-and-swap failed"
          : `injected ${failure === "promote" ? "promotion" : failure} failure`;

      expect(() =>
        runAuthorityRefreshTransition({
          createWorktree: () => {
            if (failure === "worktree")
              throw new Error("injected worktree failure");
          },
          launch: () => {
            if (failure === "launch")
              throw new Error("injected launch failure");
            return "new-run";
          },
          preserveEvidence: () => preserveAuthorityRefreshEvidence(admission),
          promote: () => {
            if (failure === "promote")
              throw new Error("injected promotion failure");
          },
          replaceReservation: () => {
            replaceTerminalTaskRecord({
              auditPath,
              expectedContent:
                failure === "replace"
                  ? `${terminalRecord}injected-drift`
                  : terminalRecord,
              now: "2026-07-20T00:00:00.000Z",
              recordPath,
              replacement: preparingRecord,
              runId: "terminal-run",
              status: "succeeded",
              taskId: value.taskId,
            });
          },
          recordLaunch: (runId) =>
            recordPreparingTaskLaunch({
              auditPath,
              expected: preparingRecord,
              now: "2026-07-20T00:00:01.000Z",
              recordPath,
              runId,
              taskId: value.taskId,
            }),
          rollbackEvidence: () =>
            rmSync(admission.archiveDirectory, {
              force: true,
              recursive: true,
            }),
        }),
      ).toThrow(expectedError);

      if (failure === "replace") {
        expect(readFileSync(recordPath, "utf8")).toBe(terminalRecord);
        expect(existsSync(admission.archiveDirectory)).toBe(false);
        expect(existsSync(auditPath)).toBe(false);
      } else {
        expect(JSON.parse(readFileSync(recordPath, "utf8"))).toEqual(
          failure === "promote"
            ? { ...preparingRecord, runId: "new-run" }
            : preparingRecord,
        );
        expect(existsSync(admission.archiveDirectory)).toBe(true);
        expect(readFileSync(auditPath, "utf8")).toContain(
          '"action":"archive-terminal-task-run"',
        );
        if (failure === "promote") {
          expect(readFileSync(auditPath, "utf8")).toContain(
            '"action":"record-preparing-task-launch"',
          );
        }
      }
    },
    30_000,
  );

  it.each(["write", "fsync"] as const)(
    "cleans reservation .next after injected %s materialization failure",
    (failure) => {
      const value = fixture();
      const recordPath = join(value.repo, "task-record.json");
      const auditPath = join(value.repo, "recovery-audit.jsonl");
      const terminalRecord = `${JSON.stringify({
        runId: "terminal-run",
        taskId: value.taskId,
      })}\n`;
      writeFileSync(recordPath, terminalRecord);

      expect(() =>
        replaceTerminalTaskRecord(
          {
            auditPath,
            expectedContent: terminalRecord,
            now: "2026-07-20T00:00:00.000Z",
            recordPath,
            replacement: { status: "preparing", taskId: value.taskId },
            runId: "terminal-run",
            status: "succeeded",
            taskId: value.taskId,
          },
          {
            close: closeSync,
            open: openSync,
            remove: rmSync,
            rename: renameSync,
            sync: (descriptor) => {
              if (failure === "fsync")
                throw new Error("injected fsync failure");
              fsyncSync(descriptor);
            },
            write: (descriptor, content) => {
              if (failure === "write")
                throw new Error("injected write failure");
              writeFileSync(descriptor, content, "utf8");
            },
          },
        ),
      ).toThrow(`injected ${failure} failure`);
      expect(readFileSync(recordPath, "utf8")).toBe(terminalRecord);
      expect(existsSync(`${recordPath}.next`)).toBe(false);
    },
    30_000,
  );
});
