import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("upstream chassis route authority", () => {
  it("routes authenticated pages through the transplanted chassis", () => {
    expect(read("src/routes/_workspace.tsx")).toContain("<AppLayout");
    expect(read("src/routes/_workspace.tsx")).toContain("<DashboardLayout");
    expect(existsSync(resolve(root, "src/saas-ui/business-shell.tsx"))).toBe(
      false,
    );
    expect(read("src/routes/dashboard.tsx")).toContain("DashboardPage");
  });
});
