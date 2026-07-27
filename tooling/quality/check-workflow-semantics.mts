import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  WORKFLOW_GRAPH_FIELDS,
  WORKFLOW_SEMANTICS,
  renderWorkflowSemanticsMarkdown,
  validateWorkflowSemantics,
} from "@maestro-template/template-core/workflow-semantics";
import { isDirectRun } from "./src/direct-run.mts";

const GENERATED_DOC = "docs/template/generated/workflow-semantics.md";
const GRAPH_SCHEMA_FILE =
  "packages/convex/confect/workflows/graphSchema.ts" as const;

export type WorkflowSemanticFinding = {
  readonly ruleId: string;
  readonly file: string;
  readonly reason: string;
  readonly repair: string;
};

const finding = (
  ruleId: string,
  file: string,
  reason: string,
  repair: string,
): WorkflowSemanticFinding => ({ ruleId, file, reason, repair });

export const readWorkflowGraphFields = (): readonly string[] =>
  WORKFLOW_GRAPH_FIELDS;

export const checkWorkflowSemantics = (
  repoRoot: string,
): readonly WorkflowSemanticFinding[] => {
  const findings = validateWorkflowSemantics(WORKFLOW_SEMANTICS).map((reason) =>
    finding(
      "WF-CONTRACT",
      "packages/template-core/src/workflow-semantics/contract.ts",
      reason,
      "complete the semantic rule evidence and rerun pnpm check:workflow-semantics",
    ),
  );
  const actualFields = readWorkflowGraphFields();
  for (const field of new Set([...WORKFLOW_GRAPH_FIELDS, ...actualFields])) {
    if (
      !WORKFLOW_GRAPH_FIELDS.includes(
        field as (typeof WORKFLOW_GRAPH_FIELDS)[number],
      )
    ) {
      findings.push(
        finding(
          "WF-GRAPH-UNMAPPED",
          GRAPH_SCHEMA_FILE,
          `graph schema field ${field} has no semantic rule`,
          "classify the field in WORKFLOW_SEMANTICS and add compiler/fixture evidence",
        ),
      );
    } else if (!actualFields.includes(field)) {
      findings.push(
        finding(
          "WF-GRAPH-STALE",
          GRAPH_SCHEMA_FILE,
          `semantic field ${field} is absent from the graph schemas`,
          "remove the stale rule or restore the typed graph field",
        ),
      );
    }
  }
  const expectedDoc = renderWorkflowSemanticsMarkdown(WORKFLOW_SEMANTICS);
  const docPath = join(repoRoot, GENERATED_DOC);
  if (!existsSync(docPath) || readFileSync(docPath, "utf8") !== expectedDoc) {
    findings.push(
      finding(
        "WF-DOC-PROJECTION",
        GENERATED_DOC,
        "generated semantics documentation is missing or stale",
        "run pnpm check:workflow-semantics --write",
      ),
    );
  }
  return findings;
};

export const writeWorkflowSemanticsDoc = (repoRoot: string): void => {
  const path = join(repoRoot, GENERATED_DOC);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderWorkflowSemanticsMarkdown(WORKFLOW_SEMANTICS));
};

const main = (): void => {
  const repoRoot = resolve(process.cwd());
  if (process.argv.includes("--write")) writeWorkflowSemanticsDoc(repoRoot);
  const findings = checkWorkflowSemantics(repoRoot);
  if (findings.length > 0) {
    for (const item of findings) {
      process.stderr.write(
        `${item.ruleId} ${item.file}: ${item.reason}. Repair: ${item.repair}. Rerun: pnpm check:workflow-semantics\n`,
      );
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `check:workflow-semantics passed (${WORKFLOW_SEMANTICS.length} rules, ${WORKFLOW_GRAPH_FIELDS.length} graph fields)\n`,
  );
};

if (isDirectRun(import.meta.url)) main();
