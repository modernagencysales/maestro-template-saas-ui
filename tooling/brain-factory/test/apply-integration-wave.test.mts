import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyIntegrationWave,
  type ApplyIntegrationWaveHooks,
  type ApplyIntegrationWaveInput,
} from "../src/apply-integration-wave.js";
import {
  INTEGRATION_WAVE_SCHEMA,
  selectionFileSha256,
  selectionPayload,
  selectionPayloadSha256,
  type IntegrationWaveTaskSnapshot,
} from "../src/integration-wave.js";

const roots: string[] = [];

const git = (root: string, ...args: string[]): string =>
  execFileSync("rtk", ["proxy", "git", ...args], {
    cwd: root,
    encoding: "utf8",
  }).trim();

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const write = (path: string, content: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const writeJson = (path: string, value: unknown): string => {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  write(path, content);
  return content;
};

interface LaneFixture {
  readonly commits: readonly string[];
  readonly headSha: string;
  readonly snapshot: IntegrationWaveTaskSnapshot;
  readonly taskId: string;
}

interface Fixture {
  readonly baseSha: string;
  readonly controlRoot: string;
  readonly evidenceDirectory: string;
  readonly events: string[];
  readonly input: ApplyIntegrationWaveInput;
  readonly lanes: readonly LaneFixture[];
  readonly selectionPath: string;
  readonly workdir: string;
}

const makeFixture = (options?: {
  readonly generated?: boolean;
  readonly laneSpecs?: readonly {
    readonly files: readonly string[];
    readonly taskId: string;
  }[];
  readonly reverseCreation?: boolean;
}): Fixture => {
  const controlRoot = mkdtempSync(resolve(tmpdir(), "brain-wave-control-"));
  const workdir = mkdtempSync(resolve(tmpdir(), "brain-wave-apply-"));
  roots.push(controlRoot, workdir);
  const evidenceDirectory = resolve(controlRoot, ".fabro/state/evidence");
  const selectionPath = resolve(
    controlRoot,
    ".fabro/state/runs/selection.json",
  );
  const events: string[] = [];
  const planSha256 = "1".repeat(64);
  git(workdir, "init", "-q");
  git(workdir, "config", "core.hooksPath", "/dev/null");
  git(workdir, "config", "user.email", "wave@example.test");
  git(workdir, "config", "user.name", "Wave Test");
  write(resolve(workdir, ".gitignore"), ".tokensave/\n");
  write(resolve(workdir, "base.txt"), "base\n");
  git(workdir, "add", ".");
  git(workdir, "commit", "-qm", "test: base");
  const baseSha = git(workdir, "rev-parse", "HEAD");
  const laneSpecs =
    options?.laneSpecs ??
    ([
      { files: ["a.ts"], taskId: "S01-T01" },
      { files: ["b.ts"], taskId: "S01-T02" },
    ] as const);
  const created = options?.reverseCreation
    ? [...laneSpecs].reverse()
    : laneSpecs;
  const laneById = new Map<string, LaneFixture>();
  for (const spec of created) {
    git(workdir, "checkout", "-qB", `lane-${spec.taskId}`, baseSha);
    const commits: string[] = [];
    for (const [index, file] of spec.files.entries()) {
      write(resolve(workdir, file), `export const value${index} = ${index};\n`);
      git(workdir, "add", file);
      git(workdir, "commit", "-qm", `test: ${spec.taskId} ${index}`);
      commits.push(git(workdir, "rev-parse", "HEAD"));
    }
    const headSha = git(workdir, "rev-parse", "HEAD");
    const treeSha = git(workdir, "rev-parse", "HEAD^{tree}");
    const laneDirectory = resolve(
      evidenceDirectory,
      "lane-results",
      spec.taskId,
    );
    const taskBlockHash = sha256(`block:${spec.taskId}`);
    const changedFiles = [...spec.files].sort();
    const focusedCommands = [
      "rtk pnpm --dir packages/search typecheck",
      ...(spec.taskId === "S01-T02"
        ? ["rtk pnpm --dir packages/search typecheck"]
        : []),
    ];
    const proofContent = writeJson(
      resolve(laneDirectory, "ci-proof-packet.json"),
      {
        schemaVersion: "maestro-brain-ci-proof/v1",
        taskId: spec.taskId,
        planSha256,
        taskBlockHash,
        baseSha,
        changedFiles,
        headSha,
        reviewVerdict: "pass",
        reviewHeadSha: headSha,
        reviewFindings: [],
        focusedCommands,
      },
    );
    const gateContent = writeJson(
      resolve(laneDirectory, "lane-gate-report.json"),
      {
        schemaVersion: "maestro-brain-lane-gate/v1",
        taskId: spec.taskId,
        stage: "final",
        status: "passed",
        headSha,
        currentHeadSha: headSha,
        currentTreeSha: treeSha,
        planSha256,
        taskBlockHash,
      },
    );
    const laneContent = writeJson(resolve(laneDirectory, "lane-result.json"), {
      schemaVersion: "maestro-brain-lane-result/v1",
      taskId: spec.taskId,
      tranche: "F0-foundation",
      status: "lane_green",
      headSha,
      treeSha,
    });
    laneById.set(spec.taskId, {
      commits,
      headSha,
      snapshot: {
        changedFiles,
        codeStartAfter: [],
        fileLocks: changedFiles,
        gateHeadSha: headSha,
        gateSha256: sha256(gateContent),
        headSha,
        laneResultSha256: sha256(laneContent),
        planSha256,
        proofHeadSha: headSha,
        proofSha256: sha256(proofContent),
        taskBlockHash,
        taskId: spec.taskId,
        tranche: "F0-foundation",
      },
      taskId: spec.taskId,
    });
  }
  const lanes = [...laneSpecs]
    .sort((left, right) => left.taskId.localeCompare(right.taskId))
    .map((spec) => laneById.get(spec.taskId) as LaneFixture);
  writeJson(
    resolve(
      controlRoot,
      "docs/superpowers/execution/maestro-brain/task-manifest.json",
    ),
    {
      schemaVersion: "maestro-brain-task-manifest/v1",
      planSha256,
      tasks: lanes.map((lane) => ({
        taskId: lane.taskId,
        taskBlockHash: lane.snapshot.taskBlockHash,
        tranche: lane.snapshot.tranche,
        codeStartAfter: [],
        fileInventoryStatus: "ready",
        fileLocks: lane.snapshot.fileLocks,
        gateProfiles: ["tooling"],
        kind: "product",
      })),
    },
  );
  git(workdir, "checkout", "-qB", "integration", baseSha);
  const payload = selectionPayload({
    baseSha,
    deferredTaskIds: [],
    integrationId: "wave-000001",
    planSha256,
    requestedTaskIds: lanes.map((lane) => lane.taskId),
    selectedTasks: lanes.map((lane) => lane.snapshot),
  });
  const selection = {
    ...payload,
    schemaVersion: INTEGRATION_WAVE_SCHEMA,
    selectionPayloadSha256: selectionPayloadSha256(payload),
  };
  const selectionContent = writeJson(selectionPath, selection);
  const hooks: ApplyIntegrationWaveHooks = {
    hydrate: () => {
      events.push("hydrate");
    },
    run: (args, cwd) => {
      const key = args.join(" ");
      events.push(key);
      if (key === "pnpm confect:codegen" && options?.generated) {
        write(
          resolve(
            cwd,
            "packages/template-core/src/generated/confectManifest.ts",
          ),
          "export const generated = true;\n",
        );
      }
      return "";
    },
  };
  return {
    baseSha,
    controlRoot,
    evidenceDirectory,
    events,
    input: {
      baseSha,
      controlRoot,
      evidenceDirectory,
      hooks,
      integrationId: "wave-000001",
      mode: "integrate",
      selectionFileSha256: selectionFileSha256(selectionContent),
      selectionPath,
      selectionPayloadSha256: selection.selectionPayloadSha256,
      workdir,
    },
    lanes,
    selectionPath,
    workdir,
  };
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("deterministic integration wave application", () => {
  it("applies independent lanes in immutable selection order", () => {
    const value = makeFixture({ reverseCreation: true });
    const result = applyIntegrationWave(value.input);
    expect(result.includedTasks.map((task) => task.taskId)).toEqual([
      "S01-T01",
      "S01-T02",
    ]);
    expect(result.includedTasks.map((task) => task.patchState)).toEqual([
      "applied",
      "applied",
    ]);
    expect(readFileSync(resolve(value.workdir, "a.ts"), "utf8")).toContain(
      "value0",
    );
    expect(readFileSync(resolve(value.workdir, "b.ts"), "utf8")).toContain(
      "value0",
    );
  });

  it("applies and records every commit in a multi-commit lane", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts", "b.ts"], taskId: "S01-T01" }],
    });
    const result = applyIntegrationWave(value.input);
    expect(result.includedTasks[0]?.commitShas).toEqual(
      value.lanes[0]?.commits,
    );
  });

  it("accepts a completely present range only during recovery", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    git(value.workdir, "cherry-pick", value.lanes[0]?.headSha as string);
    const recovered = applyIntegrationWave({ ...value.input, mode: "recover" });
    expect(recovered.includedTasks[0]?.patchState).toBe("already-present");

    const current = git(value.workdir, "rev-parse", "HEAD");
    const content = JSON.parse(
      readFileSync(value.selectionPath, "utf8"),
    ) as Record<string, unknown>;
    const payload = { ...content, baseSha: current } as Record<string, unknown>;
    delete payload.selectionPayloadSha256;
    const selection = {
      ...payload,
      selectionPayloadSha256: selectionPayloadSha256(payload),
    };
    const selectionContent = writeJson(value.selectionPath, selection);
    expect(() =>
      applyIntegrationWave({
        ...value.input,
        baseSha: current,
        selectionFileSha256: selectionFileSha256(selectionContent),
        selectionPayloadSha256: selection.selectionPayloadSha256,
      }),
    ).toThrow(/duplicate.*S01-T01|S01-T01.*duplicate/);
  });

  it("rejects a partially present range and leaves no Git residue", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts", "b.ts"], taskId: "S01-T01" }],
    });
    git(value.workdir, "cherry-pick", value.lanes[0]?.commits[0] as string);
    expect(() =>
      applyIntegrationWave({ ...value.input, mode: "recover" }),
    ).toThrow(/S01-T01.*partial|partial.*S01-T01/);
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
    expect(existsSync(resolve(value.workdir, ".git/CHERRY_PICK_HEAD"))).toBe(
      false,
    );
  });

  it("aborts a conflicting cherry-pick and reports task and commit", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    write(resolve(value.workdir, "a.ts"), "export const conflict = true;\n");
    git(value.workdir, "add", "a.ts");
    git(value.workdir, "commit", "-qm", "test: conflicting base work");
    const conflictingBase = git(value.workdir, "rev-parse", "HEAD");
    const raw = JSON.parse(readFileSync(value.selectionPath, "utf8")) as Record<
      string,
      unknown
    >;
    const payload = { ...raw, baseSha: conflictingBase } as Record<
      string,
      unknown
    >;
    delete payload.selectionPayloadSha256;
    const selection = {
      ...payload,
      selectionPayloadSha256: selectionPayloadSha256(payload),
    };
    const selectionContent = writeJson(value.selectionPath, selection);
    expect(() =>
      applyIntegrationWave({
        ...value.input,
        baseSha: conflictingBase,
        selectionFileSha256: selectionFileSha256(selectionContent),
        selectionPayloadSha256: selection.selectionPayloadSha256,
      }),
    ).toThrow(new RegExp(`S01-T01.*${value.lanes[0]?.commits[0]}`));
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
  });

  it("rejects evidence digest drift before mutating that task", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    write(
      resolve(
        value.evidenceDirectory,
        "lane-results/S01-T01/ci-proof-packet.json",
      ),
      "{}\n",
    );
    expect(() => applyIntegrationWave(value.input)).toThrow(
      /proof.*digest|digest.*proof/,
    );
    expect(git(value.workdir, "rev-parse", "HEAD")).toBe(value.baseSha);
  });

  it("accepts stable allowlisted generated output and commits it", () => {
    const value = makeFixture({
      generated: true,
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    const result = applyIntegrationWave(value.input);
    expect(result.generatedFiles).toEqual([
      "packages/template-core/src/generated/confectManifest.ts",
    ]);
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
  });

  it("rejects a generator that commits outside the allowlist", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    let generated = false;
    const hooks: ApplyIntegrationWaveHooks = {
      ...(value.input.hooks as ApplyIntegrationWaveHooks),
      run: (args, cwd) => {
        if (args.join(" ") === "pnpm confect:codegen" && !generated) {
          generated = true;
          write(
            resolve(cwd, "hand-authored.ts"),
            "export const attack = true;\n",
          );
          git(cwd, "add", "hand-authored.ts");
          git(cwd, "commit", "-qm", "test: generator attack");
        }
        return "";
      },
    };
    expect(() => applyIntegrationWave({ ...value.input, hooks })).toThrow(
      /generator.*HEAD|HEAD.*generator/,
    );
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
    expect(existsSync(resolve(value.workdir, "hand-authored.ts"))).toBe(false);
  });

  it("rejects an unrelated generated-only commit during recovery", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    git(value.workdir, "cherry-pick", value.lanes[0]?.headSha as string);
    write(
      resolve(
        value.workdir,
        "packages/template-core/src/generated/confectManifest.ts",
      ),
      "export const forged = true;\n",
    );
    git(value.workdir, "add", ".");
    git(value.workdir, "commit", "-qm", "test: forged generated output");
    expect(() =>
      applyIntegrationWave({ ...value.input, mode: "recover" }),
    ).toThrow(/unrelated|unrecorded/);
  });

  it("cleans tracked residue when hydration fails", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    const hooks: ApplyIntegrationWaveHooks = {
      ...(value.input.hooks as ApplyIntegrationWaveHooks),
      hydrate: (_root, workdir) => {
        write(resolve(workdir, "base.txt"), "dirty\n");
        throw new Error("hydrate failed");
      },
    };
    expect(() => applyIntegrationWave({ ...value.input, hooks })).toThrow(
      "hydrate failed",
    );
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
  });

  it("cleans tracked residue when a focused check fails", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    const original = value.input.hooks as ApplyIntegrationWaveHooks;
    const hooks: ApplyIntegrationWaveHooks = {
      ...original,
      run: (args, workdir) => {
        if (args.join(" ") === "pnpm --dir packages/search typecheck") {
          write(resolve(workdir, "base.txt"), "dirty\n");
          throw new Error("focused failed");
        }
        return original.run(args, workdir);
      },
    };
    expect(() => applyIntegrationWave({ ...value.input, hooks })).toThrow(
      "focused failed",
    );
    expect(git(value.workdir, "status", "--porcelain")).toBe("");
  });

  it("rejects an invalid API mode before mutation", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    expect(() =>
      applyIntegrationWave({
        ...value.input,
        mode: "unsafe" as ApplyIntegrationWaveInput["mode"],
      }),
    ).toThrow(/mode.*integrate.*recover/);
    expect(git(value.workdir, "rev-parse", "HEAD")).toBe(value.baseSha);
  });

  it("hydrates once before generation and runs deduplicated focused checks", () => {
    const value = makeFixture();
    const result = applyIntegrationWave(value.input);
    expect(value.events).toEqual([
      "hydrate",
      "pnpm confect:codegen",
      "pnpm confect:manifest",
      "pnpm confect:codegen",
      "pnpm confect:manifest",
      "pnpm --dir packages/search typecheck",
    ]);
    expect(result.focusedChecks).toEqual([
      "rtk pnpm --dir packages/search typecheck",
    ]);
    expect(result.headSha).toBe(git(value.workdir, "rev-parse", "HEAD"));
    expect(result.conflicts).toEqual([]);
  });

  it("rejects file and payload hash swaps before mutation", () => {
    const value = makeFixture({
      laneSpecs: [{ files: ["a.ts"], taskId: "S01-T01" }],
    });
    expect(() =>
      applyIntegrationWave({
        ...value.input,
        selectionFileSha256: value.input.selectionPayloadSha256,
        selectionPayloadSha256: value.input.selectionFileSha256,
      }),
    ).toThrow(/selection file hash mismatch/);
    expect(git(value.workdir, "rev-parse", "HEAD")).toBe(value.baseSha);
  });
});
