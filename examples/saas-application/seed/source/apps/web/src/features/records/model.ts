import type { SaaSRecord } from "../../adapters/records/contract.js";

export type RecordsState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "list"; readonly records: readonly SaaSRecord[] }
  | { readonly status: "detail"; readonly record: SaaSRecord }
  | { readonly status: "create" };

export type RecordsView = {
  readonly status: RecordsState["status"];
  readonly heading: string;
  readonly message: string;
  readonly records: readonly SaaSRecord[];
  readonly selected: SaaSRecord | null;
  readonly canCreate: boolean;
};

export const presentRecords = (state: RecordsState): RecordsView => {
  const base = {
    status: state.status,
    records: [] as readonly SaaSRecord[],
    selected: null as SaaSRecord | null,
    canCreate: true,
  };
  switch (state.status) {
    case "loading":
      return {
        ...base,
        heading: "Records",
        message: "Loading records…",
        canCreate: false,
      };
    case "empty":
      return {
        ...base,
        heading: "No records yet",
        message: "Create the first record.",
      };
    case "error":
      return {
        ...base,
        heading: "Records unavailable",
        message: state.message,
      };
    case "list":
      return {
        ...base,
        heading: "Records",
        message: `${state.records.length} records`,
        records: state.records,
      };
    case "detail":
      return {
        ...base,
        heading: state.record.title,
        message: state.record.detail,
        selected: state.record,
      };
    case "create":
      return {
        ...base,
        heading: "Create record",
        message: "Add a workspace record.",
      };
  }
};
