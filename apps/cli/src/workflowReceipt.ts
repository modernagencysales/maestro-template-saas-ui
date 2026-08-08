import type { WorkflowRunReceipt } from "@maestro-template/template-core";
import type { CliNamedArgs } from "./namedArgs";

type WorkflowReceipt = WorkflowRunReceipt;

const applyStringArg = (
  payload: Record<string, unknown>,
  key: string,
  value: string | undefined,
): void => {
  if (value !== undefined) {
    payload[key] = value;
  }
};

const applyInputArg = (
  payload: Record<string, unknown>,
  input: Record<string, unknown> | undefined,
): void => {
  if (input !== undefined) {
    payload.input = input;
  }
};

const resolveReceiptIds = (
  receipt: WorkflowReceipt,
  trimmedKey: string | undefined,
): {
  readonly workflowRunId: string;
  readonly trustReceiptId: string;
} => {
  return trimmedKey
    ? {
        workflowRunId: `run_${trimmedKey}`,
        trustReceiptId: `trust_run_${trimmedKey}`,
      }
    : {
        workflowRunId: receipt.workflowRunId,
        trustReceiptId: receipt.trustReceiptId,
      };
};

const applyIdempotency = (
  payload: Record<string, unknown>,
  receipt: WorkflowReceipt,
  idempotencyKey: string | undefined,
): void => {
  const trimmedKey = idempotencyKey?.trim();
  if (!trimmedKey) {
    return;
  }

  const ids = resolveReceiptIds(receipt, trimmedKey);
  payload.idempotencyKey = idempotencyKey;
  payload.runId = ids.workflowRunId;
  payload.workflowRunId = ids.workflowRunId;
  payload.trustReceiptId = ids.trustReceiptId;
  payload.trustReceipt = {
    ...receipt.trustReceipt,
    receiptId: ids.trustReceiptId,
    workflowRunId: ids.workflowRunId,
  };
};

export const buildWorkflowPayloadForCli = (
  receipt: WorkflowReceipt,
  args: CliNamedArgs,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...receipt,
  };

  applyStringArg(payload, "workflowId", args.workflowId);
  applyStringArg(payload, "workspaceSlug", args.workspaceSlug);
  applyStringArg(payload, "mode", args.mode);
  applyInputArg(payload, args.input);
  applyIdempotency(payload, receipt, args.idempotencyKey);

  return payload;
};
