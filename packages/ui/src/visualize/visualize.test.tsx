import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TemplateCalendarBoard,
  TemplateDataGrid,
  TemplateDiffView,
  TemplateFunnelView,
  TemplateHealthBoard,
  TemplateKanbanBoard,
  TemplateLineagePanel,
  TemplateMetricTiles,
} from "./index";

const read = (path: string): string => readFileSync(path, "utf8");

const states = ["loading", "empty", "ready", "error"] as const;

describe("visualization primitives", () => {
  it("renders data grid states from plain view models", () => {
    expect(
      states.map((state) =>
        renderToStaticMarkup(
          <TemplateDataGrid
            columns={["Name", "Status"]}
            rows={[["Acme", "Ready"]]}
            state={state}
          />,
        ),
      ),
    ).toEqual([
      expect.stringContaining("Loading data"),
      expect.stringContaining("No rows"),
      expect.stringContaining("Acme"),
      expect.stringContaining("Could not load data"),
    ]);
  });

  it("renders Kanban, calendar, funnel, and metric visualizations", () => {
    expect(
      renderToStaticMarkup(
        <TemplateKanbanBoard
          columns={[{ id: "todo", label: "To do", cards: ["Review"] }]}
          state="ready"
        />,
      ),
    ).toContain("Review");
    expect(
      renderToStaticMarkup(
        <TemplateCalendarBoard
          events={[{ id: "call", label: "Client call", date: "2026-07-01" }]}
          state="ready"
        />,
      ),
    ).toContain("Client call");
    expect(
      renderToStaticMarkup(
        <TemplateFunnelView
          stages={[{ label: "Qualified", value: 12 }]}
          state="ready"
        />,
      ),
    ).toContain("Qualified");
    expect(
      renderToStaticMarkup(
        <TemplateMetricTiles
          metrics={[{ label: "Active workflows", value: "8", tone: "good" }]}
          state="ready"
        />,
      ),
    ).toContain("Active workflows");
  });

  it("renders health, lineage, and diff visualizations", () => {
    expect(
      renderToStaticMarkup(
        <TemplateHealthBoard
          checks={[
            {
              label: "MailerSend",
              status: "ready",
              detail: "Missing MAILERSEND_API_KEY.",
            },
          ]}
          state="ready"
        />,
      ),
    ).toContain("Missing MAILERSEND_API_KEY.");
    expect(
      renderToStaticMarkup(
        <TemplateLineagePanel
          nodes={[
            { id: "source", label: "Source", detail: "Markdown" },
            { id: "output", label: "Output", detail: "Brief" },
          ]}
          state="ready"
        />,
      ),
    ).toContain("Markdown");
    expect(
      renderToStaticMarkup(
        <TemplateDiffView
          changes={[
            { id: "one", kind: "added", before: "", after: "New claim" },
          ]}
          state="ready"
        />,
      ),
    ).toContain("New claim");
  });

  it("keeps visualization components on local primitives and away from backend imports", () => {
    const files = [
      "data-grid.tsx",
      "kanban-board.tsx",
      "calendar-board.tsx",
      "funnel-view.tsx",
      "metric-tiles.tsx",
      "health-board.tsx",
      "lineage-panel.tsx",
      "diff-view.tsx",
    ].map((file) => read(`src/visualize/${file}`));

    for (const source of files) {
      expect(source).not.toContain("@notion-kit");
      expect(source).toContain("../primitives");
      expect(source).not.toContain("convex/");
      expect(source).not.toContain("@confect/");
      expect(source).not.toContain("@tanstack/react-router");
      expect(source).not.toContain("@workos/");
    }
  });
});
