import { describe, expect, it } from "vitest";

import {
  createVerificationReceipt,
  evaluateReceiptStaleness,
  summarizeVerificationReceipt,
  type VerificationReceiptInput,
} from "./receipt.js";

const base: VerificationReceiptInput = {
  createdAt: "2026-07-25T12:00:00.000Z",
  command: { id: "verify", version: 1 },
  subject: { commit: "abc123", dirty: false },
  environmentFingerprint: "env:node22-linux",
  providerPostureFingerprint: "providers:fake",
  scope: { kind: "full", changedPaths: [], partial: false },
  gates: [
    {
      gateId: "types",
      posture: "required",
      evidenceClass: "static",
      status: "pass",
      semanticRuleIds: ["typescript/strict"],
    },
  ],
};

describe("verification receipt", () => {
  it("binds injected evidence and passes deterministic required gates", () => {
    const receipt = createVerificationReceipt(base);
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      createdAt: base.createdAt,
      command: base.command,
      subject: base.subject,
      fingerprints: {
        environment: base.environmentFingerprint,
        providerPosture: base.providerPostureFingerprint,
      },
      scope: base.scope,
    });
    expect(summarizeVerificationReceipt(receipt)).toEqual({
      status: "pass",
      requiredFailures: [],
      advisoryFailures: [],
      unavailable: [],
    });
  });

  it("blocks on a required deterministic failure and preserves rule ids", () => {
    const receipt = createVerificationReceipt({
      ...base,
      gates: [
        {
          ...base.gates[0]!,
          status: "fail",
          semanticRuleIds: ["workflow/no-raw-runner"],
        },
      ],
    });
    expect(summarizeVerificationReceipt(receipt)).toMatchObject({
      status: "fail",
      requiredFailures: ["types"],
    });
    expect(receipt.gates[0]?.semanticRuleIds).toEqual([
      "workflow/no-raw-runner",
    ]);
  });

  it("records advisory failure without converting it to blocking evidence", () => {
    const receipt = createVerificationReceipt({
      ...base,
      gates: [
        {
          ...base.gates[0]!,
          gateId: "taste",
          posture: "advisory",
          status: "fail",
        },
      ],
    });
    expect(summarizeVerificationReceipt(receipt)).toEqual({
      status: "pass-with-advisories",
      requiredFailures: [],
      advisoryFailures: ["taste"],
      unavailable: [],
    });
  });

  it("records an unavailable provider honestly", () => {
    const receipt = createVerificationReceipt({
      ...base,
      gates: [
        {
          ...base.gates[0]!,
          gateId: "provider-smoke",
          evidenceClass: "live-promotion",
          status: "unavailable",
        },
      ],
    });
    expect(summarizeVerificationReceipt(receipt)).toMatchObject({
      status: "fail",
      unavailable: ["provider-smoke"],
    });
  });

  it("keeps unavailable advisory evidence non-blocking but visible", () => {
    const receipt = createVerificationReceipt({
      ...base,
      gates: [
        {
          ...base.gates[0]!,
          gateId: "contract-review",
          posture: "advisory",
          evidenceClass: "advisory",
          status: "unavailable",
        },
      ],
    });
    expect(summarizeVerificationReceipt(receipt)).toEqual({
      status: "pass-with-advisories",
      requiredFailures: [],
      advisoryFailures: ["contract-review"],
      unavailable: ["contract-review"],
    });
  });

  it("detects commit and dirty-state staleness in stable order", () => {
    const receipt = createVerificationReceipt(base);
    expect(
      evaluateReceiptStaleness(receipt, {
        subject: { commit: "def456", dirty: true },
        environmentFingerprint: base.environmentFingerprint,
        providerPostureFingerprint: base.providerPostureFingerprint,
      }),
    ).toEqual({
      stale: true,
      reasons: ["commit-changed", "dirty-state-changed"],
    });
  });

  it("detects environment and provider posture staleness", () => {
    const receipt = createVerificationReceipt(base);
    expect(
      evaluateReceiptStaleness(receipt, {
        subject: base.subject,
        environmentFingerprint: "env:node24-linux",
        providerPostureFingerprint: "providers:dev",
      }),
    ).toEqual({
      stale: true,
      reasons: ["environment-changed", "provider-posture-changed"],
    });
  });

  it("marks partial focused scope stale for full-proof use", () => {
    const receipt = createVerificationReceipt({
      ...base,
      scope: {
        kind: "focused",
        changedPaths: ["tooling/agent-pack/src/receipt.ts"],
        partial: true,
      },
    });
    expect(
      evaluateReceiptStaleness(receipt, {
        subject: base.subject,
        environmentFingerprint: base.environmentFingerprint,
        providerPostureFingerprint: base.providerPostureFingerprint,
      }),
    ).toEqual({ stale: true, reasons: ["partial-scope"] });
  });
});
