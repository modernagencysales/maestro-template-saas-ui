import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-route-tree.mts";

describe("check:route-tree", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("guards the TanStack Start route-tree migration contract", () => {
    expect(descriptor.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "docs/template/frontend-architecture.md",
          includes: expect.arrayContaining([
            "generated `routeTree`",
            'defaultPreload: "intent"',
            "scrollRestoration: true",
            "apps/web/src/routeTree.gen.ts",
          ]),
        }),
        expect.objectContaining({
          file: "docs/template/repo-map.md",
          includes: expect.arrayContaining([
            "/brain",
            "/workflows",
            "/capabilities",
            "/agents",
            "/runs",
            "/settings",
          ]),
        }),
        expect.objectContaining({
          file: "apps/web/package.json",
          includes: expect.arrayContaining([
            '"@tanstack/react-start"',
            '"@tanstack/react-router"',
            '"@tanstack/react-query"',
            '"@convex-dev/react-query"',
            '"@workos/authkit-tanstack-react-start"',
            '"@saas-ui/react"',
            '"@saas-ui-pro/react"',
          ]),
        }),
      ]),
    );
  });
});
