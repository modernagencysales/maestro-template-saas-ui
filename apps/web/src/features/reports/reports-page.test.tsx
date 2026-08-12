import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SuiProvider } from "@saas-ui/react";

import { system } from "#theme/preset";

vi.mock("@saas-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@saas-ui/react")>();
  return { ...actual, useSidebar: () => ({ open: true }) };
});

import { ReportsPage } from "./reports-page";

describe("ReportsPage accessibility semantics", () => {
  it("does not expose the chart legend as an invalid definition-list item", () => {
    const html = renderToStaticMarkup(
      <SuiProvider value={system}>
        <ReportsPage />
      </SuiProvider>,
    );

    expect(html).toContain(">Churn by tier</div>");
    expect(html).not.toContain(">Churn by tier</dt>");
  });
});
