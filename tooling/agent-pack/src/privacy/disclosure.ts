import type { AgentPackDiagnostic } from "../contracts.js";

export const FIRST_RUN_PRIVACY_DISCLOSURE_VERSION = 1 as const;

export type PrivacyHost = "claude-code" | "codex" | "other" | "unknown";
export type PrivacySelectedProvider =
  "convex-dev" | "model-provider" | "other-provider";

export type FirstRunPrivacyDisclosure = ReturnType<
  typeof createFirstRunPrivacyDisclosure
>;

export function createFirstRunPrivacyDisclosure(input: {
  readonly host: PrivacyHost;
  readonly selectedProviders: readonly PrivacySelectedProvider[];
  readonly privacyDocumentAvailable?: boolean;
}) {
  const selected = [...new Set(input.selectedProviders)].sort();
  return {
    schemaVersion: FIRST_RUN_PRIVACY_DISCLOSURE_VERSION,
    displayBefore: [
      "first-create",
      "mcp-opt-in",
      "external-provider-operation",
    ] as const,
    maestro: {
      productTelemetry: "none" as const,
      automaticUpload: false,
      processing: "repository-local-by-default" as const,
      evidenceRetention:
        "Local receipts remain in the repository until the user removes them.",
    },
    host: {
      kind: input.host,
      policyApplies: true,
      disclosure:
        "The selected Claude Code, Codex, or other model host may receive prompts and context under its own terms.",
    },
    convex: {
      fakeMcp: "disabled" as const,
      productionMcp: "unsupported" as const,
      devIsOffline: false,
      disclosure:
        "A selected Convex MCP or dev deployment may receive inspected or application data; dev does not mean offline or private.",
    },
    providers: {
      selected,
      explicitOptInRequired: true,
      disclosure:
        "An explicitly configured provider may receive data under its own terms only for the operation the user selected.",
    },
    support: {
      previewBeforeExport: true,
      automaticUpload: false,
    },
    privacyDocument:
      input.privacyDocumentAvailable === false
        ? null
        : ("docs/template/agent-pack-privacy.md" as const),
  };
}

export function createFirstRunPrivacyDiagnostic(
  disclosure: FirstRunPrivacyDisclosure,
  options: { readonly rerun?: string } = {},
): AgentPackDiagnostic {
  return {
    code: "AGENT_PACK_PRIVACY_FIRST_RUN",
    severity: "info",
    message:
      "Maestro sends no product telemetry; your selected host and external operations have separate data policies.",
    safeToContinue: true,
    nextAction:
      disclosure.privacyDocument === null
        ? "Review this first-run disclosure before enabling MCP, dev deployments, or external providers."
        : `Review ${disclosure.privacyDocument} before enabling MCP, dev deployments, or external providers.`,
    rerun: options.rerun ?? "pnpm maestro -- create --help",
  };
}
