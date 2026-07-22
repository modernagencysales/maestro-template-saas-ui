import { describe, expect, it } from "vitest";

import {
  executeIntegrationOwnerReworkRoute,
  type IntegrationOwnerReworkRoute,
  type OwnerReworkRoutingReceipt,
} from "../src/route-integration-rework.js";

const route = (): IntegrationOwnerReworkRoute => ({
  commands: [],
  findingSha256: "1".repeat(64),
  ownerRoutes: [
    {
      findingIds: ["finding-a"],
      findings: [],
      findingSha256: "2".repeat(64),
      taskId: "S01-T01",
    },
    {
      findingIds: ["finding-b"],
      findings: [],
      findingSha256: "3".repeat(64),
      taskId: "S02-T01",
    },
  ],
  ownerTaskIds: ["S01-T01", "S02-T01"],
  resultSha256: "4".repeat(64),
  selectionFileSha256: "5".repeat(64),
  selectionPayloadSha256: "6".repeat(64),
});

describe("integration owner rework execution", () => {
  it("resumes only missing owners after a crash following a durable launch", () => {
    let receipt: OwnerReworkRoutingReceipt | undefined;
    const reservations = new Map<
      string,
      { findingsSha256: string; requestSha256: string; runId: string }
    >();
    const reopened: string[] = [];
    let crash = true;
    const run = () =>
      executeIntegrationOwnerReworkRoute(route(), {
        loadReceipt: () => receipt,
        reservationFor: (taskId) => reservations.get(taskId),
        reopen: (owner) => {
          reopened.push(owner.taskId);
          reservations.set(owner.taskId, {
            findingsSha256: owner.findingSha256,
            requestSha256:
              owner.taskId === "S01-T01" ? "7".repeat(64) : "8".repeat(64),
            runId: `run-${owner.taskId}`,
          });
          if (owner.taskId === "S02-T01" && crash)
            throw new Error("crash after launch");
        },
        saveReceipt: (value) => {
          receipt = value;
        },
        supersede: () => undefined,
      });

    expect(run).toThrow("crash after launch");
    expect(receipt?.owners["S01-T01"]?.status).toBe("launched");
    crash = false;
    expect(run()).toMatchObject({ status: "complete" });
    expect(reopened).toEqual(["S01-T01", "S02-T01"]);
    expect(receipt?.owners["S02-T01"]).toMatchObject({
      requestSha256: "8".repeat(64),
      runId: "run-S02-T01",
      status: "launched",
    });
  });

  it("rejects an unchanged lane without durable owner launch evidence", () => {
    expect(() =>
      executeIntegrationOwnerReworkRoute(route(), {
        loadReceipt: () => undefined,
        reservationFor: () => undefined,
        reopen: () => undefined,
        saveReceipt: () => undefined,
        supersede: () => undefined,
      }),
    ).toThrow("durable owner reservation is missing");
  });
});
