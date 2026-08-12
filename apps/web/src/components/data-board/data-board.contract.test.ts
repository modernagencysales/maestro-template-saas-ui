import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

describe("DataBoard Kanban contract", () => {
  it("forwards drag callbacks without allowing rest to override board state", () => {
    const source = readFileSync(
      `${root}/apps/web/src/components/data-board/data-board.tsx`,
      "utf8",
    );

    expect(source).toContain(
      "<Kanban {...rest} items={items} onChange={setItems}>",
    );
  });
});
