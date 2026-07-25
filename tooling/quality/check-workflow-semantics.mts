import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  WORKFLOW_GRAPH_FIELDS,
  WORKFLOW_SEMANTICS,
  renderWorkflowSemanticsMarkdown,
  validateWorkflowSemantics,
} from "@maestro-template/template-core/workflow-semantics";
import { isDirectRun } from "./src/direct-run.mts";

const GENERATED_DOC = "docs/template/generated/workflow-semantics.md";
const SCHEMA_FILES = {
  graph: "packages/convex/confect/workflows/graphSchema.ts",
  node: "packages/convex/confect/workflows/graphNodeSchema.ts",
  edge: "packages/convex/confect/workflows/graphEdgeSchema.ts",
  join: "packages/convex/confect/workflows/graphJoinSchema.ts",
} as const;

const RAW_IMPORT_ALLOWLIST = [
  /^packages\/convex\/confect\/workflowRunners\/[A-Za-z][A-Za-z0-9]*\.ts$/,
  /^packages\/convex\/confect\/workflows\/_kit\/(?:ownership|status)\.ts$/,
  /^packages\/convex\/test\/workflow-conformance(?:-helpers)?\.test\.ts$/,
] as const;

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

const structFields = (source: string, name: string): readonly string[] => {
  const marker = `${name} = S.Struct({`;
  const start = source.indexOf(marker);
  if (start < 0) return [];
  let depth = 1;
  let cursor = start + marker.length;
  const bodyStart = cursor;
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") depth -= 1;
    cursor += 1;
  }
  const body = source.slice(bodyStart, cursor - 1);
  return [...body.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)]
    .map((match) => match[1])
    .filter((field): field is string => field !== undefined);
};

export const readWorkflowGraphFields = (
  repoRoot: string,
): readonly string[] => {
  const read = (key: keyof typeof SCHEMA_FILES) =>
    readFileSync(join(repoRoot, SCHEMA_FILES[key]), "utf8");
  const graph = structFields(read("graph"), "DurableWorkflowGraph");
  const node = structFields(read("node"), "WorkflowNode").map(
    (field) => `nodes[].${field}`,
  );
  const retry = structFields(read("node"), "WorkflowRetryConfig").map(
    (field) => `nodes[].retry.${field}`,
  );
  const edge = structFields(read("edge"), "WorkflowEdge").map(
    (field) => `edges[].${field}`,
  );
  const condition = structFields(read("edge"), "WorkflowCondition").map(
    (field) => `edges[].condition.${field}`,
  );
  const joinFields = structFields(read("join"), "WorkflowJoin").map(
    (field) => `joins[].${field}`,
  );
  return [...graph, ...node, ...retry, ...edge, ...condition, ...joinFields];
};

export const validateWorkflowRunnerSource = (
  file: string,
  source: string,
): readonly WorkflowSemanticFinding[] => {
  const findings: WorkflowSemanticFinding[] = [];
  const importsRawWorkflow = /from\s+["']@convex-dev\/workflow["']/.test(
    source,
  );
  if (
    importsRawWorkflow &&
    !RAW_IMPORT_ALLOWLIST.some((allowed) => allowed.test(file))
  ) {
    findings.push(
      finding(
        "WF-RAW-IMPORT",
        file,
        "raw Workflow primitives are allowed only in generated Confect runners and pinned compatibility fixtures",
        "use the generated workflow kit, then rerun pnpm check:workflow:fast",
      ),
    );
  }
  if (/\bnew\s+WorkflowManager\s*\(/.test(source)) {
    findings.push(
      finding(
        "WF-RAW-MANAGER",
        file,
        "application code instantiated a second WorkflowManager",
        "use the generated workflow manager boundary, then rerun pnpm check:workflow:fast",
      ),
    );
  }
  const isReplayHandler =
    file.includes("/workflowRunners/") ||
    /define(?:Maestro)?Workflow[\s\S]*\.handler\s*\(/.test(source);
  for (const [ruleId, pattern, reason] of [
    ["WF-HANDLER-IO", /\bfetch\s*\(/, "ambient network I/O"],
    ["WF-HANDLER-ENV", /\bprocess\.env\b/, "ambient environment access"],
    [
      "WF-HANDLER-CRYPTO",
      /\bcrypto\.(?:randomUUID|getRandomValues)\b/,
      "ambient cryptographic randomness",
    ],
    [
      "WF-HANDLER-INTL",
      /\bIntl\.|\.toLocale(?:String|DateString|TimeString)\s*\(/,
      "locale-sensitive computation",
    ],
  ] as const) {
    if (isReplayHandler && pattern.test(source)) {
      findings.push(
        finding(
          ruleId,
          file,
          `${reason} is forbidden in a replay handler`,
          "move the operation into a capability step, then rerun pnpm check:workflow:fast",
        ),
      );
    }
  }
  return findings;
};

const sourceFiles = (root: string): readonly string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));
};

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
  const actualFields = readWorkflowGraphFields(repoRoot);
  for (const field of new Set([...WORKFLOW_GRAPH_FIELDS, ...actualFields])) {
    if (
      !WORKFLOW_GRAPH_FIELDS.includes(
        field as (typeof WORKFLOW_GRAPH_FIELDS)[number],
      )
    ) {
      findings.push(
        finding(
          "WF-GRAPH-UNMAPPED",
          SCHEMA_FILES.graph,
          `graph schema field ${field} has no semantic rule`,
          "classify the field in WORKFLOW_SEMANTICS and add compiler/fixture evidence",
        ),
      );
    } else if (!actualFields.includes(field)) {
      findings.push(
        finding(
          "WF-GRAPH-STALE",
          SCHEMA_FILES.graph,
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
  for (const root of [
    "packages/convex/confect/workflowRunners",
    "packages/convex/convex/workflowRunners",
    "apps",
  ]) {
    for (const absolute of sourceFiles(join(repoRoot, root))) {
      const file = relative(repoRoot, absolute).replaceAll("\\", "/");
      findings.push(
        ...validateWorkflowRunnerSource(file, readFileSync(absolute, "utf8")),
      );
    }
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
