import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SuiProvider } from "@saas-ui/react";

import { system } from "#theme/preset";

vi.mock("@saas-ui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@saas-ui/react")>();
  return { ...actual, useSidebar: () => ({ open: true }) };
});

import { ReportsPage } from "./reports-page";

describe("ReportsPage accessibility semantics", () => {
  it("reflows the dashboard report cards before the customer metrics can clip", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "reports-page.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'templateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }}',
    );
    expect(source).toContain('gridColumn={{ base: "1", lg: "span 2" }}');
    expect(source).toContain('gridColumn={{ base: "1", lg: "span 1" }}');
  });

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
