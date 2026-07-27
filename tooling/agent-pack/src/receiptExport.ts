import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  executeAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackCommand,
  type AgentPackDiagnostic,
  type AgentPackJsonValue,
} from "./contracts.js";
import type { PreflightInput } from "./preflight.js";
import type { VerificationReceipt } from "./receipt.js";
import type { RepositoryContext } from "./repoContext.js";
import { decodeVerifyInput, type VerifyInput } from "./verify.js";

export type VerificationReceiptWriter = {
  readonly persist: (
    repo: RepositoryContext,
    receipt: VerificationReceipt,
  ) => Promise<void>;
};

export type VerificationReceiptExportInput = VerifyInput & {
  readonly write: boolean;
  readonly fingerprint?: string;
};

type PreflightProjection = {
  readonly fingerprint: string;
  readonly safeToMutate: boolean;
  readonly worksNow: string;
  readonly demoOnly: string;
  readonly nextAction: string;
  readonly facts: AgentPackJsonValue;
};

type VerifyProjection = {
  readonly receipt: VerificationReceipt;
  readonly summary: AgentPackJsonValue;
  readonly requiredBlocking: boolean;
};

const FINGERPRINT = /^preflight_sha256:[a-f0-9]{64}$/;

export function createVerificationReceiptExportCommand(input: {
  readonly preflight: AgentPackCommand<
    "preflight",
    PreflightInput,
    PreflightProjection
  >;
  readonly verify: AgentPackCommand<"verify", VerifyInput, VerifyProjection>;
  readonly receiptWriter: VerificationReceiptWriter;
}) {
  return defineAgentPackCommand({
    id: "verify-export",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeReceiptExportInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: async (args, context) => {
      const mutationPosture = args.write
        ? ("write" as const)
        : ("preview" as const);
      const before = await executeAgentPackCommand(
        input.preflight,
        { mode: "fake" },
        context,
      );
      if (before.data === null) {
        return exportUnavailable(
          mutationPosture,
          before.diagnostics,
          "Receipt export could not establish a preflight fingerprint.",
        );
      }
      if (!before.data.safeToMutate) {
        return blocked(
          mutationPosture,
          before.data.fingerprint,
          before.diagnostics,
          "AGENT_PACK_RECEIPT_EXPORT_PREFLIGHT_BLOCKED",
          "Preflight does not permit a target-local receipt write.",
        );
      }
      if (args.write && args.fingerprint !== before.data.fingerprint) {
        return blocked(
          mutationPosture,
          before.data.fingerprint,
          [],
          "AGENT_PACK_RECEIPT_EXPORT_STALE_PREFLIGHT",
          "The supplied preflight fingerprint is stale.",
        );
      }

      const verification = await executeAgentPackCommand(
        input.verify,
        { scope: args.scope, changed: args.changed },
        context,
      );
      if (verification.data === null) {
        return exportUnavailable(
          mutationPosture,
          verification.diagnostics,
          "Verification did not return a receipt projection.",
        );
      }

      if (!args.write) {
        const diagnostics = mergeDiagnostics(
          before.diagnostics,
          verification.diagnostics,
        );
        return {
          mutationPosture,
          exitClass:
            diagnostics.length === 0
              ? ("success" as const)
              : ("findings" as const),
          summary: "Verification receipt export preview is ready.",
          diagnostics,
          data: {
            receipt: verification.data.receipt,
            requiredFingerprint: before.data.fingerprint,
            persisted: false,
          },
        };
      }

      const after = await executeAgentPackCommand(
        input.preflight,
        { mode: "fake" },
        context,
      );
      if (
        after.data === null ||
        !after.data.safeToMutate ||
        after.data.fingerprint !== before.data.fingerprint
      ) {
        return blocked(
          mutationPosture,
          before.data.fingerprint,
          after.diagnostics,
          "AGENT_PACK_RECEIPT_EXPORT_STALE_PREFLIGHT",
          "Preflight readiness changed while verification was running.",
          verification.data.receipt,
        );
      }
      try {
        await input.receiptWriter.persist(
          context.repo,
          verification.data.receipt,
        );
      } catch {
        return exportUnavailable(
          mutationPosture,
          [
            ...mergeDiagnostics(
              before.diagnostics,
              after.diagnostics,
              verification.diagnostics,
            ),
            diagnostic(
              "AGENT_PACK_RECEIPT_EXPORT_UNAVAILABLE",
              "The receipt could not be persisted safely.",
            ),
          ],
          "Verification completed, but receipt export was unavailable.",
          verification.data.receipt,
          before.data.fingerprint,
        );
      }
      const diagnostics = mergeDiagnostics(
        before.diagnostics,
        after.diagnostics,
        verification.diagnostics,
      );
      return {
        mutationPosture,
        exitClass:
          diagnostics.length === 0
            ? ("success" as const)
            : ("findings" as const),
        summary: "Verification receipt was exported explicitly.",
        diagnostics,
        data: {
          receipt: verification.data.receipt,
          requiredFingerprint: before.data.fingerprint,
          persisted: true,
        },
      };
    },
  });
}

function decodeReceiptExportInput(
  value: unknown,
): AgentPackArgumentResult<VerificationReceiptExportInput> {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) =>
      ["scope", "changed", "write", "fingerprint"].includes(key),
    )
  )
    return invalid();
  if (typeof value.write !== "boolean") return invalid();
  if (
    value.fingerprint !== undefined &&
    (typeof value.fingerprint !== "string" ||
      !FINGERPRINT.test(value.fingerprint))
  )
    return invalid();
  if (value.write && value.fingerprint === undefined) return invalid();
  if (!value.write && value.fingerprint !== undefined) return invalid();
  const decoded = decodeVerifyInput({
    scope: value.scope,
    changed: value.changed,
  });
  return decoded.ok
    ? {
        ok: true,
        args: {
          ...decoded.args,
          write: value.write,
          ...(value.fingerprint === undefined
            ? {}
            : { fingerprint: value.fingerprint }),
        },
      }
    : invalid();
}

function invalid(): AgentPackArgumentResult<VerificationReceiptExportInput> {
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "AGENT_PACK_RECEIPT_EXPORT_INVALID",
        "Receipt export requires a scope and explicit write fingerprint.",
      ),
    ],
  };
}

function blocked(
  mutationPosture: "preview" | "write",
  requiredFingerprint: string,
  diagnostics: readonly AgentPackDiagnostic[],
  code: string,
  message: string,
  receipt: VerificationReceipt | null = null,
) {
  return {
    mutationPosture,
    exitClass: "blockedMutation" as const,
    summary: "Verification receipt export was blocked before persistence.",
    diagnostics: [...diagnostics, diagnostic(code, message)],
    data: { receipt, requiredFingerprint, persisted: false },
  };
}

function exportUnavailable(
  mutationPosture: "preview" | "write",
  diagnostics: readonly AgentPackDiagnostic[],
  summary: string,
  receipt: VerificationReceipt | null = null,
  requiredFingerprint: string | null = null,
) {
  const projected = diagnostics.some(({ severity }) => severity === "error")
    ? diagnostics
    : [
        ...diagnostics,
        diagnostic(
          "AGENT_PACK_RECEIPT_EXPORT_UNAVAILABLE",
          "Receipt export prerequisites were unavailable.",
        ),
      ];
  return {
    mutationPosture,
    exitClass: "unavailableDependency" as const,
    summary,
    diagnostics: projected,
    data: { receipt, requiredFingerprint, persisted: false },
  };
}

function diagnostic(code: string, message: string): AgentPackDiagnostic {
  return {
    code,
    severity: "error",
    message,
    safeToContinue: false,
    nextAction:
      "Rerun preview, review the receipt, then use its exact fingerprint.",
    rerun: "pnpm maestro -- verify-export --scope focused --json",
  };
}

function mergeDiagnostics(
  ...groups: readonly (readonly AgentPackDiagnostic[])[]
): readonly AgentPackDiagnostic[] {
  const diagnostics = new Map<string, AgentPackDiagnostic>();
  for (const entry of groups.flat()) {
    diagnostics.set(`${entry.code}\0${entry.message}`, entry);
  }
  return [...diagnostics.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
