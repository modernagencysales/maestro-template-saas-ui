import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("upstream chassis route authority", () => {
  it("routes authenticated pages through the transplanted chassis", () => {
    const workspaceRoute = read("src/routes/_workspace.tsx");
    expect(workspaceRoute).toContain("<AppLayout");
    expect(workspaceRoute).toContain("<DashboardLayout");
    expect(workspaceRoute).toContain("<BillingProvider>");
    expect(read("src/routes/_workspace.settings.tsx")).toContain("<Outlet");
    expect(read("src/routes/_workspace.inbox.tsx")).toContain("<Outlet");
    expect(read("src/routes/_workspace.inbox.tsx")).toContain("useMemo");
    expect(read("src/routes/_workspace.inbox.$id.tsx")).toContain(
      "<InboxViewPage",
    );
    expect(read("src/routes/_workspace.contacts.tsx")).toContain("<Outlet");
    expect(read("src/routes/_workspace.contacts.tsx")).not.toContain(
      "<ContactsListPage",
    );
    expect(
      existsSync(resolve(root, "src/routes/_workspace.contacts.index.tsx")),
    ).toBe(true);
    expect(read("src/components/form/fields/field-root.tsx")).toContain(
      "htmlFor={fieldId}",
    );
    expect(existsSync(resolve(root, "src/saas-ui/business-shell.tsx"))).toBe(
      false,
    );
    expect(read("src/routes/dashboard.tsx")).toContain("DashboardPage");
  });
});
