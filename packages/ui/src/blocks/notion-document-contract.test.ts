import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("Notion document block contract", () => {
  it("exports reusable document blocks from packages/ui", () => {
    const index = read("src/index.tsx");

    expect(index).toContain("./blocks/notion-document");
  });

  it("keeps markdown-style page rendering out of route-local sample code", () => {
    const blocks = read("src/blocks/notion-document.tsx");
    const publicRootRoute = read("../../apps/web/src/routes/index.tsx");
    const dashboardRoute = read(
      "../../apps/web/src/routes/_workspace.dashboard.tsx",
    );

    expect(blocks).toContain("NotionDocumentPage");
    expect(blocks).toContain("renderInlineMarkdown");
    expect(blocks).toContain("NotionDocumentDiagram");
    expect(publicRootRoute).toContain("AppIdeaLanding");
    expect(dashboardRoute).toContain("BusinessDashboardRoute");
    for (const route of [publicRootRoute, dashboardRoute]) {
      expect(route).not.toContain("NotionDocumentPage");
      expect(route).not.toContain("renderInlineMarkdown");
      expect(route).not.toContain("MarkdownLine");
    }
  });
});
