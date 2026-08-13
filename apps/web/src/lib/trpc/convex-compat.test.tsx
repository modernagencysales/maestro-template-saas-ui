import { describe, expect, it } from "vitest";

import { assertRealAuthority, realRefs } from "#lib/trpc/react";

describe("Convex starter query compatibility", () => {
  it("maps auth, workspace, and member paths to exact generated refs", () => {
    expect(realRefs["auth.me"]).toBeDefined();
    expect(realRefs["workspaces.bySlug"]).toBeDefined();
    expect(realRefs["workspaceMembers.list"]).toBeDefined();
  });

  it("does not silently treat unknown real authorities as empty data", () => {
    expect(() => assertRealAuthority("billing.account")).toThrow(
      /No Convex authority/,
    );
  });
});
