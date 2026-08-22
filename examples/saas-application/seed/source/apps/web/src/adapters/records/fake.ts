import type {
  CreateRecordInput,
  RecordAdapter,
  SaaSRecord,
} from "./contract.js";

export const createFakeRecordAdapter = (
  seed: readonly SaaSRecord[] = [],
): RecordAdapter => {
  let records = [...seed];
  let sequence = seed.length;

  return {
    list: async (workspaceId) =>
      records.filter((record) => record.workspaceId === workspaceId),
    read: async (workspaceId, recordId) =>
      records.find(
        (record) =>
          record.workspaceId === workspaceId && record.id === recordId,
      ) ?? null,
    create: async (input: CreateRecordInput) => {
      sequence += 1;
      const now = sequence;
      const record: SaaSRecord = {
        id: `record_${String(sequence).padStart(4, "0")}`,
        workspaceId: input.workspaceId,
        title: input.title.trim(),
        detail: input.detail.trim(),
        createdAt: now,
        updatedAt: now,
      };
      if (record.title.length === 0) {
        throw new Error("Record title is required.");
      }
      records = [...records, record];
      return record;
    },
  };
};
