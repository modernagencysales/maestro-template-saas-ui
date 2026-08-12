import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ContactsListPage mobile controls", () => {
  it("allows the data-grid toolbar and display controls to wrap at 320px", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "list-page.tsx"),
      "utf8",
    );

    expect(source).toContain('flexWrap={{ base: "wrap", md: "nowrap" }}');
    expect(source).toContain('display={{ base: "none", md: "block" }}');
    expect(source).toContain(
      'justifyContent={{ base: "flex-start", md: "space-between" }}',
    );
  });
});
