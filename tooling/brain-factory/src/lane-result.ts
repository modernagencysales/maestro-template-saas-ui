type JsonRecord = Record<string, unknown>;

const exactSha = (value: unknown, length: 40 | 64): boolean =>
  typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);

interface FinalLaneResultExpectation {
  readonly currentHeadSha: string;
  readonly taskId: string;
}

export const validateFinalLaneResult = (
  lane: JsonRecord,
  expected: FinalLaneResultExpectation,
): void => {
  if (lane.schemaVersion !== "maestro-brain-lane-result/v1") {
    throw new Error(`${expected.taskId}: lane result schemaVersion is invalid`);
  }
  if (lane.taskId !== expected.taskId) {
    throw new Error(`${expected.taskId}: lane result taskId does not match`);
  }
  if (lane.status !== "lane_green") {
    throw new Error(`${expected.taskId}: lane result status is not lane_green`);
  }
  if (lane.headSha !== expected.currentHeadSha) {
    throw new Error(
      `${expected.taskId}: lane result headSha does not match current HEAD`,
    );
  }
  if (lane.reproof !== undefined) {
    if (
      typeof lane.reproof !== "object" ||
      lane.reproof === null ||
      Array.isArray(lane.reproof)
    ) {
      throw new Error(`${expected.taskId}: reproof lineage is invalid`);
    }
    const reproof = lane.reproof as JsonRecord;
    if (
      typeof reproof.requestPath !== "string" ||
      !reproof.requestPath ||
      !exactSha(reproof.requestSha256, 64) ||
      !exactSha(reproof.priorIntegrationHeadSha, 40) ||
      typeof reproof.priorIntegrationId !== "string" ||
      !reproof.priorIntegrationId
    ) {
      throw new Error(`${expected.taskId}: reproof lineage is incomplete`);
    }
  }
};
