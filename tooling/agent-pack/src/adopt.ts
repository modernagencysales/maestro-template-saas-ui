import { isAbsolute, relative, resolve } from "node:path";

export type AdoptionDisposition = "preserve" | "port" | "replace" | "delete";
export type AdoptionMode = "separate-target" | "in-place";

type WorktreeFacts = { readonly clean: boolean; readonly revision: string };
type Mapping = {
  readonly source: string;
  readonly target: string;
  readonly rule: string;
};

export type AdoptionWorkPackage = {
  readonly $schema: "https://maestro.local/schemas/maestro-adoption-work-package.schema.json";
  readonly schemaVersion: 1;
  readonly id: string;
  readonly mode: AdoptionMode;
  readonly sourceReadOnly: true;
  readonly roots: {
    readonly source: string;
    readonly target: string;
    readonly sourceWorktree: string;
    readonly targetWorktree: string;
  };
  readonly worktrees: {
    readonly source: WorktreeFacts;
    readonly target: WorktreeFacts;
  };
  readonly baseline: {
    readonly sourceEvidence: readonly string[];
    readonly targetEvidence: readonly string[];
  };
  readonly editableBoundaries: readonly string[];
  readonly mappings: {
    readonly identity: readonly Mapping[];
    readonly tenant: readonly Mapping[];
    readonly data: readonly Mapping[];
  };
  readonly compatibility: {
    readonly template: string;
    readonly agentPack: string;
    readonly requirements: readonly string[];
  };
  readonly decisions: readonly {
    readonly path: string;
    readonly disposition: AdoptionDisposition;
    readonly rationale: string;
  }[];
  readonly cutover: {
    readonly strategy: string;
    readonly steps: readonly string[];
    readonly readinessEvidence: readonly string[];
  };
  readonly deletion: {
    readonly timing: "never" | "after-approved-cutover" | "during-adoption";
    readonly paths: readonly string[];
  };
  readonly approval: {
    readonly status: "pending" | "approved";
    readonly approverClass: string;
    readonly evidence: string | null;
  };
  readonly rollback: {
    readonly strategy: string;
    readonly evidence: string;
    readonly restoresSource: boolean;
  };
  readonly inPlace: { readonly justification: string | null };
};

export type AdoptionFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdoptionPreview = {
  readonly ok: boolean;
  readonly mutationPosture: "dry-run";
  readonly findings: readonly AdoptionFinding[];
  readonly artifact: { readonly path: string; readonly content: string } | null;
};

type PreflightInput = Pick<
  AdoptionWorkPackage,
  | "mode"
  | "sourceReadOnly"
  | "roots"
  | "worktrees"
  | "editableBoundaries"
  | "rollback"
  | "inPlace"
>;

const finding = (
  code: string,
  message: string,
  repair: string,
): AdoptionFinding => ({ code, message, repair });

const text = (value: string): boolean => value.trim().length > 0;
const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const normalized = (path: string): string | null =>
  isAbsolute(path) ? resolve(path) : null;

const contains = (parent: string, child: string): boolean => {
  const result = relative(parent, child);
  return (
    result !== "" &&
    result !== ".." &&
    !result.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(result)
  );
};

const overlaps = (left: string, right: string): boolean =>
  left === right || contains(left, right) || contains(right, left);

const validPath = (path: string): boolean =>
  text(path) &&
  !isAbsolute(path) &&
  !path.includes("\\") &&
  !path.split("/").includes("..");

const extraKeys = (
  value: object,
  allowed: readonly string[],
  label: string,
): AdoptionFinding[] =>
  Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) =>
      finding(
        "ADOPTION_SCHEMA_CLOSED",
        `${label} contains unknown field: ${key}`,
        "Remove fields that are not declared by the adoption work-package schema.",
      ),
    );

const closedSchemaFindings = (
  input: AdoptionWorkPackage,
): AdoptionFinding[] => [
  ...extraKeys(
    input,
    [
      "$schema",
      "schemaVersion",
      "id",
      "mode",
      "sourceReadOnly",
      "roots",
      "worktrees",
      "baseline",
      "editableBoundaries",
      "mappings",
      "compatibility",
      "decisions",
      "cutover",
      "deletion",
      "approval",
      "rollback",
      "inPlace",
    ],
    "work package",
  ),
  ...extraKeys(
    input.roots,
    ["source", "target", "sourceWorktree", "targetWorktree"],
    "roots",
  ),
  ...extraKeys(input.worktrees, ["source", "target"], "worktrees"),
  ...extraKeys(
    input.worktrees.source,
    ["clean", "revision"],
    "source worktree",
  ),
  ...extraKeys(
    input.worktrees.target,
    ["clean", "revision"],
    "target worktree",
  ),
  ...extraKeys(
    input.baseline,
    ["sourceEvidence", "targetEvidence"],
    "baseline",
  ),
  ...extraKeys(input.mappings, ["identity", "tenant", "data"], "mappings"),
  ...Object.entries(input.mappings).flatMap(([kind, mappings]) =>
    mappings.flatMap((mapping) =>
      extraKeys(mapping, ["source", "target", "rule"], `${kind} mapping`),
    ),
  ),
  ...extraKeys(
    input.compatibility,
    ["template", "agentPack", "requirements"],
    "compatibility",
  ),
  ...input.decisions.flatMap((decision) =>
    extraKeys(decision, ["path", "disposition", "rationale"], "decision"),
  ),
  ...extraKeys(
    input.cutover,
    ["strategy", "steps", "readinessEvidence"],
    "cutover",
  ),
  ...extraKeys(input.deletion, ["timing", "paths"], "deletion"),
  ...extraKeys(
    input.approval,
    ["status", "approverClass", "evidence"],
    "approval",
  ),
  ...extraKeys(
    input.rollback,
    ["strategy", "evidence", "restoresSource"],
    "rollback",
  ),
  ...extraKeys(input.inPlace, ["justification"], "inPlace"),
];

const preflightFindings = (input: PreflightInput): AdoptionFinding[] => {
  const findings: AdoptionFinding[] = [];
  const source = normalized(input.roots.source);
  const target = normalized(input.roots.target);
  const sourceWorktree = normalized(input.roots.sourceWorktree);
  const targetWorktree = normalized(input.roots.targetWorktree);
  if (!source || !target || !sourceWorktree || !targetWorktree)
    findings.push(
      finding(
        "ADOPTION_ROOT_INVALID",
        "Adoption roots and worktrees must be absolute.",
        "Supply caller-resolved absolute source, target, and worktree roots.",
      ),
    );
  if (input.sourceReadOnly !== true)
    findings.push(
      finding(
        "ADOPTION_SOURCE_NOT_READ_ONLY",
        "The source is not declared read-only.",
        "Keep the existing app read-only during planning.",
      ),
    );
  if (source && target && input.mode === "separate-target") {
    if (source === target)
      findings.push(
        finding(
          "ADOPTION_SAME_ROOT",
          "Separate-target adoption cannot use the source root as its target.",
          "Choose a separate clean target or explicitly request reviewed in-place adoption.",
        ),
      );
    else if (overlaps(source, target))
      findings.push(
        finding(
          "ADOPTION_ROOTS_OVERLAP",
          "Source and target roots overlap.",
          "Choose disjoint source and target roots.",
        ),
      );
    if (!input.worktrees.target.clean)
      findings.push(
        finding(
          "ADOPTION_TARGET_DIRTY",
          "The separate target worktree is dirty.",
          "Use a clean target worktree before planning adoption.",
        ),
      );
    if (
      sourceWorktree &&
      targetWorktree &&
      overlaps(sourceWorktree, targetWorktree) &&
      (!input.worktrees.source.clean || !input.worktrees.target.clean)
    )
      findings.push(
        finding(
          "ADOPTION_DIRTY_OVERLAP",
          "Dirty source and target worktree boundaries overlap.",
          "Use disjoint worktrees or clean the reviewed in-place worktree.",
        ),
      );
  }
  if (source && target && input.mode === "in-place") {
    if (
      source !== target ||
      sourceWorktree !== targetWorktree ||
      !input.worktrees.source.clean ||
      !input.worktrees.target.clean
    )
      findings.push(
        finding(
          "ADOPTION_IN_PLACE_UNSAFE",
          "In-place adoption requires one clean exact root and worktree.",
          "Use equal resolved roots, a clean worktree, and a reviewed baseline.",
        ),
      );
    if (!input.inPlace.justification || !text(input.inPlace.justification))
      findings.push(
        finding(
          "ADOPTION_IN_PLACE_JUSTIFICATION_REQUIRED",
          "In-place adoption lacks a justification.",
          "Explain why a separate target is not appropriate.",
        ),
      );
    if (input.editableBoundaries.length === 0)
      findings.push(
        finding(
          "ADOPTION_EDITABLE_BOUNDARY_REQUIRED",
          "In-place adoption has no editable boundary.",
          "Declare at least one bounded editable target path.",
        ),
      );
  }
  if (!text(input.rollback.strategy) || !text(input.rollback.evidence))
    findings.push(
      finding(
        "ADOPTION_ROLLBACK_REQUIRED",
        "Adoption rollback strategy and evidence are required.",
        "Provide a tested rollback strategy and evidence location.",
      ),
    );
  return findings;
};

const packageFindings = (input: AdoptionWorkPackage): AdoptionFinding[] => {
  const findings = [
    ...closedSchemaFindings(input),
    ...preflightFindings(input),
  ];
  if (!text(input.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id))
    findings.push(
      finding(
        "ADOPTION_ID_INVALID",
        "Adoption work-package ID is not stable.",
        "Use a nonempty lowercase kebab-case ID supplied by the caller.",
      ),
    );
  const evidence = [
    ...input.baseline.sourceEvidence,
    ...input.baseline.targetEvidence,
    ...input.cutover.readinessEvidence,
  ];
  if (evidence.some((value) => !validPath(value)) || evidence.length < 3)
    findings.push(
      finding(
        "ADOPTION_BASELINE_INCOMPLETE",
        "Baseline or cutover evidence is missing or unsafe.",
        "Provide relative source, target, and cutover evidence locations.",
      ),
    );
  if (
    input.editableBoundaries.some((value) => !validPath(value)) ||
    !unique(input.editableBoundaries)
  )
    findings.push(
      finding(
        "ADOPTION_EDITABLE_BOUNDARY_INVALID",
        "Editable boundaries are unsafe or duplicated.",
        "Provide unique relative target boundaries without traversal.",
      ),
    );
  for (const [kind, mappings] of Object.entries(input.mappings)) {
    if (
      mappings.length === 0 ||
      mappings.some(
        ({ source, target, rule }) =>
          !text(source) || !text(target) || !text(rule),
      )
    )
      findings.push(
        finding(
          "ADOPTION_MAPPING_REQUIRED",
          `${kind} mapping is incomplete.`,
          `Supply explicit source, target, and rule fields for ${kind}.`,
        ),
      );
  }
  if (
    !text(input.compatibility.template) ||
    !text(input.compatibility.agentPack) ||
    input.compatibility.requirements.length === 0
  )
    findings.push(
      finding(
        "ADOPTION_COMPATIBILITY_REQUIRED",
        "Compatibility facts are incomplete.",
        "Declare template, Agent Pack, and runtime compatibility requirements.",
      ),
    );
  const dispositions = new Set(["preserve", "port", "replace", "delete"]);
  if (
    input.decisions.length === 0 ||
    input.decisions.some(
      ({ path, disposition, rationale }) =>
        !validPath(path) || !dispositions.has(disposition) || !text(rationale),
    )
  )
    findings.push(
      finding(
        "ADOPTION_DISPOSITION_INVALID",
        "A caller-supplied preserve/port/replace/delete decision is missing or invalid.",
        "Supply each path, disposition, and rationale explicitly; the tool will not infer them.",
      ),
    );
  if (
    !text(input.cutover.strategy) ||
    input.cutover.steps.length === 0 ||
    !text(input.approval.approverClass)
  )
    findings.push(
      finding(
        "ADOPTION_CUTOVER_INCOMPLETE",
        "Cutover or approval fields are incomplete.",
        "Declare cutover strategy, steps, readiness evidence, and approver class.",
      ),
    );
  const deletes = input.decisions.filter(
    ({ disposition }) => disposition === "delete",
  );
  if (
    input.deletion.timing === "during-adoption" ||
    (deletes.length > 0 &&
      (input.deletion.timing !== "after-approved-cutover" ||
        input.approval.status !== "approved" ||
        !input.approval.evidence ||
        !input.rollback.restoresSource ||
        deletes.some(({ path }) => !input.deletion.paths.includes(path))))
  )
    findings.push(
      finding(
        "ADOPTION_DELETION_DESTRUCTIVE",
        "Deletion is not deferred behind approved cutover and restorable rollback.",
        "Defer exact caller-approved delete paths until after cutover, with approval evidence and source restoration.",
      ),
    );
  return findings;
};

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

export const previewAdoptionPreflight = (
  input: PreflightInput,
): AdoptionPreview => {
  const findings = preflightFindings(input);
  return {
    ok: findings.length === 0,
    mutationPosture: "dry-run",
    findings,
    artifact: null,
  };
};

export const previewAdoptionWorkPackage = (
  input: AdoptionWorkPackage,
): AdoptionPreview => {
  const findings = packageFindings(input);
  return {
    ok: findings.length === 0,
    mutationPosture: "dry-run",
    findings,
    artifact:
      findings.length === 0
        ? {
            path: `adoption/${input.id}.work-package.json`,
            content: `${JSON.stringify(canonical(input), null, 2)}\n`,
          }
        : null,
  };
};
