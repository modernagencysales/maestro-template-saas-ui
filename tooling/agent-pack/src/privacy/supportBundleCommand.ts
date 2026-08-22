import {
  AGENT_PACK_COMMAND_VERSION,
  defineAgentPackCommand,
  type AgentPackArgumentResult,
  type AgentPackDiagnostic,
} from "../contracts.js";
import type { RepositoryContext } from "../repoContext.js";
import type { SupportBundleExporter } from "./nodeSupportBundleExporter.js";
import {
  DEFAULT_SUPPORT_BUNDLE_PATH,
  SupportBundleContractError,
  createSupportBundlePreview,
  isValidSupportBundleOutput,
} from "./supportBundle.js";
import type { SupportBundle } from "./supportBundle.js";

export const SUPPORT_BUNDLE_EXCLUSIONS = [
  "secret-values",
  "environment-values",
  "auth-and-session-state",
  "source-prompts-and-customer-data",
  "logs-and-arbitrary-files",
] as const;

export type SupportBundleCommandInput = {
  readonly output: string;
  readonly write: boolean;
};

export type SupportBundleCommandData = {
  readonly output: string;
  readonly previewFingerprint: string;
  readonly bundle: SupportBundle;
  readonly bytes: number;
  readonly write: boolean;
  readonly exclusions: typeof SUPPORT_BUNDLE_EXCLUSIONS;
  readonly exportedBytes: number | null;
};

export function createSupportBundleCommand(dependencies: {
  readonly load: (repo: RepositoryContext) => Promise<unknown>;
  readonly exporter: SupportBundleExporter;
}) {
  return defineAgentPackCommand<
    "support-bundle",
    SupportBundleCommandInput,
    SupportBundleCommandData | null
  >({
    id: "support-bundle",
    schemaVersion: AGENT_PACK_COMMAND_VERSION,
    decode: decodeSupportBundleInput,
    mutationPosture: ({ write }) => (write ? "write" : "preview"),
    execute: async (input, context) => {
      const mutationPosture = input.write
        ? ("write" as const)
        : ("preview" as const);
      let preview;
      try {
        preview = createSupportBundlePreview(
          await dependencies.load(context.repo),
          { output: input.output },
        );
      } catch (error) {
        return {
          mutationPosture,
          exitClass: "unavailableDependency" as const,
          summary: "Support bundle facts are unavailable or unsafe.",
          diagnostics: [sourceDiagnostic(error)],
          data: null,
        };
      }
      const data = {
        output: preview.output,
        previewFingerprint: preview.previewFingerprint,
        bundle: preview.bundle,
        bytes: preview.bytes,
        write: input.write,
        exclusions: SUPPORT_BUNDLE_EXCLUSIONS,
      } as const;
      if (!input.write) {
        return {
          mutationPosture,
          exitClass: "success" as const,
          summary:
            "Support bundle preview is ready; no file was written or uploaded.",
          diagnostics: [],
          data: { ...data, exportedBytes: null },
        };
      }
      try {
        const exported = await dependencies.exporter.export({
          repo: context.repo,
          output: preview.output,
          serialized: preview.serialized,
        });
        return {
          mutationPosture,
          exitClass: "success" as const,
          summary: "Support bundle was exported locally; nothing was uploaded.",
          diagnostics: [],
          data: { ...data, exportedBytes: exported.bytes },
        };
      } catch {
        return {
          mutationPosture,
          exitClass: "unavailableDependency" as const,
          summary: "Support bundle could not be exported safely.",
          diagnostics: [exportDiagnostic()],
          data: { ...data, exportedBytes: null },
        };
      }
    },
  });
}

function decodeSupportBundleInput(
  value: unknown,
): AgentPackArgumentResult<SupportBundleCommandInput> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return invalidInput();
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => ["output", "write"].includes(key))) {
    return invalidInput();
  }
  const output = record.output ?? DEFAULT_SUPPORT_BUNDLE_PATH;
  const write = record.write ?? false;
  if (!isValidSupportBundleOutput(output) || typeof write !== "boolean") {
    return invalidInput();
  }
  return {
    ok: true,
    args: {
      output,
      write,
    },
  };
}

function invalidInput(): AgentPackArgumentResult<SupportBundleCommandInput> {
  return {
    ok: false,
    diagnostics: [
      {
        code: "AGENT_PACK_SUPPORT_BUNDLE_INVALID",
        severity: "error",
        message:
          "Support bundle requires a bounded output and optional --write.",
        safeToContinue: false,
        nextAction:
          "Choose a bounded output, then use --write to export it locally.",
        rerun: "pnpm maestro -- support-bundle --json",
      },
    ],
  };
}

function sourceDiagnostic(error: unknown): AgentPackDiagnostic {
  return {
    code:
      error instanceof SupportBundleContractError
        ? error.code
        : "SUPPORT_BUNDLE_SOURCE_UNAVAILABLE",
    severity: "error",
    message: "Support bundle source facts did not match the public allowlist.",
    safeToContinue: false,
    nextAction:
      "Repair the local diagnostic projection without adding raw paths, payloads, logs, environment values, or secrets.",
    rerun: "pnpm maestro -- support-bundle --json",
  };
}

function exportDiagnostic(): AgentPackDiagnostic {
  return {
    code: "AGENT_PACK_SUPPORT_BUNDLE_EXPORT_UNAVAILABLE",
    severity: "error",
    message: "The local support bundle destination is unavailable or unsafe.",
    safeToContinue: false,
    nextAction:
      "Choose a new regular file under .maestro/support and remove any symlinked path component.",
    rerun: "pnpm maestro -- support-bundle --json",
  };
}
