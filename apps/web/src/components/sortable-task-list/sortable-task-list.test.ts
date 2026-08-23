import { describe, expect, it } from "vitest";

import { reorderTasks, type Task } from "./sortable-task-list";

const tasks: Task[] = [
  { id: "todo", title: "Todo", status: "todo", date: "", labels: [] },
  { id: "doing", title: "Doing", status: "doing", date: "", labels: [] },
];

describe("reorderTasks", () => {
  it("leaves the list unchanged when drag identities are stale", () => {
    expect(
      reorderTasks(tasks, "missing", { type: "task", id: "todo" }),
    ).toEqual(tasks);
    expect(
      reorderTasks(tasks, "todo", { type: "task", id: "missing" }),
    ).toEqual(tasks);
  });

  it("does not move a task above the first group header", () => {
    expect(
      reorderTasks(tasks, "doing", { type: "header", status: "todo" }),
    ).toEqual(tasks);
  });
});
