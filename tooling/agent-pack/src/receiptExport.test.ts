import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
} from "./contracts.js";
import {
  createVerificationReceiptExportCommand,
  type VerificationReceiptWriter,
} from "./receiptExport.js";
import { createRepositoryContext } from "./repoContext.js";

const fingerprint = `preflight_sha256:${"a".repeat(64)}`;
const changedFingerprint = `preflight_sha256:${"b".repeat(64)}`;
const context = {
  schemaVersion: 1 as const,
  invocation: "cli" as const,
  repo: createRepositoryContext({ cwd: "/fixture" }),
};
const receipt = {
  schemaVersion: 1 as const,
  createdAt: "2026-07-25T12:00:00.000Z",
  command: { id: "verify", version: 1 as const },
  subject: { commit: "abc1234", dirty: false },
  fingerprints: {
    repository: "repository_sha256:fixture" as const,
    environment: "environment_sha256:fixture" as const,
    providerPosture: "providers_sha256:fixture" as const,
  },
  scope: {
    kind: "full" as const,
    changedPaths: [] as const,
    partial: false as const,
  },
  gates: [],
};

function dependencies(options: { readonly changeAfterVerify?: boolean } = {}) {
  let preflightCalls = 0;
  const persist = vi.fn<VerificationReceiptWriter["persist"]>(
    async () => undefined,
  );
  const preflight = defineAgentPackCommand({
    id: "preflight",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (input: unknown) => ({ ok: true as const, args: input }),
    mutationPosture: () => "read-only" as const,
    execute: async () => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: "Preflight passed.",
      diagnostics: [],
      data: {
        fingerprint:
          options.changeAfterVerify && preflightCalls++ > 0
            ? changedFingerprint
            : fingerprint,
        safeToMutate: true,
        worksNow: "ready",
        demoOnly: "sample",
        nextAction: "pnpm maestro -- check",
        facts: {},
      },
    }),
  });
  const verify = defineAgentPackCommand({
    id: "verify",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: (input: unknown) => ({ ok: true as const, args: input }),
    mutationPosture: () => "read-only" as const,
    execute: async () => ({
      mutationPosture: "read-only" as const,
      exitClass: "success" as const,
      summary: "Verification passed.",
      diagnostics: [],
      data: { receipt, summary: { status: "pass" }, requiredBlocking: false },
    }),
  });
  return { preflight, verify, receiptWriter: { persist }, persist };
}

describe("verification receipt export command", () => {
  it("previews the receipt and required fingerprint without persisting", async () => {
    const input = dependencies();
    const result = await executeAgentPackCommand(
      createVerificationReceiptExportCommand(input),
      { scope: "full", changed: [], write: false },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "preview",
      exitClass: "success",
      data: { receipt, requiredFingerprint: fingerprint, persisted: false },
    });
    expect(input.persist).not.toHaveBeenCalled();
  });

  it("persists only after explicit write with the unchanged fingerprint", async () => {
    const input = dependencies();
    const result = await executeAgentPackCommand(
      createVerificationReceiptExportCommand(input),
      { scope: "full", changed: [], write: true, fingerprint },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "success",
      data: { persisted: true, requiredFingerprint: fingerprint },
    });
    expect(input.persist).toHaveBeenCalledWith(context.repo, receipt);
  });

  it.each([
    ["missing", undefined],
    ["mismatched", changedFingerprint],
  ])("refuses a %s write fingerprint", async (_case, supplied) => {
    const input = dependencies();
    const result = await executeAgentPackCommand(
      createVerificationReceiptExportCommand(input),
      {
        scope: "full",
        changed: [],
        write: true,
        ...(supplied === undefined ? {} : { fingerprint: supplied }),
      },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: supplied === undefined ? "read-only" : "write",
      exitClass:
        supplied === undefined ? "invalidInvocation" : "blockedMutation",
    });
    expect(input.persist).not.toHaveBeenCalled();
  });

  it("refuses persistence when readiness changes during verification", async () => {
    const input = dependencies({ changeAfterVerify: true });
    const result = await executeAgentPackCommand(
      createVerificationReceiptExportCommand(input),
      { scope: "full", changed: [], write: true, fingerprint },
      context,
    );

    expect(result).toMatchObject({
      exitClass: "blockedMutation",
      diagnostics: [{ code: "AGENT_PACK_RECEIPT_EXPORT_STALE_PREFLIGHT" }],
      data: { persisted: false },
    });
    expect(input.persist).not.toHaveBeenCalled();
  });

  it("redacts writer failures and changes no other state", async () => {
    const input = dependencies();
    input.persist.mockRejectedValueOnce(new Error("secret-provider-value"));
    const result = await executeAgentPackCommand(
      createVerificationReceiptExportCommand(input),
      { scope: "full", changed: [], write: true, fingerprint },
      context,
    );

    expect(result).toMatchObject({
      mutationPosture: "write",
      exitClass: "unavailableDependency",
      diagnostics: [{ code: "AGENT_PACK_RECEIPT_EXPORT_UNAVAILABLE" }],
      data: { persisted: false },
    });
    expect(JSON.stringify(result)).not.toContain("secret-provider-value");
  });
});
