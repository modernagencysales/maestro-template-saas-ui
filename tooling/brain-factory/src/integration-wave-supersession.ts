import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  fabroRunId,
  gitSha,
  safeAbsolutePath,
} from "./integration-recovery.js";
import {
  type IntegrationWaveSelection,
  integrationWaveId,
  readIntegrationWaveSelection,
} from "./integration-wave.js";
import { verifyWaveRunInspection } from "./integration-wave-launch.js";
import {
  record,
  string,
  type JsonRecord,
} from "./integration-check-support.js";

export const INTEGRATION_WAVE_SUPERSESSION_SCHEMA =
  "maestro-brain-integration-wave-supersession/v2" as const;

export type SupersededWaveRunStatus = "cancelled" | "failed";

export interface SupersededWaveRunAttempt {
  readonly attempt: number;
  readonly runId: string;
  readonly status: SupersededWaveRunStatus;
}

export interface IntegrationWaveSupersessionReceipt {
  readonly baseSha: string;
  readonly controlHeadSha: string;
  readonly createdAt: string;
  readonly evidence: readonly string[];
  readonly integrationId: string;
  readonly planSha256: string;
  readonly reason: string;
  readonly receiptSha256: string;
  readonly runAttempts: readonly SupersededWaveRunAttempt[];
  readonly runRecordSha256: string;
  readonly schemaVersion: typeof INTEGRATION_WAVE_SUPERSESSION_SCHEMA;
  readonly selectedTaskIds: readonly string[];
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
  readonly status: "superseded";
}

interface SupersessionSource {
  readonly baseSha: string;
  readonly integrationId: string;
  readonly planSha256: string;
  readonly record: JsonRecord;
  readonly runIds: readonly string[];
  readonly runRecordSha256: string;
  readonly selectedTaskIds: readonly string[];
  readonly selection: IntegrationWaveSelection;
  readonly selectionFileSha256: string;
  readonly selectionPayloadSha256: string;
  readonly legacy: boolean;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const digest = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
  return parsed;
};

const waveId = (value: unknown, label: string): string => {
  const parsed = string(value, label);
  if (!/^wave-\d{6}$/.test(parsed)) throw new Error(`${label} is invalid`);
  return parsed;
};

const normalizedText = (value: unknown, label: string): string => {
  const parsed = string(value, label).trim();
  if (parsed.length < 8) throw new Error(`${label} is too short`);
  return parsed;
};

const normalizedEvidence = (value: readonly string[]): readonly string[] => {
  const evidence = [
    ...new Set(
      value.map((item) => normalizedText(item, "supersession evidence")),
    ),
  ].sort();
  if (evidence.length === 0) {
    throw new Error("supersession evidence must contain at least one item");
  }
  return evidence;
};

const timestamp = (value: unknown): string => {
  const parsed = string(value, "supersession createdAt");
  if (new Date(parsed).toISOString() !== parsed) {
    throw new Error("supersession createdAt must be an ISO timestamp");
  }
  return parsed;
};

const stringArray = (value: unknown, label: string): readonly string[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
};

const sourceFromContents = (input: {
  readonly expectedIntegrationId: string;
  readonly runRecordContent: string;
  readonly selectionContent: string;
  readonly selectionPath: string;
}): SupersessionSource => {
  const expectedIntegrationId = waveId(
    input.expectedIntegrationId,
    "expected integration ID",
  );
  const recordValue = JSON.parse(input.runRecordContent) as unknown;
  const runRecord = record(recordValue, `${expectedIntegrationId}: run record`);
  const selectionRead = readIntegrationWaveSelection(input.selectionContent);
  const { selection } = selectionRead;
  const legacyRun =
    runRecord.schemaVersion === "maestro-brain-integration-wave-run/v2" &&
    selectionRead.legacy &&
    digest(runRecord.selectionSha256, "run record selection payload hash") ===
      selectionRead.selectionPayloadSha256;
  const currentRun =
    runRecord.schemaVersion === "maestro-brain-integration-wave-run/v3" &&
    !selectionRead.legacy &&
    !Object.hasOwn(runRecord, "selectionSha256") &&
    !Object.hasOwn(runRecord, "selection_sha256") &&
    digest(
      runRecord.selectionPayloadSha256,
      "run record selection payload hash",
    ) === selectionRead.selectionPayloadSha256 &&
    digest(runRecord.selectionFileSha256, "run record selection file hash") ===
      selectionRead.selectionFileSha256;
  if (
    (!legacyRun && !currentRun) ||
    runRecord.status !== "launched" ||
    waveId(runRecord.integrationId, "run record integration ID") !==
      expectedIntegrationId ||
    selection.integrationId !== expectedIntegrationId ||
    gitSha(runRecord.baseSha, "run record base SHA") !== selection.baseSha ||
    JSON.stringify(runRecord.selection) !== JSON.stringify(selection) ||
    safeAbsolutePath(runRecord.selectionPath, "run record selection path") !==
      safeAbsolutePath(input.selectionPath, "selection path")
  ) {
    throw new Error(
      `${expectedIntegrationId}: run/selection identity mismatch`,
    );
  }
  const runIds = stringArray(runRecord.runIds, "wave run IDs").map(
    (runId, index) => fabroRunId(runId, `wave run ${index + 1} ID`),
  );
  if (
    runIds.length === 0 ||
    new Set(runIds).size !== runIds.length ||
    Number(runRecord.attempt) !== runIds.length ||
    fabroRunId(runRecord.runId, "current wave run ID") !== runIds.at(-1)
  ) {
    throw new Error(
      `${expectedIntegrationId}: durable wave attempts are invalid`,
    );
  }
  return {
    baseSha: selection.baseSha,
    integrationId: expectedIntegrationId,
    planSha256: digest(selection.planSha256, "selection plan hash"),
    record: runRecord,
    runIds,
    runRecordSha256: sha256(input.runRecordContent),
    selectedTaskIds: selection.selectedTasks.map((task) => task.taskId),
    selection,
    selectionFileSha256: selectionRead.selectionFileSha256,
    selectionPayloadSha256: selectionRead.selectionPayloadSha256,
    legacy: selectionRead.legacy,
  };
};

const statusFromInspection = (value: unknown): string => {
  const items = Array.isArray(value) ? value : [value];
  if (items.length !== 1) {
    throw new Error("wave run inspection must contain one run");
  }
  const run = record(items[0], "wave run");
  return typeof run.status === "string"
    ? run.status
    : string(
        record(run.status, "wave run status").kind,
        "wave run status kind",
      );
};

const verifyCurrentWaveRunInspection = (
  value: unknown,
  expected: {
    readonly attempt: number;
    readonly baseSha: string;
    readonly integrationId: string;
    readonly mode: "integrate" | "recover";
    readonly reservationToken: string;
    readonly runId: string;
    readonly selectionFileSha256: string;
    readonly selectionPath: string;
    readonly selectionPayloadSha256: string;
    readonly workdir: string;
  },
): void => {
  const items = Array.isArray(value) ? value : [value];
  if (items.length !== 1) {
    throw new Error("wave run inspection must contain one run");
  }
  const run = record(items[0], "wave run");
  const runSpec = record(run.run_spec, "wave run spec");
  const settings = record(runSpec.settings, "wave run settings");
  const configuration = record(settings.run, "wave run configuration");
  const inputs = record(configuration.inputs, "wave run inputs");
  const metadata = record(
    configuration.metadata ?? runSpec.labels ?? run.labels,
    "wave run metadata",
  );
  if (
    fabroRunId(run.run_id, "wave run ID") !== expected.runId ||
    Number(inputs.attempt) !== expected.attempt ||
    gitSha(inputs.base_sha, "wave run base") !== expected.baseSha ||
    string(inputs.integration_id, "wave integration ID") !==
      expected.integrationId ||
    string(inputs.mode, "wave run mode") !== expected.mode ||
    safeAbsolutePath(inputs.selection_path, "wave selection path") !==
      expected.selectionPath ||
    Object.hasOwn(inputs, "selection_sha256") ||
    Object.hasOwn(inputs, "selectionSha256") ||
    digest(inputs.selection_payload_sha256, "wave selection payload hash") !==
      expected.selectionPayloadSha256 ||
    digest(inputs.selection_file_sha256, "wave selection file hash") !==
      expected.selectionFileSha256 ||
    string(inputs.reservation_token, "wave reservation token") !==
      expected.reservationToken ||
    safeAbsolutePath(inputs.workdir, "wave workdir") !== expected.workdir ||
    metadata.integration !== expected.integrationId ||
    metadata["integration-mode"] !== "wave-v3" ||
    metadata.reservation !== expected.reservationToken ||
    Number(metadata.attempt) !== expected.attempt
  ) {
    throw new Error("wave run inspection identity mismatch");
  }
};

const terminalStatus = (
  value: unknown,
  label: string,
): SupersededWaveRunStatus => {
  const parsed = string(value, label);
  if (parsed !== "failed" && parsed !== "cancelled") {
    throw new Error(`${label} is not terminal failed/cancelled (${parsed})`);
  }
  return parsed;
};

const normalizedRunAttempts = (
  value: readonly SupersededWaveRunAttempt[],
  source: SupersessionSource,
): readonly SupersededWaveRunAttempt[] => {
  if (value.length !== source.runIds.length) {
    throw new Error(
      `${source.integrationId}: supersession attempt count mismatch`,
    );
  }
  return value.map((attempt, index) => {
    const expectedAttempt = index + 1;
    const runId = fabroRunId(
      attempt.runId,
      `supersession run ${expectedAttempt}`,
    );
    if (attempt.attempt !== expectedAttempt || runId !== source.runIds[index]) {
      throw new Error(
        `${source.integrationId}: supersession run identity mismatch`,
      );
    }
    return {
      attempt: expectedAttempt,
      runId,
      status: terminalStatus(
        attempt.status,
        `supersession run ${expectedAttempt} status`,
      ),
    };
  });
};

const receiptPayload = (input: {
  readonly controlHeadSha: string;
  readonly createdAt: string;
  readonly evidence: readonly string[];
  readonly reason: string;
  readonly runAttempts: readonly SupersededWaveRunAttempt[];
  readonly source: SupersessionSource;
}) => ({
  baseSha: input.source.baseSha,
  controlHeadSha: gitSha(input.controlHeadSha, "supersession control HEAD"),
  createdAt: timestamp(input.createdAt),
  evidence: normalizedEvidence(input.evidence),
  integrationId: input.source.integrationId,
  planSha256: input.source.planSha256,
  reason: normalizedText(input.reason, "supersession reason"),
  runAttempts: normalizedRunAttempts(input.runAttempts, input.source),
  runRecordSha256: input.source.runRecordSha256,
  schemaVersion: INTEGRATION_WAVE_SUPERSESSION_SCHEMA,
  selectedTaskIds: input.source.selectedTaskIds,
  selectionFileSha256: input.source.selectionFileSha256,
  selectionPayloadSha256: input.source.selectionPayloadSha256,
  status: "superseded" as const,
});

export const buildIntegrationWaveSupersessionReceipt = (input: {
  readonly controlHeadSha: string;
  readonly createdAt: string;
  readonly evidence: readonly string[];
  readonly expectedIntegrationId: string;
  readonly reason: string;
  readonly runInspections: readonly unknown[];
  readonly runRecordContent: string;
  readonly selectionContent: string;
  readonly selectionPath: string;
}): IntegrationWaveSupersessionReceipt => {
  const source = sourceFromContents(input);
  if (input.runInspections.length !== source.runIds.length) {
    throw new Error(`${source.integrationId}: Fabro inspection count mismatch`);
  }
  const runAttempts = input.runInspections.map((inspection, index) => {
    const attempt = index + 1;
    const runId = source.runIds[index];
    if (!runId)
      throw new Error(`${source.integrationId}: missing run ${attempt}`);
    const expected = {
      attempt,
      baseSha: source.baseSha,
      integrationId: source.integrationId,
      mode: attempt === 1 ? ("integrate" as const) : ("recover" as const),
      reservationToken: string(
        source.record.reservationToken,
        "wave reservation token",
      ),
      runId,
      selectionPath: safeAbsolutePath(
        source.record.selectionPath,
        "wave selection path",
      ),
      workdir: safeAbsolutePath(source.record.workdir, "wave workdir"),
    };
    if (source.legacy) {
      verifyWaveRunInspection(inspection, {
        ...expected,
        selectionSha256: source.selectionPayloadSha256,
      });
    } else {
      verifyCurrentWaveRunInspection(inspection, {
        ...expected,
        selectionFileSha256: source.selectionFileSha256,
        selectionPayloadSha256: source.selectionPayloadSha256,
      });
    }
    return {
      attempt,
      runId,
      status: terminalStatus(
        statusFromInspection(inspection),
        `wave run ${runId} status`,
      ),
    };
  });
  const payload = receiptPayload({ ...input, runAttempts, source });
  return { ...payload, receiptSha256: sha256(JSON.stringify(payload)) };
};

export const validateIntegrationWaveSupersessionReceipt = (input: {
  readonly currentControlHead: string;
  readonly expectedIntegrationId: string;
  readonly isAncestor: (ancestor: string, descendant: string) => boolean;
  readonly receipt: unknown;
  readonly runRecordContent: string;
  readonly selectionContent: string;
  readonly selectionPath: string;
}): IntegrationWaveSupersessionReceipt => {
  const source = sourceFromContents(input);
  const receipt = record(
    input.receipt,
    `${source.integrationId}: supersession receipt`,
  );
  const runAttemptsValue = receipt.runAttempts;
  if (!Array.isArray(runAttemptsValue)) {
    throw new Error(
      `${source.integrationId}: supersession runAttempts must be an array`,
    );
  }
  const runAttempts = runAttemptsValue.map((value, index) => {
    const attempt = record(value, `supersession run ${index + 1}`);
    return {
      attempt: Number(attempt.attempt),
      runId: string(attempt.runId, `supersession run ${index + 1} ID`),
      status: string(
        attempt.status,
        `supersession run ${index + 1} status`,
      ) as SupersededWaveRunStatus,
    };
  });
  const evidence = stringArray(receipt.evidence, "supersession evidence");
  const payload = receiptPayload({
    controlHeadSha: string(receipt.controlHeadSha, "supersession control HEAD"),
    createdAt: string(receipt.createdAt, "supersession createdAt"),
    evidence,
    reason: string(receipt.reason, "supersession reason"),
    runAttempts,
    source,
  });
  const expected = {
    ...payload,
    receiptSha256: sha256(JSON.stringify(payload)),
  } satisfies IntegrationWaveSupersessionReceipt;
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
    throw new Error(
      `${source.integrationId}: supersession identity or digest mismatch`,
    );
  }
  const currentControlHead = gitSha(
    input.currentControlHead,
    "current control HEAD",
  );
  if (!input.isAncestor(expected.controlHeadSha, currentControlHead)) {
    throw new Error(
      `${source.integrationId}: supersession receipt is not on control HEAD`,
    );
  }
  return expected;
};

export const materializeImmutableWaveSupersession = (
  path: string,
  receipt: IntegrationWaveSupersessionReceipt,
): void => {
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== content) {
      throw new Error(
        "immutable wave supersession receipt conflicts with existing receipt",
      );
    }
    return;
  }
  writeFileSync(path, content, { flag: "wx" });
};

export const priorIntegrationWaveResolution = (input: {
  readonly integrationId: string;
  readonly promotionExists: boolean;
  readonly supersessionExists: boolean;
  readonly validatePromotion: () => void;
  readonly validateSupersession: () => void;
}): "promoted" | "superseded" => {
  if (input.promotionExists && input.supersessionExists) {
    throw new Error(
      `${input.integrationId}: promotion and supersession both exist`,
    );
  }
  if (input.promotionExists) {
    input.validatePromotion();
    return "promoted";
  }
  if (input.supersessionExists) {
    input.validateSupersession();
    return "superseded";
  }
  throw new Error(`${input.integrationId}: unresolved global integration wave`);
};

export const nextIntegrationWaveId = (
  existingIntegrationIds: readonly string[],
): string => {
  const sequences = existingIntegrationIds.map((id) => {
    const parsed = /^wave-(\d{6})$/.exec(id);
    if (!parsed?.[1]) throw new Error(`${id}: invalid wave identity`);
    return Number(parsed[1]);
  });
  return integrationWaveId(Math.max(0, ...sequences) + 1);
};
