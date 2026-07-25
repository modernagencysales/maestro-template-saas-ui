import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSaasApplicationFiles } from "./blueprints/saasApplication";

describe("customer generator closure", () => {
  it("keeps customer SaaS authoring independent of frozen factory releases", () => {
    const source = readFileSync(
      new URL("./blueprints/saasApplication.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/saasRegistrationProjections|releases\//);

    const paths = buildSaasApplicationFiles({ name: "Customer App" }).map(
      ({ path }) => path,
    );
    expect(paths).not.toContain("apps/cli/src/factory/customerComposition.ts");
    expect(paths).not.toContain("package.json");
    expect(paths).not.toContain("tooling/generators/src/workflow-predeploy.ts");
  });

  it("uses a dedicated thin executable entry", () => {
    const cli = readFileSync(new URL("./cli.ts", import.meta.url), "utf8");
    const barrel = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(cli).toContain('from "./index"');
    expect(barrel).not.toContain("process.exitCode");
  });
});
