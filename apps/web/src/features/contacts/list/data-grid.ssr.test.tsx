// @vitest-environment node

import { renderToString } from "react-dom/server";
import { DataGrid } from "@saas-ui-pro/react";
import { SuiProvider } from "@saas-ui/react";
import { describe, expect, it } from "vitest";

import { system } from "#theme/preset";

describe("Saas UI Pro DataGrid", () => {
  it("evaluates document during SSR when column resizing is enabled", () => {
    expect(() =>
      renderToString(
        <SuiProvider value={system}>
          <DataGrid
            columns={[{ accessorKey: "name", header: "Name" }]}
            data={[{ name: "Jordan Lee" }]}
            columnResizeEnabled
          />
        </SuiProvider>,
      ),
    ).toThrow("document is not defined");
  });
});
