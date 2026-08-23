import { describe, expect, it } from "vitest";

import type { Workspace } from "#lib/trpc/react";
import { requireCurrentWorkspace } from "./use-current-workspace";

describe("current workspace adapter", () => {
  it("narrows the route-admitted workspace for wholesale Starter screens", () => {
    const workspace = { id: "workspace_1" } as Workspace;
    expect(requireCurrentWorkspace(workspace)).toBe(workspace);
    expect(() => requireCurrentWorkspace(null)).toThrow(
      "The current workspace route was not admitted",
    );
  });
});
