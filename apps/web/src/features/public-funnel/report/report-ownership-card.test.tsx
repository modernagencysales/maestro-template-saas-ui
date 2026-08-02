import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../adapters/confect-state", () => ({
  useTemplateMutation: () => vi.fn(),
}));

import { ReportOwnershipCard } from "./report-ownership-card";

describe("ReportOwnershipCard", () => {
  it("explains why email is needed without implying the idea is public", () => {
    const html = renderToStaticMarkup(
      <ReportOwnershipCard accessToken="access_1" reportId="report_1" />,
    );
    expect(html).toContain("Save it across devices");
    expect(html).toContain("Email my save link");
    expect(html).toContain("Your idea stays private");
  });
});
