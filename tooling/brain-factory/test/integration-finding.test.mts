import { describe, expect, it } from "vitest";

import {
  classifyIntegrationFindings,
  type IntegrationFinding,
} from "../src/integration-finding.js";

const candidateHeadSha = "a".repeat(40);
const evidenceSha256 = "b".repeat(64);

const finding = (
  overrides: Partial<IntegrationFinding> = {},
): IntegrationFinding => ({
  id: "wave-000001-S01-T01-defect",
  taskId: "S01-T01",
  candidateHeadSha,
  summary: "The task-owned behavior is incorrect.",
  details: "The selected task must repair its locked source.",
  severity: "high",
  affectedPaths: ["packages/one.ts"],
  expectedBehavior: "The task-owned behavior is correct.",
  requiredRegressionProof: "The focused regression passes.",
  priorEvidenceSha256: [evidenceSha256],
  changeExpectation: "source_or_test_delta",
  ownerKind: "task",
  ...overrides,
});

const selection = [
  { taskId: "S01-T01", fileLocks: ["packages/one.ts", "packages/one.test.ts"] },
  { taskId: "S02-T01", fileLocks: ["packages/two.ts"] },
] as const;

describe("integration finding ownership", () => {
  it("groups task-owned findings by sorted selected owner", () => {
    const classified = classifyIntegrationFindings({
      findings: [
        finding({ id: "finding-b" }),
        finding({
          id: "finding-a",
          taskId: "S02-T01",
          affectedPaths: ["packages/two.ts"],
        }),
      ],
      integrationOwnedPaths: ["packages/generated.ts"],
      selectedTasks: selection,
    });

    expect(classified.ownerKind).toBe("task");
    expect(classified.taskOwners).toEqual(["S01-T01", "S02-T01"]);
    expect(classified.findings.map(({ id }) => id)).toEqual([
      "finding-a",
      "finding-b",
    ]);
  });

  it("accepts integration findings only on declared integration-owned paths", () => {
    expect(
      classifyIntegrationFindings({
        findings: [
          finding({
            affectedPaths: ["packages/generated.ts"],
            ownerKind: "integration",
            taskId: "integration",
          }),
        ],
        integrationOwnedPaths: ["packages/generated.ts"],
        selectedTasks: selection,
      }),
    ).toMatchObject({ ownerKind: "integration", taskOwners: [] });
  });

  it.each([
    {
      name: "unknown task",
      value: finding({ taskId: "S99-T99" }),
      message: /is not selected/,
    },
    {
      name: "path outside owner locks",
      value: finding({ affectedPaths: ["packages/two.ts"] }),
      message: /outside S01-T01 locks/,
    },
    {
      name: "integration path outside integration ownership",
      value: finding({ ownerKind: "integration", taskId: "integration" }),
      message: /outside integration ownership/,
    },
  ])("fails closed for $name", ({ value, message }) => {
    expect(() =>
      classifyIntegrationFindings({
        findings: [value],
        integrationOwnedPaths: ["packages/generated.ts"],
        selectedTasks: selection,
      }),
    ).toThrow(message);
  });

  it("rejects mixed task and integration ownership", () => {
    expect(() =>
      classifyIntegrationFindings({
        findings: [
          finding(),
          finding({
            affectedPaths: ["packages/generated.ts"],
            id: "integration-defect",
            ownerKind: "integration",
            taskId: "integration",
          }),
        ],
        integrationOwnedPaths: ["packages/generated.ts"],
        selectedTasks: selection,
      }),
    ).toThrow("mixed integration finding ownership");
  });

  it("binds every task finding to the exact candidate and immutable evidence", () => {
    expect(() =>
      classifyIntegrationFindings({
        candidateHeadSha,
        findings: [finding({ candidateHeadSha: "c".repeat(40) })],
        integrationOwnedPaths: [],
        selectedTasks: selection,
      }),
    ).toThrow("candidate head mismatch");
    expect(() =>
      classifyIntegrationFindings({
        candidateHeadSha,
        findings: [finding({ priorEvidenceSha256: [] })],
        integrationOwnedPaths: [],
        selectedTasks: selection,
      }),
    ).toThrow("priorEvidenceSha256 must not be empty");
  });
});
