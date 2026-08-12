import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

describe("DataBoard Kanban contract", () => {
  it("forwards drag callbacks to the real Kanban container", () => {
    const source = readFileSync(
      `${root}/apps/web/src/components/data-board/data-board.tsx`,
      "utf8",
    );

    expect(source).toContain(
      "<Kanban items={items} onChange={setItems} {...rest}>",
    );
  });
});
