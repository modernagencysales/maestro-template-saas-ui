import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import type { BrainTaskContract } from "../src/manifest.js";
import { buildManifest } from "../src/manifest.js";
import { availableDispatchSlots, selectReadyTasks } from "../src/scheduler.js";

const syntheticTask = (
  template: BrainTaskContract,
  input: {
    readonly estimatedSourceLines: number;
    readonly fileLocks: readonly string[];
    readonly taskId: string;
    readonly codeStartAfter?: readonly string[];
  },
): BrainTaskContract => ({
  ...template,
  codeStartAfter: input.codeStartAfter ?? [],
  estimatedSourceLines: input.estimatedSourceLines,
  fileLocks: input.fileLocks,
  taskId: input.taskId,
});

describe("brain task scheduler", () => {
  it("treats max as total active capacity across repeated dispatches", () => {
    expect(availableDispatchSlots(20, 0)).toBe(20);
    expect(availableDispatchSlots(20, 7)).toBe(13);
    expect(availableDispatchSlots(20, 20)).toBe(0);
    expect(availableDispatchSlots(20, 23)).toBe(0);
    const dispatch = readFileSync(
      new URL("../src/dispatch.mts", import.meta.url),
      "utf8",
    );
    expect(dispatch).toContain("totalActiveCapacity: maximum");
    expect(dispatch).toContain("maximum: availableSlots");
  });

  it("starts independent contract lanes together", () => {
    const manifest = buildManifest();
    const result = selectReadyTasks({
      activeTaskIds: new Set(),
      completedTaskIds: new Set(),
      maximum: 10,
      tasks: manifest.tasks,
    });
    expect(result.selected.map((task) => task.taskId)).toEqual(
      expect.arrayContaining(["S00-T02", "S01-T01", "S02-T01", "S03-T01"]),
    );
    expect(
      result.selected.every((task) => task.fileInventoryStatus === "ready"),
    ).toBe(true);
  });

  it("does not dispatch an overlapping shared lock", () => {
    const manifest = buildManifest();
    const s01 = manifest.tasks.find((task) => task.taskId === "S01-T01");
    const s08 = manifest.tasks.find((task) => task.taskId === "S08-T01");
    expect(s01).toBeDefined();
    expect(s08).toBeDefined();
    if (!s01 || !s08) throw new Error("test fixtures missing from manifest");
    const synthetic = {
      ...s08,
      fileLocks: s01.fileLocks,
    };
    const result = selectReadyTasks({
      activeTaskIds: new Set(),
      completedTaskIds: new Set(),
      maximum: 2,
      requestedTaskIds: new Set([s01.taskId, synthetic.taskId]),
      tasks: [s01, synthetic],
    });
    expect(result.selected).toHaveLength(1);
  });

  it("advances the weighted critical path at the W3 frontier", () => {
    const manifest = buildManifest();
    const completedTaskIds = new Set([
      "S00-T02",
      "S00-T03",
      "S00-T04",
      "S01-T01",
      "S01-T02",
      "S01-T03",
      "S01-T04",
      "S02-T01",
      "S02-T02",
      "S03-T01",
      "S03-T02",
      "S04-T01",
      "S04-T02",
      "S08-T01",
      "S08-T02",
      "S09-T01",
      "S11-T01",
      "S11-T02",
      "S12-T01",
      "S13-T01",
    ]);

    const result = selectReadyTasks({
      activeTaskIds: new Set(),
      completedTaskIds,
      maximum: 1,
      tasks: manifest.tasks,
    });

    expect(result.ready.map((task) => task.taskId)).toEqual([
      "S02-T03",
      "S02-T04",
      "S03-T03",
      "S04-T03",
      "S04-T04",
      "S05-T01",
      "S10-T01",
    ]);
    expect(result.selected.map((task) => task.taskId)).toEqual(["S05-T01"]);
  });

  it("finds the exact maximum-value conflict-free subset", () => {
    const template = buildManifest().tasks.find(
      (task) => task.taskId === "S01-T01",
    );
    expect(template).toBeDefined();
    if (!template) throw new Error("scheduler template task missing");
    const broad = syntheticTask(template, {
      estimatedSourceLines: 300,
      fileLocks: ["shared-a", "shared-b"],
      taskId: "S20-T01",
    });
    const left = syntheticTask(template, {
      estimatedSourceLines: 150,
      fileLocks: ["shared-a"],
      taskId: "S20-T02",
    });
    const right = syntheticTask(template, {
      estimatedSourceLines: 150,
      fileLocks: ["shared-b"],
      taskId: "S20-T03",
    });

    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: new Set(),
        maximum: 3,
        tasks: [broad, left, right],
      }).selected.map((task) => task.taskId),
    ).toEqual(["S20-T02", "S20-T03"]);
  });

  it("is permutation-invariant with a stable task-ID tie-break", () => {
    const template = buildManifest().tasks.find(
      (task) => task.taskId === "S01-T01",
    );
    expect(template).toBeDefined();
    if (!template) throw new Error("scheduler template task missing");
    const earlier = syntheticTask(template, {
      estimatedSourceLines: 200,
      fileLocks: ["shared"],
      taskId: "S20-T01",
    });
    const later = syntheticTask(template, {
      estimatedSourceLines: 200,
      fileLocks: ["shared"],
      taskId: "S20-T02",
    });
    const independent = syntheticTask(template, {
      estimatedSourceLines: 100,
      fileLocks: ["independent"],
      taskId: "S20-T03",
    });
    const selections = [
      [later, independent, earlier],
      [independent, earlier, later],
      [earlier, later, independent],
    ].map((tasks) =>
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: new Set(),
        maximum: 3,
        tasks,
      }).selected.map((task) => task.taskId),
    );

    expect(selections).toEqual([
      ["S20-T01", "S20-T03"],
      ["S20-T01", "S20-T03"],
      ["S20-T01", "S20-T03"],
    ]);
  });

  it("gives zero-source contract work a minimum scheduling unit", () => {
    const template = buildManifest().tasks.find(
      (task) => task.taskId === "S01-T01",
    );
    expect(template).toBeDefined();
    if (!template) throw new Error("scheduler template task missing");
    const contract = syntheticTask(template, {
      estimatedSourceLines: 0,
      fileLocks: ["shared"],
      taskId: "S20-T01",
    });
    const contractConsumer = syntheticTask(template, {
      codeStartAfter: [contract.taskId],
      estimatedSourceLines: 300,
      fileLocks: ["consumer"],
      taskId: "S20-T02",
    });
    const standalone = syntheticTask(template, {
      estimatedSourceLines: 300,
      fileLocks: ["shared"],
      taskId: "S20-T03",
    });

    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: new Set(),
        maximum: 1,
        tasks: [standalone, contractConsumer, contract],
      }).selected.map((task) => task.taskId),
    ).toEqual(["S20-T01"]);
  });

  it("requires integrated code-start dependencies", () => {
    const manifest = buildManifest();
    const task = manifest.tasks.find(
      (candidate) => candidate.taskId === "S01-T02",
    );
    expect(task).toBeDefined();
    if (!task) throw new Error("S01-T02 missing from manifest");
    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: new Set(),
        maximum: 1,
        tasks: [task],
      }).selected,
    ).toEqual([]);
  });

  it("dispatches S13 operations after its direct code contracts", () => {
    const manifest = buildManifest();
    const task = manifest.tasks.find(
      (candidate) => candidate.taskId === "S13-T03",
    );
    expect(task).toBeDefined();
    if (!task) throw new Error("S13-T03 missing from manifest");
    const completed = new Set(["S08-T01"]);
    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: completed,
        maximum: 1,
        tasks: [task],
      }).selected,
    ).toEqual([]);
    completed.add("S06-T02");
    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: completed,
        maximum: 1,
        tasks: [task],
      }).selected.map((candidate) => candidate.taskId),
    ).toEqual(["S13-T03"]);
  });

  it("does not dispatch a task whose exact file inventory is open", () => {
    const manifest = buildManifest();
    const task = manifest.tasks.find(
      (candidate) => candidate.taskId === "S01-T01",
    );
    expect(task?.fileInventoryStatus).toBe("ready");
    const openTask = task
      ? ({
          ...task,
          fileInventoryStatus: "open:F" as const,
        } satisfies typeof task)
      : undefined;
    expect(
      selectReadyTasks({
        activeTaskIds: new Set(),
        completedTaskIds: new Set(),
        maximum: 1,
        tasks: openTask ? [openTask] : [],
      }).selected,
    ).toEqual([]);
  });

  it("keeps locks held for lane-green tasks awaiting integration", () => {
    const manifest = buildManifest();
    const laneGreen = manifest.tasks.find(
      (candidate) => candidate.taskId === "S12-T01",
    );
    const candidate = manifest.tasks.find((task) => task.taskId === "S09-T01");
    expect(laneGreen).toBeDefined();
    expect(candidate).toBeDefined();
    if (!laneGreen || !candidate)
      throw new Error("scheduler fixtures missing from manifest");

    const overlappingCandidate = {
      ...candidate,
      fileLocks: laneGreen.fileLocks,
    };
    expect(
      selectReadyTasks({
        activeTaskIds: new Set([laneGreen.taskId]),
        completedTaskIds: new Set(),
        maximum: 1,
        tasks: [laneGreen, overlappingCandidate],
      }).selected,
    ).toEqual([]);
  });
});
