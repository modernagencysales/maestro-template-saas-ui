import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { preProcessFile } from "typescript";
import { describe, expect, it } from "vitest";
import { buildSaasApplicationTargetPlan } from "./blueprints/saasApplication";

const sourceDir = dirname(new URL("./customer.ts", import.meta.url).pathname);

const resolveLocal = (from: string, specifier: string): string => {
  const base = resolve(dirname(from), specifier);
  const match = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    resolve(base, "index.ts"),
  ].find(existsSync);
  if (!match)
    throw new Error(`Unresolved customer import ${specifier} from ${from}`);
  return match;
};

const customerClosure = (): readonly string[] => {
  const pending = [
    resolve(sourceDir, "customer.ts"),
    resolve(sourceDir, "customer-cli.ts"),
  ];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);
    const source = readFileSync(path, "utf8");
    expect(path).not.toMatch(/\/src\/index\.ts$/);
    expect(source).not.toMatch(
      /saasApplicationFactory|saasRegistrationProjections|tooling\/release|(?:^|\/)releases\//,
    );
    for (const imported of preProcessFile(source, true, true).importedFiles) {
      if (imported.fileName.startsWith("."))
        pending.push(resolveLocal(path, imported.fileName));
    }
  }
  return [...visited];
};

describe("customer generator closure", () => {
  it("is complete and excludes the factory runtime", () => {
    const closure = customerClosure();
    for (const name of [
      "customer-runtime.ts",
      "customer-dispatcher.ts",
      "private-package.ts",
      "workflow-files.ts",
      "workflow-predeploy.ts",
      "workflow-release-commands.ts",
    ]) {
      expect(closure).toContain(resolve(sourceDir, name));
    }
    const projectedPaths = new Set(
      buildSaasApplicationTargetPlan({
        name: "SaaS Application",
        firstOutcome: "Deliver the first customer outcome",
        patterns: ["workflow-automation"],
      }).entries.map(({ path }) => path),
    );
    for (const path of closure) {
      const relative = path.slice(sourceDir.length + 1);
      expect(projectedPaths).toContain(`tooling/generators/src/${relative}`);
    }
  });
});
