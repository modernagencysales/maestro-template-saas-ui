import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

  it("keeps the executable and barrel outside factory release assembly", () => {
    const cli = readFileSync(new URL("./cli.ts", import.meta.url), "utf8");
    const barrel = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(cli).toContain('from "./index"');
    expect(barrel).not.toContain("process.exitCode");

    const pending = [
      resolve(dirname(new URL("./cli.ts", import.meta.url).pathname), "cli.ts"),
      resolve(dirname(new URL("./index.ts", import.meta.url).pathname), "index.ts"),
    ];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const path = pending.pop();
      if (!path || visited.has(path)) continue;
      visited.add(path);
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(
        /saasRegistrationProjections|blueprints\/saasApplicationFactory|releases\/|tooling\/release/,
      );
      for (const match of source.matchAll(
        /(?:import|export)\s+(?:[^"']*?\sfrom\s*)?["'](\.[^"']+)["']/g,
      )) {
        const specifier = match[1];
        if (!specifier) continue;
        const base = resolve(dirname(path), specifier);
        const candidate = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (candidate) pending.push(candidate);
      }
    }
  });
});
