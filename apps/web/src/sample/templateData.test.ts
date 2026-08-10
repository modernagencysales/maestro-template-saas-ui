import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));

describe("template runtime data", () => {
  it("ships no sample-data module or demo business records", () => {
    expect(existsSync(`${sourceRoot}/sample/templateData.ts`)).toBe(false);

    const shell = readFileSync(
      `${sourceRoot}/saas-ui/business-shell.tsx`,
      "utf8",
    );
    for (const fabricated of ["Northstar Labs", "$428K", "Acme Demo"]) {
      expect(shell).not.toContain(fabricated);
    }
  });
});
