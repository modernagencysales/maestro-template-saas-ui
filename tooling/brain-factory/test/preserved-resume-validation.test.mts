import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  validatePreservedResumeLaunch,
  validateTerminalAuthorityResumeOwner,
} from "../src/preserved-resume-validation.js";
import {
  auditedTerminalResumeRecord,
  preservedResumeDisposition,
  replaceTerminalTaskRecord,
} from "../src/dispatch-ownership.js";
import { adoptTerminalAuthorityResumeRecord } from "../src/resume-support.js";
import { archiveTerminalRun } from "../src/terminal-archive.js";

const roots: string[] = [];
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    killSignal: "SIGKILL",
    timeout: 25_000,
  }).trim();

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "brain-preserved-resume-"));
  roots.push(root);
  const repo = join(root, "repo");
  const workdir = join(root, "worktree");
  const evidence = join(root, "evidence");
  const state = join(root, "state");
  mkdirSync(repo);
  mkdirSync(evidence, { recursive: true });
  mkdirSync(join(state, "runs"), { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "factory@example.invalid");
  git(repo, "config", "user.name", "Factory Test");
  writeFileSync(join(repo, ".gitignore"), ".tokensave\n");
  writeFileSync(join(repo, "owned.txt"), "base\n");
  git(repo, "add", ".gitignore", "owned.txt");
  git(repo, "commit", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  git(repo, "checkout", "-b", "source");
  writeFileSync(join(repo, "owned.txt"), "source\n");
  git(repo, "commit", "-am", "source one");
  const sourceCommit = git(repo, "rev-parse", "HEAD");
  git(repo, "commit", "--allow-empty", "-m", "source checkpoint");
  const sourceHeadSha = git(repo, "rev-parse", "HEAD");
  git(repo, "checkout", "main");
  writeFileSync(join(repo, "owned.txt"), "control\n");
  git(repo, "commit", "-am", "control");
  const control = git(repo, "rev-parse", "HEAD");
  const branch = "fabro/review-s08-t03";
  git(repo, "worktree", "add", "-b", branch, workdir, control);
  const commonDir = git(
    repo,
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  );
  return {
    base,
    branch,
    commonDir,
    control,
    evidence,
    repo,
    sourceCommit,
    sourceHeadSha,
    state,
    workdir,
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("preserved resume launch validation", () => {
  it("adopts an exact clean terminal authority-refresh owner", () => {
    const value = fixture();
    const taskId = "S08-T03";
    const authorityId = "a1b2c3d4e5f6";
    const branch = `fabro/review-s08-t03-authority-${authorityId}`;
    const authorityWorkdir = join(
      value.workdir,
      "..",
      `resume-s08-t03-authority-${authorityId}`,
    );
    git(value.workdir, "branch", "-m", branch);
    git(value.repo, "worktree", "move", value.workdir, authorityWorkdir);
    const currentBase = value.control;
    writeFileSync(join(authorityWorkdir, "current.txt"), "current lane\n");
    git(authorityWorkdir, "add", "current.txt");
    git(authorityWorkdir, "commit", "-m", "current lane");
    const currentHead = git(authorityWorkdir, "rev-parse", "HEAD");
    const proofDirectory = join(value.evidence, "lane-results", taskId);
    mkdirSync(proofDirectory, { recursive: true });
    writeFileSync(
      join(proofDirectory, "ci-proof-packet.json"),
      JSON.stringify({
        baseSha: currentBase,
        headSha: currentHead,
        taskId,
      }),
    );
    writeFileSync(
      join(proofDirectory, "lane-result.json"),
      JSON.stringify({
        headSha: currentHead,
        taskId,
        treeSha: git(authorityWorkdir, "rev-parse", "HEAD^{tree}"),
      }),
    );
    const archiveDirectory = join(
      value.evidence,
      "authority-refreshes",
      taskId,
      authorityId,
    );
    mkdirSync(archiveDirectory, { recursive: true });
    const archivedCommits = git(
      authorityWorkdir,
      "rev-list",
      "--reverse",
      `${value.base}..${value.sourceHeadSha}`,
    ).split("\n");
    const artifactContents = {
      "prior-final-gate.json": '{"gate":"prior"}\n',
      "prior-lane-result.json": '{"lane":"prior"}\n',
      "prior-proof.json": '{"proof":"prior"}\n',
    } as const;
    for (const [file, content] of Object.entries(artifactContents))
      writeFileSync(join(archiveDirectory, file), content);
    const manifest = {
      schemaVersion: "maestro-brain-authority-refresh-archive/v1",
      taskId,
      authorityId,
      currentAuthority: { controlHeadSha: currentBase },
      source: {
        baseSha: value.base,
        commits: archivedCommits,
        headSha: value.sourceHeadSha,
      },
      artifacts: Object.entries(artifactContents).map(([file, content]) => ({
        file,
        sha256: sha256(content),
      })),
    };
    writeFileSync(
      join(archiveDirectory, "manifest.json"),
      JSON.stringify(manifest),
    );
    const input = {
      controlCommonDir: value.commonDir,
      evidence: value.evidence,
      record: {
        authorityArchivePath: realpathSync(archiveDirectory),
        baseSha: currentBase,
        branch,
        factoryBaseSha: currentBase,
        mode: "authority-refresh",
        resumeStrategy: "in-lane-cherry-pick",
        runId: "authority-run",
        sourceHeadSha: value.sourceHeadSha,
        status: "launched",
        taskBaseSha: value.base,
        taskId,
        workdir: realpathSync(authorityWorkdir),
      },
      resumeCommits: [currentHead],
      sourceHeadSha: currentHead,
      status: "succeeded",
      taskBaseSha: currentBase,
      taskId,
    } as const;

    const owner = validateTerminalAuthorityResumeOwner(input);
    expect(owner).toEqual({
      branch,
      factoryBaseSha: currentBase,
      proofHeadSha: currentHead,
      resumeStrategy: "in-lane-cherry-pick",
      startSha: currentHead,
      workdir: realpathSync(authorityWorkdir),
    });
    rmSync(join(proofDirectory, "lane-result.json"));
    writeFileSync(
      join(archiveDirectory, "manifest.json"),
      JSON.stringify({
        ...manifest,
        schemaVersion: "maestro-brain-authority-repair-archive/v1",
      }),
    );
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: { ...input.record, mode: "authority-repair" },
      }),
    ).not.toThrow();
    writeFileSync(
      join(proofDirectory, "lane-result.json"),
      JSON.stringify({
        headSha: currentHead,
        taskId,
        treeSha: git(authorityWorkdir, "rev-parse", "HEAD^{tree}"),
      }),
    );
    writeFileSync(
      join(archiveDirectory, "manifest.json"),
      JSON.stringify(manifest),
    );
    const adoptedRecord = adoptTerminalAuthorityResumeRecord({
      record: input.record,
      resumeStrategy: owner.resumeStrategy,
      sourceHeadSha: input.sourceHeadSha,
      taskBaseSha: input.taskBaseSha,
    });
    const expectedResume = {
      branch: owner.branch,
      mode: "resume-review" as const,
      resumeStrategy: owner.resumeStrategy,
      sourceHeadSha: input.sourceHeadSha,
      taskBaseSha: input.taskBaseSha,
      taskId,
      workdir: owner.workdir,
    };
    expect(
      preservedResumeDisposition({
        expected: expectedResume,
        observation: {
          branchExists: true,
          controlCommonDir: value.commonDir,
          headSha: currentHead,
          proofHeadIsAncestor: true,
          statusPorcelain: "",
          taskBaseIsAncestor: true,
          worktreeBranch: branch,
          worktreeCommonDir: value.commonDir,
          worktreeExists: true,
        },
        record: adoptedRecord,
      }),
    ).toEqual({ kind: "reuse-clean", startSha: currentHead });

    const recordPath = join(value.state, "runs", `${taskId}.json`);
    const terminalRecordContent = JSON.stringify(input.record);
    writeFileSync(recordPath, terminalRecordContent);
    replaceTerminalTaskRecord({
      auditPath: join(value.state, "recovery-audit.jsonl"),
      expectedContent: terminalRecordContent,
      now: "2026-07-20T00:00:00.000Z",
      recordPath,
      replacement: { ...adoptedRecord, status: "preparing" },
      runId: input.record.runId,
      status: input.status,
      taskId,
    });
    expect(JSON.parse(readFileSync(recordPath, "utf8"))).toMatchObject({
      sourceHeadSha: currentHead,
      taskBaseSha: currentBase,
    });
    expect(input.record).toMatchObject({
      sourceHeadSha: value.sourceHeadSha,
      taskBaseSha: value.base,
    });
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        status: "running",
      }),
    ).toThrow("authority owner run is not terminal");
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        sourceHeadSha: value.control,
      }),
    ).toThrow("preserved worktree HEAD mismatch");
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: { ...input.record, sourceHeadSha: value.sourceCommit },
      }),
    ).toThrow("authority owner archive provenance mismatch");
    const archiveManifestPath = join(archiveDirectory, "manifest.json");
    const archiveManifestContent = readFileSync(archiveManifestPath, "utf8");
    const missingAuthorityId = { ...manifest, authorityId: undefined };
    writeFileSync(archiveManifestPath, JSON.stringify(missingAuthorityId));
    expect(() => validateTerminalAuthorityResumeOwner(input)).toThrow(
      "authority owner archive identity mismatch",
    );
    writeFileSync(
      archiveManifestPath,
      JSON.stringify({ ...manifest, authorityId: "f1e2d3c4b5a6" }),
    );
    expect(() => validateTerminalAuthorityResumeOwner(input)).toThrow(
      "authority owner archive identity mismatch",
    );
    writeFileSync(archiveManifestPath, archiveManifestContent);
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: {
          ...input.record,
          branch: "fabro/review-s08-t03-authority-f1e2d3c4b5a6",
        },
      }),
    ).toThrow("authority owner recorded coordinates mismatch");
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: {
          ...input.record,
          workdir: join(
            authorityWorkdir,
            "..",
            "resume-s08-t03-authority-f1e2d3c4b5a6",
          ),
        },
      }),
    ).toThrow("authority owner recorded coordinates mismatch");
    const copiedArchive = join(
      value.evidence,
      "authority-refreshes",
      taskId,
      "f1e2d3c4b5a6",
    );
    mkdirSync(copiedArchive, { recursive: true });
    for (const [file, content] of Object.entries(artifactContents))
      writeFileSync(join(copiedArchive, file), content);
    writeFileSync(join(copiedArchive, "manifest.json"), archiveManifestContent);
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: { ...input.record, authorityArchivePath: copiedArchive },
      }),
    ).toThrow("authority owner archive identity mismatch");
    writeFileSync(
      join(archiveDirectory, "prior-proof.json"),
      '{"proof":"forged"}\n',
    );
    expect(() => validateTerminalAuthorityResumeOwner(input)).toThrow(
      "authority owner archive artifact hash mismatch",
    );
    writeFileSync(
      join(archiveDirectory, "prior-proof.json"),
      artifactContents["prior-proof.json"],
    );
    const nonancestralManifest = JSON.parse(archiveManifestContent);
    nonancestralManifest.source.baseSha = value.sourceCommit;
    nonancestralManifest.source.commits = git(
      authorityWorkdir,
      "rev-list",
      "--reverse",
      `${value.sourceCommit}..${value.sourceHeadSha}`,
    ).split("\n");
    writeFileSync(archiveManifestPath, JSON.stringify(nonancestralManifest));
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        record: { ...input.record, taskBaseSha: value.sourceCommit },
      }),
    ).toThrow("authority owner archived provenance is not ancestral");
    writeFileSync(archiveManifestPath, archiveManifestContent);
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        taskBaseSha: value.base,
      }),
    ).toThrow("authority owner launch base mismatch");
    expect(() =>
      validateTerminalAuthorityResumeOwner({
        ...input,
        resumeCommits: [value.sourceCommit],
      }),
    ).toThrow("source commit range mismatch");
    writeFileSync(
      join(proofDirectory, "lane-result.json"),
      JSON.stringify({
        headSha: currentHead,
        taskId,
        treeSha: value.base,
      }),
    );
    expect(() => validateTerminalAuthorityResumeOwner(input)).toThrow(
      "authority owner lane identity mismatch",
    );
    writeFileSync(
      join(proofDirectory, "lane-result.json"),
      JSON.stringify({
        headSha: currentHead,
        taskId,
        treeSha: git(authorityWorkdir, "rev-parse", "HEAD^{tree}"),
      }),
    );
    writeFileSync(join(authorityWorkdir, "dirty.txt"), "dirty\n");
    expect(() => validateTerminalAuthorityResumeOwner(input)).toThrow(
      "clean preserved worktree is dirty",
    );
  }, 30_000);

  it("revalidates an exact clean registered worktree and proof", () => {
    const value = fixture();
    const proofDirectory = join(value.evidence, "lane-results", "S08-T03");
    mkdirSync(proofDirectory, { recursive: true });
    writeFileSync(
      join(proofDirectory, "ci-proof-packet.json"),
      JSON.stringify({
        baseSha: value.control,
        headSha: value.control,
        taskId: "S08-T03",
      }),
    );
    const expected = {
      baseSha: value.control,
      branch: value.branch,
      controlCommonDir: value.commonDir,
      evidence: value.evidence,
      expectedCommit: "none",
      mode: "preserved-worktree" as const,
      proofHead: value.control,
      resumeCommits: [value.sourceCommit],
      sourceHeadSha: value.sourceHeadSha,
      startSha: value.control,
      taskBaseSha: value.base,
      taskId: "S08-T03",
      workdir: value.workdir,
    };
    const recordPath = join(value.state, "runs", "S08-T03.json");
    writeFileSync(
      recordPath,
      JSON.stringify({
        ...expected,
        factoryBaseSha: value.control,
        mode: "resume-review",
        resumeStrategy: "in-lane-cherry-pick",
        runId: "run-archived",
        status: "launched",
      }),
    );
    archiveTerminalRun({
      actionId: "a".repeat(64),
      inspect: () => "failed",
      now: "2026-07-20T00:00:00.000Z",
      runId: "run-archived",
      state: value.state,
      taskId: "S08-T03",
    });
    expect(
      auditedTerminalResumeRecord({
        auditPath: join(value.state, "recovery-audit.jsonl"),
        expected: {
          branch: expected.branch,
          mode: "resume-review",
          resumeStrategy: "in-lane-cherry-pick",
          sourceHeadSha: expected.sourceHeadSha,
          taskBaseSha: expected.taskBaseSha,
          taskId: expected.taskId,
          workdir: expected.workdir,
        },
        recordPath,
      }),
    ).toMatchObject({
      archivedPath: `${recordPath}.terminal-${"a".repeat(64)}`,
      record: { runId: "run-archived" },
      status: "failed",
    });
    expect(validatePreservedResumeLaunch(expected)).toMatchObject({
      branch: value.branch,
      headSha: value.control,
      mode: "preserved-worktree",
      workdir: realpathSync(value.workdir),
    });
    expect(() =>
      validatePreservedResumeLaunch({
        ...expected,
        branch: "fabro/review-something-else",
      }),
    ).toThrow("branch mismatch");
    expect(() =>
      validatePreservedResumeLaunch({
        ...expected,
        controlCommonDir: join(value.repo, ".git", "other"),
      }),
    ).toThrow("common directory mismatch");
    expect(() =>
      validatePreservedResumeLaunch({
        ...expected,
        workdir: join(value.workdir, "alias"),
      }),
    ).toThrow("worktree path mismatch");
    writeFileSync(
      join(proofDirectory, "ci-proof-packet.json"),
      JSON.stringify({
        baseSha: value.control,
        headSha: value.base,
        taskId: "S08-T03",
      }),
    );
    expect(() => validatePreservedResumeLaunch(expected)).toThrow(
      "proof head mismatch",
    );
    writeFileSync(
      join(proofDirectory, "ci-proof-packet.json"),
      JSON.stringify({
        baseSha: value.control,
        headSha: value.control,
        taskId: "S08-T03",
      }),
    );
    git(value.workdir, "branch", "-m", "fabro/review-mutated");
    expect(() => validatePreservedResumeLaunch(expected)).toThrow(
      "branch mismatch",
    );
    git(value.workdir, "branch", "-m", value.branch);
    git(
      value.repo,
      "worktree",
      "move",
      value.workdir,
      join(value.repo, "..", "moved-worktree"),
    );
    expect(() => validatePreservedResumeLaunch(expected)).toThrow(
      "worktree path mismatch",
    );
  }, 30_000);

  it("binds a dirty conflict to the exact pinned cherry-pick commit", () => {
    const value = fixture();
    expect(() =>
      git(value.workdir, "cherry-pick", value.sourceCommit),
    ).toThrow();
    const expected = {
      baseSha: value.control,
      branch: value.branch,
      controlCommonDir: value.commonDir,
      evidence: value.evidence,
      expectedCommit: value.sourceCommit,
      mode: "preserved-conflict-aware" as const,
      proofHead: "none",
      resumeCommits: [value.sourceCommit],
      sourceHeadSha: value.sourceHeadSha,
      startSha: value.control,
      taskBaseSha: value.base,
      taskId: "S08-T03",
      workdir: value.workdir,
    };
    expect(validatePreservedResumeLaunch(expected)).toMatchObject({
      cherryPickHead: value.sourceCommit,
      mode: "preserved-conflict-aware",
    });
    writeFileSync(join(value.workdir, "untracked.txt"), "unsafe\n");
    expect(() => validatePreservedResumeLaunch(expected)).toThrow(
      "untracked files",
    );
    rmSync(join(value.workdir, "untracked.txt"));
    expect(() =>
      validatePreservedResumeLaunch({
        ...expected,
        expectedCommit: value.base,
      }),
    ).toThrow("outside pinned sequence");
    expect(() =>
      validatePreservedResumeLaunch({
        ...expected,
        resumeCommits: [value.control],
      }),
    ).toThrow("source commit range mismatch");
  }, 30_000);
});
