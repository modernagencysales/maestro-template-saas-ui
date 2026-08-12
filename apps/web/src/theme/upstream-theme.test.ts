import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("upstream theme foundation", () => {
  it("keeps the starter preset and provider composition authoritative", () => {
    expect(read("src/theme/preset.ts")).toContain(
      "createSystem(defaultConfig, config)",
    );
    expect(read("src/theme/preset.ts")).toContain("@saas-ui/chakra-preset");
    expect(read("src/features/common/providers/app-provider.tsx")).toContain(
      "<SuiProvider",
    );
    expect(read("src/features/common/providers/app-provider.tsx")).toContain(
      "linkComponent={LinkComponent}",
    );
    expect(read("src/index.css")).not.toMatch(/--(?:chakra|saas)-colors-/u);
  });
});
