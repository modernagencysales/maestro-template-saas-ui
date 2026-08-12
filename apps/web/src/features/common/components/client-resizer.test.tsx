// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClientResizer } from "./client-resizer";

describe("ClientResizer", () => {
  it("renders its fallback during SSR without evaluating the browser-only resizer", () => {
    expect(() =>
      renderToString(
        <ClientResizer defaultWidth={280}>
          <div data-testid="sidebar-shell">Sidebar</div>
        </ClientResizer>,
      ),
    ).not.toThrow();
  });
});
