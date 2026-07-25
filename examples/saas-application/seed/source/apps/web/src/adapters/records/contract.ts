export const recordOperationContract = [
  {
    operationId: "records.list",
    kind: "query",
    surfaces: ["web", "api", "cli"],
    idempotent: true,
  },
  {
    operationId: "records.read",
    kind: "query",
    surfaces: ["web", "api", "cli"],
    idempotent: true,
  },
  {
    operationId: "records.create",
    kind: "mutation",
    surfaces: ["web", "api", "cli"],
    idempotent: false,
  },
] as const;

export type SaaSRecord = {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type CreateRecordInput = {
  readonly workspaceId: string;
  readonly title: string;
  readonly detail: string;
};

export type RecordAdapter = {
  readonly list: (workspaceId: string) => Promise<readonly SaaSRecord[]>;
  readonly read: (
    workspaceId: string,
    recordId: string,
  ) => Promise<SaaSRecord | null>;
  readonly create: (input: CreateRecordInput) => Promise<SaaSRecord>;
};
