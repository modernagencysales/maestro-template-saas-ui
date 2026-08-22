import type { RecordAdapter, SaaSRecord } from "./contract.js";

type StoredRecord = Omit<SaaSRecord, "id"> & { readonly _id: string };

const storedRecordFields = {
  _id: "string",
  workspaceId: "string",
  title: "string",
  detail: "string",
  createdAt: "number",
  updatedAt: "number",
} as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isStoredRecord = (value: unknown): value is StoredRecord =>
  isObject(value) &&
  Object.entries(storedRecordFields).every(
    ([field, type]) => typeof value[field] === type,
  );

const isSuccess = (
  value: unknown,
): value is { readonly ok: true; readonly result: unknown } =>
  isObject(value) && value.ok === true && "result" in value;

export const createHttpRecordAdapter = (
  baseUrl = "/__contracts",
): RecordAdapter => {
  const run = async (operationId: string, input: Record<string, unknown>) => {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/u, "")}/api/${operationId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceSlug: "template-demo", input }),
      },
    );
    const payload: unknown = await response.json();
    if (!response.ok || !isSuccess(payload)) {
      throw new Error("Records request failed.");
    }
    return payload.result;
  };

  const record = (value: unknown): SaaSRecord => {
    if (!isStoredRecord(value)) {
      throw new Error("Records response was invalid.");
    }
    return {
      id: value._id,
      workspaceId: value.workspaceId,
      title: value.title,
      detail: value.detail,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
  };

  return {
    list: async () => {
      const result = await run("records.list", {});
      if (!Array.isArray(result))
        throw new Error("Records response was invalid.");
      return result.map(record);
    },
    read: async (_workspaceId, recordId) =>
      record(await run("records.read", { recordId })),
    create: async ({ title, detail }) =>
      record(await run("records.create", { title, detail })),
  };
};
