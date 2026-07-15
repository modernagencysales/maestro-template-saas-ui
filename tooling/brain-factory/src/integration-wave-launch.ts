import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import {
  fabroRunId,
  gitSha,
  safeAbsolutePath,
} from "./integration-recovery.js";
import {
  record,
  string,
  type JsonRecord,
} from "./integration-check-support.js";

export interface WaveRunIdentity {
  readonly attempt: number;
  readonly baseSha: string;
  readonly integrationId: string;
  readonly mode: "integrate" | "recover";
  readonly reservationToken: string;
  readonly selectionPath: string;
  readonly selectionSha256: string;
  readonly workdir: string;
}

export const promotionAction = (
  controlHead: string,
  baseSha: string,
  integrationHead: string,
): "fast-forward" | "record-after-crash" => {
  if (controlHead === baseSha) return "fast-forward";
  if (controlHead === integrationHead) return "record-after-crash";
  throw new Error(
    `control HEAD diverged from ${baseSha}; rebuild the wave and rerun full verify`,
  );
};

export const waveModeForWorktree = (
  baseSha: string,
  worktreeHead: string,
): "integrate" | "recover" =>
  baseSha === worktreeHead ? "integrate" : "recover";

export const waveWorktreeRecoveryAction = (input: {
  readonly branchExists: boolean;
  readonly worktreeExists: boolean;
}): "attach-branch" | "create-branch" | "reuse" =>
  input.worktreeExists
    ? "reuse"
    : input.branchExists
      ? "attach-branch"
      : "create-branch";

export const materializeImmutableWaveSelection = (
  path: string,
  value: unknown,
): void => {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== content) {
      throw new Error("immutable wave selection conflicts with reservation");
    }
    return;
  }
  writeFileSync(path, content, { flag: "wx" });
};

export const waveWorkflowArgs = (
  input: WaveRunIdentity & {
    readonly controlRoot: string;
    readonly evidenceDirectory: string;
    readonly workflow: string;
  },
): string[] => [
  "fabro",
  "run",
  input.workflow,
  "--detach",
  "--json",
  "--no-upgrade-check",
  "--environment",
  "local",
  "--label",
  `integration=${input.integrationId}`,
  "--label",
  "integration-mode=wave-v2",
  "--label",
  `reservation=${input.reservationToken}`,
  "--label",
  `attempt=${input.attempt}`,
  "-I",
  `workdir=${input.workdir}`,
  "-I",
  `control_root=${input.controlRoot}`,
  "-I",
  `evidence_dir=${input.evidenceDirectory}`,
  "-I",
  `integration_id=${input.integrationId}`,
  "-I",
  `base_sha=${input.baseSha}`,
  "-I",
  `attempt=${input.attempt}`,
  "-I",
  `selection_path=${input.selectionPath}`,
  "-I",
  `selection_sha256=${input.selectionSha256}`,
  "-I",
  `mode=${input.mode}`,
  "-I",
  `reservation_token=${input.reservationToken}`,
];

export const verifyWaveRunInspection = (
  value: unknown,
  expected: WaveRunIdentity & { readonly runId: string },
): void => {
  const items = Array.isArray(value) ? value : [value];
  if (items.length !== 1)
    throw new Error("wave run inspection must contain one run");
  const run = record(items[0], "wave run");
  if (fabroRunId(run.run_id, "wave run ID") !== expected.runId) {
    throw new Error("wave run ID mismatch");
  }
  const runSpec = record(run.run_spec, "wave run spec");
  const settings = record(runSpec.settings, "wave run settings");
  const configuration = record(settings.run, "wave run configuration");
  const inputs = record(configuration.inputs, "wave run inputs");
  const metadata = record(
    configuration.metadata ?? runSpec.labels ?? run.labels,
    "wave run metadata",
  );
  if (
    Number(inputs.attempt) !== expected.attempt ||
    gitSha(inputs.base_sha, "wave run base") !== expected.baseSha ||
    string(inputs.integration_id, "wave integration ID") !==
      expected.integrationId ||
    string(inputs.mode, "wave run mode") !== expected.mode ||
    safeAbsolutePath(inputs.selection_path, "wave selection path") !==
      expected.selectionPath ||
    string(inputs.selection_sha256, "wave selection hash") !==
      expected.selectionSha256 ||
    string(inputs.reservation_token, "wave reservation token") !==
      expected.reservationToken ||
    safeAbsolutePath(inputs.workdir, "wave workdir") !== expected.workdir ||
    metadata.integration !== expected.integrationId ||
    metadata["integration-mode"] !== "wave-v2" ||
    metadata.reservation !== expected.reservationToken ||
    Number(metadata.attempt) !== expected.attempt
  ) {
    throw new Error("wave run inspection identity mismatch");
  }
};

export const verifyPassedWaveRunInspection = (
  value: unknown,
  expected: WaveRunIdentity & { readonly runId: string },
): void => {
  verifyWaveRunInspection(value, expected);
  const items = Array.isArray(value) ? value : [value];
  const run = record(items[0], "wave run");
  const statusValue = run.status;
  const status =
    typeof statusValue === "string"
      ? statusValue
      : string(
          record(statusValue, "wave run status").kind,
          "wave run status kind",
        );
  if (status !== "succeeded") {
    throw new Error(`wave run ${expected.runId} is not succeeded (${status})`);
  }
};

export const replaceWaveRunRecord = (
  path: string,
  currentContent: string,
  next: JsonRecord,
): void => {
  const temporary = `${path}.next`;
  writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    flag: "wx",
  });
  try {
    const current = readFileSync(path, "utf8");
    if (current !== currentContent) throw new Error("wave run record changed");
    renameSync(temporary, path);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // Preserve the original failure when the temporary file was already moved.
    }
    throw error;
  }
};
