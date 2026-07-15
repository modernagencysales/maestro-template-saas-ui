import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateIntegrationResult } from "../src/integration-result-check.mjs";
import { archiveIntegrationEvidence } from "../src/evidence-archive.js";
import { gateCommandSetHash } from "../src/lane-gate-cache.js";

const temporaryDirectories: string[] = [];

const command = (directory: string, ...args: string[]): string =>
  execFileSync("rtk", ["proxy", "git", ...args], {
    cwd: directory,
    encoding: "utf8",
  }).trim();

const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const fixture = () => {
  const root = mkdtempSync(resolve(tmpdir(), "brain-integration-check-"));
  temporaryDirectories.push(root);
  const workdir = resolve(root, "integration");
  const evidence = resolve(root, "evidence");
  const integrationId = "C1-contract-spine-w2";
  const manifestTranche = "C1-contract-spine";
  const taskId = "S09-T01";
  const planSha256 = "1".repeat(64);
  const taskBlockHash = "2".repeat(64);
  const manifestDirectory = resolve(
    root,
    "docs/superpowers/execution/maestro-brain",
  );
  mkdirSync(manifestDirectory, { recursive: true });
  const manifestPath = resolve(manifestDirectory, "task-manifest.json");
  writeJson(manifestPath, {
    schemaVersion: "maestro-brain-task-manifest/v1",
    planSha256,
    tasks: [
      {
        taskId,
        taskBlockHash,
        tranche: manifestTranche,
        codeStartAfter: [],
        fileInventoryStatus: "ready",
        fileLocks: ["source.ts"],
        gateProfiles: ["docs"],
      },
    ],
  });
  mkdirSync(workdir);
  command(workdir, "init", "-q");
  command(workdir, "config", "user.email", "brain@example.test");
  command(workdir, "config", "user.name", "Brain Test");
  writeFileSync(resolve(workdir, "source.ts"), "export const ready = false;\n");
  command(workdir, "add", "source.ts");
  command(workdir, "commit", "-qm", "test: add base");
  const baseSha = command(workdir, "rev-parse", "HEAD");
  command(workdir, "checkout", "-qb", "lane");
  writeFileSync(resolve(workdir, "source.ts"), "export const ready = true;\n");
  command(workdir, "add", "source.ts");
  command(workdir, "commit", "-qm", "test: add lane change");
  const laneHeadSha = command(workdir, "rev-parse", "HEAD");
  command(workdir, "checkout", "-qb", "integration", baseSha);
  writeFileSync(
    resolve(workdir, "integration.ts"),
    "export const merge = true;\n",
  );
  command(workdir, "add", "integration.ts");
  command(workdir, "commit", "-qm", "test: prepare integration");
  command(workdir, "cherry-pick", laneHeadSha);
  const headSha = command(workdir, "rev-parse", "HEAD");
  const integrationDirectory = resolve(evidence, "integration", integrationId);
  const laneDirectory = resolve(evidence, "lane-results", taskId);
  mkdirSync(integrationDirectory, { recursive: true });
  mkdirSync(laneDirectory, { recursive: true });
  const resultPath = resolve(integrationDirectory, "integration-result.json");
  const lanePath = resolve(laneDirectory, "lane-result.json");
  writeJson(resultPath, {
    schemaVersion: "maestro-brain-integration-result/v1",
    integrationId,
    manifestTranche,
    integrationWorkdir: realpathSync(workdir),
    baseSha,
    headSha,
    status: "passed",
    reviewVerdict: "pass",
    broadGate: {
      status: "passed",
      headSha,
      command: "rtk host-test-slot --class full pnpm verify",
    },
    includedTasks: [{ taskId }],
  });
  writeJson(lanePath, {
    acceptanceBlocker: "external acceptance evidence is not yet present",
    accepted: false,
    taskId,
    headSha: laneHeadSha,
    status: "integrated",
    integrationHeadSha: headSha,
    integrationId,
    tranche: manifestTranche,
  });
  const proofPath = resolve(laneDirectory, "ci-proof-packet.json");
  writeJson(proofPath, {
    schemaVersion: "maestro-brain-ci-proof/v1",
    taskId,
    planSha256,
    taskBlockHash,
    baseSha,
    changedFiles: ["source.ts"],
    headSha: laneHeadSha,
    reviewVerdict: "pass",
    focusedCommands: ["rtk pnpm --dir packages/search typecheck"],
  });
  const gateCommands = [
    {
      program: "pnpm",
      args: ["exec", "prettier", "--check", "--ignore-unknown", "source.ts"],
    },
    { program: "pnpm", args: ["exec", "eslint", "source.ts"] },
    { program: "pnpm", args: ["--dir", "packages/search", "typecheck"] },
  ];
  const gatePath = resolve(laneDirectory, "lane-gate-report.json");
  writeJson(gatePath, {
    schemaVersion: "maestro-brain-lane-gate/v1",
    taskId,
    headSha: laneHeadSha,
    currentHeadSha: laneHeadSha,
    planSha256,
    taskBlockHash,
    commandSetHash: gateCommandSetHash(gateCommands),
    commands: gateCommands.map(
      (gateCommand) =>
        `rtk ${gateCommand.program} ${gateCommand.args.join(" ")}`,
    ),
    stage: "final",
    status: "passed",
  });
  return {
    baseSha,
    controlRoot: root,
    evidence,
    headSha,
    integrationId,
    gatePath,
    lanePath,
    manifestPath,
    manifestTranche,
    planSha256,
    proofPath,
    resultPath,
    taskBlockHash,
    workdir,
  };
};

const readRecord = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("normal integration result check", () => {
  it("accepts an exact passed head and integrated lane", () => {
    const value = fixture();
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).not.toThrow();
  });

  it("rejects legacy integrated records without explicit acceptance state", () => {
    const value = fixture();
    const lane = readRecord(value.lanePath);
    delete lane.accepted;
    delete lane.acceptanceBlocker;
    writeJson(value.lanePath, lane);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow(/migrate and re-prove legacy records/);
  });

  it("archives final integration evidence by content hash and rejects drift", () => {
    const value = fixture();
    validateIntegrationResult({
      controlRoot: value.controlRoot,
      evidenceDirectory: value.evidence,
      expectedWorkdir: value.workdir,
      integrationId: value.integrationId,
      manifestTranche: value.manifestTranche,
    });
    const archived = archiveIntegrationEvidence({
      evidenceDirectory: value.evidence,
      integrationId: value.integrationId,
      manifestTranche: value.manifestTranche,
    });
    expect(archived.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(archived.artifactPath).toContain(archived.contentSha256);
    expect(existsSync(archived.artifactPath)).toBe(true);
    expect(existsSync(archived.manifestPath)).toBe(true);
    expect(
      archiveIntegrationEvidence({
        evidenceDirectory: value.evidence,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toEqual(archived);

    const proof = readRecord(value.proofPath);
    proof.archiveDrift = true;
    writeJson(value.proofPath, proof);
    expect(() =>
      archiveIntegrationEvidence({
        evidenceDirectory: value.evidence,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("archived evidence drift");
  });

  it("rejects archive path traversal identities", () => {
    const value = fixture();
    expect(() =>
      archiveIntegrationEvidence({
        evidenceDirectory: value.evidence,
        integrationId: "..",
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("integrationId is not a safe path segment");
  });

  it("rejects integration identity and head drift", () => {
    const value = fixture();
    const result = readRecord(value.resultPath);
    result.integrationId = "C1-contract-spine-w3";
    writeJson(value.resultPath, result);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("integrationId mismatch");
  });

  it("rejects a broad gate not bound to the exact head", () => {
    const value = fixture();
    const result = readRecord(value.resultPath);
    result.broadGate = {
      status: "passed",
      headSha: "wrong-head",
      command: "rtk host-test-slot --class full pnpm verify",
    };
    writeJson(value.resultPath, result);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("broad gate receipt does not prove this head");
  });

  it("rejects lane evidence not bound to the integration attempt", () => {
    const value = fixture();
    const lane = readRecord(value.lanePath);
    lane.integrationId = "C1-contract-spine";
    writeJson(value.lanePath, lane);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: integrationId mismatch");
  });

  it("rejects a proof that omits a changed file", () => {
    const value = fixture();
    const proof = readRecord(value.proofPath);
    proof.changedFiles = ["integration.ts"];
    writeJson(value.proofPath, proof);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: proof changedFiles do not match the task diff");
  });

  it("rejects a lane diff outside its exact manifest locks", () => {
    const value = fixture();
    const manifest = readRecord(value.manifestPath);
    const tasks = manifest.tasks as Array<Record<string, unknown>>;
    tasks[0] = { ...tasks[0], fileLocks: ["another-source.ts"] };
    writeJson(value.manifestPath, manifest);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: source.ts: not declared in manifest fileLocks");
  });

  it("rejects an integrated task whose lifecycle record remains a stub", () => {
    const value = fixture();
    const recordPath =
      "docs/product/maestro-brain-lifecycle-adoption/S09-T01.md";
    const manifest = readRecord(value.manifestPath);
    const tasks = manifest.tasks as Array<Record<string, unknown>>;
    tasks[0] = { ...tasks[0], fileLocks: ["source.ts", recordPath] };
    writeJson(value.manifestPath, manifest);
    const absoluteRecordPath = resolve(value.workdir, recordPath);
    mkdirSync(resolve(absoluteRecordPath, ".."), { recursive: true });
    writeFileSync(
      absoluteRecordPath,
      "# S09-T01 Lifecycle Adoption Record\n\n**Owner:** S09-T01  \n**State:** task-owned stub\n",
    );
    command(value.workdir, "add", recordPath);
    command(
      value.workdir,
      "commit",
      "-qm",
      "test: preserve stale lifecycle record",
    );
    const stubHeadSha = command(value.workdir, "rev-parse", "HEAD");
    const result = readRecord(value.resultPath);
    result.headSha = stubHeadSha;
    result.broadGate = {
      status: "passed",
      headSha: stubHeadSha,
      command: "rtk host-test-slot --class full pnpm verify",
    };
    writeJson(value.resultPath, result);
    const lane = readRecord(value.lanePath);
    lane.integrationHeadSha = stubHeadSha;
    writeJson(value.lanePath, lane);

    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: lifecycle adoption record remains a task-owned stub");
  });

  it("rejects proof schema, plan, and task-block drift", () => {
    const value = fixture();
    const original = readRecord(value.proofPath);
    const cases = [
      ["schemaVersion", "legacy", "unexpected CI proof schema"],
      ["planSha256", "stale", "proof plan hash mismatch"],
      ["taskBlockHash", "stale", "proof task block hash mismatch"],
    ] as const;
    for (const [field, replacement, message] of cases) {
      writeJson(value.proofPath, { ...original, [field]: replacement });
      expect(() =>
        validateIntegrationResult({
          controlRoot: value.controlRoot,
          evidenceDirectory: value.evidence,
          expectedWorkdir: value.workdir,
          integrationId: value.integrationId,
          manifestTranche: value.manifestTranche,
        }),
      ).toThrow(message);
    }
    writeJson(value.proofPath, original);
  });

  it("rejects final gates from another plan or task block", () => {
    for (const field of ["planSha256", "taskBlockHash"] as const) {
      const value = fixture();
      const gate = readRecord(value.gatePath);
      gate[field] = "stale";
      writeJson(value.gatePath, gate);
      expect(() =>
        validateIntegrationResult({
          controlRoot: value.controlRoot,
          evidenceDirectory: value.evidence,
          expectedWorkdir: value.workdir,
          integrationId: value.integrationId,
          manifestTranche: value.manifestTranche,
        }),
      ).toThrow("final lane gate does not bind the lane head");
    }
  });

  it("rejects a task outside the manifest tranche", () => {
    const value = fixture();
    writeJson(value.manifestPath, {
      schemaVersion: "maestro-brain-task-manifest/v1",
      planSha256: value.planSha256,
      tasks: [
        {
          taskId: "S09-T01",
          taskBlockHash: value.taskBlockHash,
          tranche: "D2-domain-bodies",
          codeStartAfter: [],
          fileInventoryStatus: "ready",
          fileLocks: ["source.ts"],
          gateProfiles: ["docs"],
        },
      ],
    });
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: task manifest tranche mismatch");
  });

  it("rejects stale proof and final-gate chains", () => {
    const value = fixture();
    const proof = readRecord(value.proofPath);
    proof.reviewVerdict = "rework";
    writeJson(value.proofPath, proof);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: proof does not bind a reviewed passing lane head");

    proof.reviewVerdict = "pass";
    writeJson(value.proofPath, proof);
    const gate = readRecord(value.gatePath);
    gate.currentHeadSha = "stale-head";
    writeJson(value.gatePath, gate);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: final lane gate does not bind the lane head");
  });

  it("rejects an unsatisfied code-start dependency", () => {
    const value = fixture();
    writeJson(value.manifestPath, {
      schemaVersion: "maestro-brain-task-manifest/v1",
      planSha256: value.planSha256,
      tasks: [
        {
          taskId: "S09-T01",
          taskBlockHash: value.taskBlockHash,
          tranche: value.manifestTranche,
          codeStartAfter: ["S08-T01"],
          fileInventoryStatus: "ready",
          fileLocks: ["source.ts"],
          gateProfiles: ["docs"],
        },
      ],
    });
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T01: dependency S08-T01 has no lane result");
  });

  it("trusts prior integration provenance after legitimate later file edits", () => {
    const value = fixture();
    const manifest = readRecord(value.manifestPath);
    const tasks = manifest.tasks as Record<string, unknown>[];
    const currentTask = tasks[0];
    if (!currentTask) throw new Error("current task fixture missing");
    currentTask.codeStartAfter = ["S08-T01"];
    tasks.push({
      codeStartAfter: [],
      fileInventoryStatus: "ready",
      fileLocks: ["prior-owned-doc.md"],
      gateProfiles: ["docs"],
      taskBlockHash: "3".repeat(64),
      taskId: "S08-T01",
      tranche: "D2-domain-bodies",
    });
    writeJson(value.manifestPath, manifest);
    const dependencyLaneDirectory = resolve(
      value.evidence,
      "lane-results",
      "S08-T01",
    );
    mkdirSync(dependencyLaneDirectory, { recursive: true });
    writeJson(resolve(dependencyLaneDirectory, "lane-result.json"), {
      acceptanceBlocker: "external acceptance evidence is pending",
      accepted: false,
      headSha: value.baseSha,
      integrationHeadSha: value.baseSha,
      integrationId: "D2-domain-bodies-w1",
      status: "integrated",
      taskId: "S08-T01",
      tranche: "D2-domain-bodies",
    });
    const priorResultPath = resolve(
      value.evidence,
      "integration",
      "D2-domain-bodies-w1",
      "integration-result.json",
    );
    mkdirSync(resolve(priorResultPath, ".."), { recursive: true });
    writeJson(priorResultPath, {
      headSha: value.baseSha,
      includedTasks: [{ laneHeadSha: value.baseSha, taskId: "S08-T01" }],
      integrationId: "D2-domain-bodies-w1",
      reviewVerdict: "pass",
      schemaVersion: "maestro-brain-integration-result/v1",
      status: "passed",
    });
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).not.toThrow();

    const prior = readRecord(priorResultPath);
    prior.includedTasks = [{ laneHeadSha: "c".repeat(40), taskId: "S08-T01" }];
    writeJson(priorResultPath, prior);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow(/not bound by its authoritative integration result/);
  });

  it("rejects conflicting included-task locks", () => {
    const value = fixture();
    writeJson(value.manifestPath, {
      schemaVersion: "maestro-brain-task-manifest/v1",
      planSha256: value.planSha256,
      tasks: [
        {
          taskId: "S09-T01",
          taskBlockHash: value.taskBlockHash,
          tranche: value.manifestTranche,
          codeStartAfter: [],
          fileInventoryStatus: "ready",
          fileLocks: ["source.ts"],
          gateProfiles: ["docs"],
        },
        {
          taskId: "S09-T02",
          taskBlockHash: "3".repeat(64),
          tranche: value.manifestTranche,
          codeStartAfter: [],
          fileInventoryStatus: "ready",
          fileLocks: ["source.ts"],
          gateProfiles: ["docs"],
        },
      ],
    });
    const result = readRecord(value.resultPath);
    result.includedTasks = [{ taskId: "S09-T01" }, { taskId: "S09-T02" }];
    writeJson(value.resultPath, result);
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("S09-T02: file lock source.ts conflicts with S09-T01");
  });

  it("rejects a dirty integration worktree", () => {
    const value = fixture();
    writeFileSync(resolve(value.workdir, "dirty.txt"), "dirty\n");
    expect(() =>
      validateIntegrationResult({
        controlRoot: value.controlRoot,
        evidenceDirectory: value.evidence,
        expectedWorkdir: value.workdir,
        integrationId: value.integrationId,
        manifestTranche: value.manifestTranche,
      }),
    ).toThrow("integration worktree is not clean");
  });
});
