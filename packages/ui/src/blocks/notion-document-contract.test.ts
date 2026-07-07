import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("Notion document block contract", () => {
  it("exports reusable document blocks from packages/ui", () => {
    const index = read("src/index.tsx");

    expect(index).toContain("./blocks/notion-document");
    expect(index).toContain("./blocks/ux-essentials");
  });

  it("keeps markdown-style page rendering out of route-local sample code", () => {
    const blocks = read("src/blocks/notion-document.tsx");
    const route = read("../../apps/web/src/routes/index.tsx");

    expect(blocks).toContain("NotionDocumentPage");
    expect(blocks).toContain("renderInlineMarkdown");
    expect(blocks).toContain("NotionDocumentDiagram");
    expect(route).toContain("BusinessDashboardRoute");
    expect(route).not.toContain("NotionDocumentPage");
    expect(route).not.toContain("renderInlineMarkdown");
    expect(route).not.toContain("MarkdownLine");
  });

  it("keeps accessibility and resilience blocks reusable", () => {
    const blocks = read("src/blocks/ux-essentials.tsx");
    const dialog = read("src/blocks/template-dialog.tsx");

    expect(blocks).toContain("TemplateSkipLink");
    expect(blocks).toContain("TemplateLiveRegion");
    expect(blocks).toContain("TemplateNetworkBanner");
    expect(blocks).toContain("TemplateRouteFocusBoundary");
    expect(blocks).toContain("TemplateMainContent");
    expect(blocks).toContain("TemplateEmptyState");
    expect(dialog).toContain("TemplateDialog");
    expect(dialog).toContain("useTemplateDialogFocusTrap");
    expect(blocks).toContain("TemplateToastProvider");
    expect(blocks).toContain("announceAssertive");
    expect(blocks).toContain("TemplateRoutePending");
    expect(blocks).toContain("TemplateRouteError");
    expect(blocks).toContain("useTemplateFocusReturn");
    expect(blocks).toContain('role="status"');
    expect(blocks).toContain('role="alert"');
    expect(dialog).toContain('role="dialog"');
    expect(blocks).toContain('aria-live="polite"');
    expect(blocks).toContain('aria-live="assertive"');
    expect(dialog).toContain('aria-modal="true"');
  });
});
