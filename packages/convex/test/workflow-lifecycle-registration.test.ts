import * as Layer from "effect/Layer";
import { describe, expect, it, vi } from "vitest";

import lifecycleImpl from "../confect/workflows/lifecycle.impl";
import lifecycle from "../confect/workflows/lifecycle.spec";
import { createWorkflowLifecycleComponentAdapter } from "../confect/workflows/lifecycleComponent";

describe("workflow lifecycle Confect and component registration", () => {
  it("registers only the bounded internal lifecycle controls", () => {
    const encoded = JSON.stringify(lifecycle);
    expect(encoded).toContain("cancel");
    expect(encoded).toContain("list");
    expect(encoded).toContain("listByName");
    expect(encoded).toContain("listSteps");
    expect(encoded).toContain("cleanup");
    expect(encoded).toContain('"restart"');
    expect(Layer.isLayer(lifecycleImpl)).toBe(true);
  });

  it("maps exact component IDs and pinned restart options", async () => {
    const manager = {
      status: vi.fn(async () => ({ type: "completed" as const })),
      cancel: vi.fn(async () => undefined),
      restart: vi.fn(async () => undefined),
      cleanup: vi.fn(async () => true),
    };
    const ctx = { kind: "mutation-context" };
    const adapter = createWorkflowLifecycleComponentAdapter(ctx, manager);

    await expect(adapter.status("component-run-a")).resolves.toEqual({
      type: "completed",
    });
    await adapter.cancel("component-run-a");
    await adapter.restart("component-run-a", {
      from: "review.v3",
      startAsync: true,
    });
    await expect(adapter.cleanup("component-run-a")).resolves.toBe(true);

    expect(manager.cancel).toHaveBeenCalledWith(ctx, "component-run-a");
    expect(manager.status).toHaveBeenCalledWith(ctx, "component-run-a");
    expect(manager.restart).toHaveBeenCalledWith(ctx, "component-run-a", {
      from: "review.v3",
      startAsync: true,
    });
    expect(manager.cleanup).toHaveBeenCalledWith(ctx, "component-run-a");
  });
});
