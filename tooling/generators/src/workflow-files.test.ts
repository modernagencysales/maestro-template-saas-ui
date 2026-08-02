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
  it("keeps typed capacity errors on public kickoff only", () => {
    const files = buildWorkflowFiles({
      name: "capacity fixture",
      system: "workflow-runtime",
      disposition: "extend",
    }).files;
    const spec = files.find((file) => file.path.endsWith(".spec.ts"))?.content;
    const impl = files.find((file) => file.path.endsWith(".impl.ts"))?.content;
    const startImpl = impl?.slice(
      impl.indexOf("const startWithProfile"),
      impl.indexOf("const startInteractiveImpl"),
    );
    expect(spec).toContain("const WorkflowStartErrors = Schema.Union(");
    expect(spec).toContain('"WorkflowAdmissionDenied"');
    expect(impl).toContain("Effect.catch((error) =>");
    expect(impl).toContain("error instanceof WorkflowAdmissionDenied");
    expect(impl).toContain("? Effect.fail(error)");
    expect(impl).toContain(": Effect.die(error)");
    expect(startImpl).toContain("}).pipe(preserveWorkflowStartErrors)");
    expect(impl).not.toContain("error.message");
    expect(startImpl).not.toContain("toWorkflowValidationFailed");
  });
});
