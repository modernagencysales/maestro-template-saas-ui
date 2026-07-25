import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { buildWorkflowFiles as buildWorkflowFilesFromIndex } from "./index";
import { buildWorkflowFiles } from "./workflow-files";

describe("customer-safe workflow generator leaf", () => {
  it("preserves the public index output exactly", () => {
    const options = {
      name: "source grounded plan",
      system: "knowledge-brain",
      disposition: "extend" as const,
      description: "Builds a sourced plan with approval and receipt.",
    };

    expect(buildWorkflowFilesFromIndex).toBe(buildWorkflowFiles);
    expect(buildWorkflowFilesFromIndex(options)).toEqual(
      buildWorkflowFiles(options),
    );
  });

  it("imports only the pure workflow renderer dependency", () => {
    const source = readFileSync(
      new URL("./workflow-files.ts", import.meta.url),
      "utf8",
    );
    const sourceFile = ts.createSourceFile(
      "workflow-files.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const imports = sourceFile.statements
      .filter(ts.isImportDeclaration)
      .map((statement) => statement.moduleSpecifier)
      .filter(ts.isStringLiteral)
      .map((specifier) => specifier.text);

    expect(imports).toEqual(["./workflow-predeploy"]);
    expect(source).not.toMatch(
      /@maestro-template\/template-core|blueprints\/|workflow-release-commands|tooling\/(?:release|stack|agent-pack)|node:fs|writeFileSync|mkdirSync|fetch\(/,
    );
  });
});
