import { describe, expect, it } from "vitest";

import {
  appendContractEvidence,
  drainContractEvidence,
  type ContractEvidence,
  type ContractEvidenceStore,
} from "../confect/runtime/contractEvidence";

const backend = {
  deploymentId: "deployment-one",
  inputDigest: `sha256:${"a".repeat(64)}`,
  startNonce: "server-start-one",
} as const;

describe("contract evidence", () => {
  it("records one admitted success and drains it exactly once", async () => {
    const rows: unknown[] = [];
    const store: ContractEvidenceStore = {
      runtimeMarker: "epoch-one",
      hasCorrelationNonce: async (scenarioNonce, correlationNonce) =>
        rows.some(
          (row) =>
            (
              row as {
                readonly scenarioNonce: string;
                readonly correlationNonce: string;
              }
            ).scenarioNonce === scenarioNonce &&
            (row as { readonly correlationNonce: string }).correlationNonce ===
              correlationNonce,
        ),
      append: async (row) => {
        rows.push(row);
      },
      drain: async (scenarioNonce) => {
        const drained = rows.filter(
          (row) =>
            (row as { readonly scenarioNonce: string }).scenarioNonce ===
            scenarioNonce,
        );
        rows.splice(
          0,
          rows.length,
          ...rows.filter((row) => !drained.includes(row)),
        );
        return drained as never;
      },
    };
    const input = {
      scenarioNonce: "scenario-one",
      correlationNonce: "step-one",
      principalDigest: `sha256:${"b".repeat(64)}`,
      surfaceId: "surface_web",
      transport: "ui" as const,
      backend,
    } satisfies ContractEvidence;

    await appendContractEvidence(store, "epoch-one", input);
    await expect(
      appendContractEvidence(store, "epoch-one", input),
    ).rejects.toThrow(/replayed correlation nonce/u);
    await expect(
      drainContractEvidence(store, "epoch-one", "scenario-one"),
    ).resolves.toEqual([expect.objectContaining(input)]);
    await expect(
      drainContractEvidence(store, "epoch-one", "scenario-one"),
    ).resolves.toEqual([]);
  });

  it("rejects rows outside the controller-installed acceptance runtime", async () => {
    const store: ContractEvidenceStore = {
      append: async () => undefined,
      drain: async () => [],
    };
    await expect(
      appendContractEvidence(store, "epoch-one", {
        scenarioNonce: "scenario-one",
        correlationNonce: "step-one",
        principalDigest: `sha256:${"b".repeat(64)}`,
        surfaceId: "surface_web",
        transport: "ui",
        backend,
      }),
    ).rejects.toThrow(/acceptance runtime marker/u);
  });
});
