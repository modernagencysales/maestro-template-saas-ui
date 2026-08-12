import { describe, expect, it } from "vitest";

import { dependencyChunkName } from "./bundle-policy";

describe("dependencyChunkName", () => {
  it.each([
    ["react-dom/client.js", "vendor-react"],
    ["react-icons/lu/index.js", "vendor-icons"],
    ["recharts/index.js", "vendor-charts"],
    ["date-fns/addDays.js", "vendor-dates"],
    ["@dnd-kit/core/dist/index.js", "vendor-dnd"],
    ["@saas-ui-pro/kanban/index.js", "vendor-saas-pro"],
    ["@zag-js/dialog/index.js", "vendor-zag"],
    ["@floating-ui/dom/index.js", "vendor-floating"],
    ["@chakra-ui/react/dist/index.js", "vendor-ui"],
    ["@blocknote/core/dist/index.js", "vendor-editor"],
    ["@xyflow/react/dist/index.js", "vendor-graph"],
    ["@tanstack/react-router/dist/index.js", "vendor-router"],
    ["@confect/core/dist/index.js", "vendor-effect"],
    ["convex/dist/esm/index.js", "vendor-backend"],
    ["left-pad/index.js", "vendor"],
  ])("groups %s as %s", (packagePath, expected) => {
    expect(dependencyChunkName(`/workspace/node_modules/${packagePath}`)).toBe(
      expected,
    );
  });

  it("handles pnpm paths and Windows separators", () => {
    expect(
      dependencyChunkName(
        "C:\\repo\\node_modules\\.pnpm\\@tiptap+core@3.27.1\\node_modules\\@tiptap\\core\\dist\\index.js",
      ),
    ).toBe("vendor-editor");
  });

  it("leaves application modules to automatic route splitting", () => {
    expect(dependencyChunkName("/workspace/apps/web/src/index.tsx")).toBeNull();
  });
});
