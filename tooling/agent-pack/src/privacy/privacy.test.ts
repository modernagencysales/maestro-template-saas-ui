import { describe, expect, it } from "vitest";
import {
  createFirstRunPrivacyDiagnostic,
  createFirstRunPrivacyDisclosure,
} from "./disclosure.js";

describe("privacy disclosure", () => {
  it("distinguishes local Maestro behavior from selected host and provider data flows", () => {
    const disclosure = createFirstRunPrivacyDisclosure({
      host: "codex",
      selectedProviders: ["model-provider", "convex-dev", "model-provider"],
    });

    expect(disclosure).toMatchObject({
      schemaVersion: 1,
      displayBefore: [
        "first-create",
        "mcp-opt-in",
        "external-provider-operation",
      ],
      maestro: {
        productTelemetry: "none",
        automaticUpload: false,
        processing: "repository-local-by-default",
      },
      host: { kind: "codex", policyApplies: true },
      convex: {
        fakeMcp: "disabled",
        productionMcp: "unsupported",
        devIsOffline: false,
      },
      providers: {
        selected: ["convex-dev", "model-provider"],
        explicitOptInRequired: true,
      },
      privacyDocument: "docs/template/agent-pack-privacy.md",
    });
    expect(JSON.stringify(disclosure)).toContain(
      "may receive data under its own terms",
    );
  });

  it("projects the disclosure through the existing diagnostic contract", () => {
    const disclosure = createFirstRunPrivacyDisclosure({
      host: "claude-code",
      selectedProviders: [],
    });
    expect(createFirstRunPrivacyDiagnostic(disclosure)).toEqual({
      code: "AGENT_PACK_PRIVACY_FIRST_RUN",
      severity: "info",
      message:
        "Maestro sends no product telemetry; your selected host and external operations have separate data policies.",
      safeToContinue: true,
      nextAction:
        "Review docs/template/agent-pack-privacy.md before enabling MCP, dev deployments, or external providers.",
      rerun: "pnpm maestro -- create --help",
    });
  });

  it("keeps first-run disclosure visible without dangling document authority", () => {
    const disclosure = createFirstRunPrivacyDisclosure({
      host: "unknown",
      selectedProviders: [],
      privacyDocumentAvailable: false,
    });
    expect(disclosure.privacyDocument).toBeNull();
    expect(createFirstRunPrivacyDiagnostic(disclosure)).toMatchObject({
      code: "AGENT_PACK_PRIVACY_FIRST_RUN",
      nextAction:
        "Review this first-run disclosure before enabling MCP, dev deployments, or external providers.",
    });
  });
});
