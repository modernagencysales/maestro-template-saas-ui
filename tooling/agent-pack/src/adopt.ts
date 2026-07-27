import { isAbsolute, relative, resolve } from "node:path";

export type AdoptionDisposition = "preserve" | "port" | "replace" | "delete";
export type AdoptionMode = "separate-target" | "in-place";

type WorktreeFacts = {
  readonly exists: boolean;
  readonly clean: boolean | null;
  readonly revision: string | null;
};
type ImmutableTemplateBinding = {
  readonly tag: string;
  readonly commit: string;
  readonly archiveChecksum: string;
  readonly manifestChecksum: string;
};
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
    readonly targetWorktree: string | null;
  };
  readonly worktrees: {
    readonly source: WorktreeFacts;
    readonly target: WorktreeFacts;
  };
  readonly authority: {
    readonly fingerprint: string;
    readonly template: ImmutableTemplateBinding;
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

const relativeContains = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(`${parent}/`);
const hasPathOverlap = (paths: readonly string[]): boolean =>
  paths.some((path, index) =>
    paths.some(
      (candidate, candidateIndex) =>
        index !== candidateIndex &&
        (relativeContains(path, candidate) ||
          relativeContains(candidate, path)),
    ),
  );

const validPath = (path: string): boolean =>
  text(path) &&
  path === path.trim() &&
  !isAbsolute(path) &&
  !path.includes("\\") &&
  !path.includes("//") &&
  !path.endsWith("/") &&
  !path
    .split("/")
    .some(
      (part) =>
        part === "." ||
        part === ".." ||
        [...part].some(
          (character) =>
            character.charCodeAt(0) <= 0x20 || character.charCodeAt(0) === 0x7f,
        ),
    );
const validChecksum = (value: string): boolean =>
  /^sha256:[a-f0-9]{64}$/.test(value);
const validRevision = (value: string): boolean =>
  /^[0-9a-f]{40}$/.test(value) || /^[0-9a-f]{64}$/.test(value);

type RuntimeShape =
  | { readonly kind: "literal"; readonly value: unknown }
  | { readonly kind: "string"; readonly values?: readonly string[] }
  | { readonly kind: "boolean" }
  | { readonly kind: "nullable"; readonly item: RuntimeShape }
  | {
      readonly kind: "array";
      readonly item: RuntimeShape;
      readonly minItems?: number;
    }
  | {
      readonly kind: "object";
      readonly fields: Readonly<Record<string, RuntimeShape>>;
    };

const stringShape = { kind: "string" } as const;
const stringArray = { kind: "array", item: stringShape } as const;
const nonemptyStringArray = {
  kind: "array",
  item: stringShape,
  minItems: 1,
} as const;
const mappingShape: RuntimeShape = {
  kind: "object",
  fields: { source: stringShape, target: stringShape, rule: stringShape },
};
const worktreeShape: RuntimeShape = {
  kind: "object",
  fields: {
    exists: { kind: "boolean" },
    clean: { kind: "nullable", item: { kind: "boolean" } },
    revision: { kind: "nullable", item: stringShape },
  },
};
const adoptionShape: RuntimeShape = {
  kind: "object",
  fields: {
    $schema: {
      kind: "literal",
      value:
        "https://maestro.local/schemas/maestro-adoption-work-package.schema.json",
    },
    schemaVersion: { kind: "literal", value: 1 },
    id: stringShape,
    mode: {
      kind: "string",
      values: ["separate-target", "in-place"],
    },
    sourceReadOnly: { kind: "literal", value: true },
    roots: {
      kind: "object",
      fields: {
        source: stringShape,
        target: stringShape,
        sourceWorktree: stringShape,
        targetWorktree: { kind: "nullable", item: stringShape },
      },
    },
    worktrees: {
      kind: "object",
      fields: { source: worktreeShape, target: worktreeShape },
    },
    authority: {
      kind: "object",
      fields: {
        fingerprint: stringShape,
        template: {
          kind: "object",
          fields: {
            tag: stringShape,
            commit: stringShape,
            archiveChecksum: stringShape,
            manifestChecksum: stringShape,
          },
        },
      },
    },
    baseline: {
      kind: "object",
      fields: {
        sourceEvidence: nonemptyStringArray,
        targetEvidence: nonemptyStringArray,
      },
    },
    editableBoundaries: stringArray,
    mappings: {
      kind: "object",
      fields: {
        identity: { kind: "array", item: mappingShape, minItems: 1 },
        tenant: { kind: "array", item: mappingShape, minItems: 1 },
        data: { kind: "array", item: mappingShape, minItems: 1 },
      },
    },
    compatibility: {
      kind: "object",
      fields: {
        template: stringShape,
        agentPack: stringShape,
        requirements: nonemptyStringArray,
      },
    },
    decisions: {
      kind: "array",
      minItems: 1,
      item: {
        kind: "object",
        fields: {
          path: stringShape,
          disposition: {
            kind: "string",
            values: ["preserve", "port", "replace", "delete"],
          },
          rationale: stringShape,
        },
      },
    },
    cutover: {
      kind: "object",
      fields: {
        strategy: stringShape,
        steps: nonemptyStringArray,
        readinessEvidence: nonemptyStringArray,
      },
    },
    deletion: {
      kind: "object",
      fields: {
        timing: {
          kind: "string",
          values: ["never", "after-approved-cutover", "during-adoption"],
        },
        paths: stringArray,
      },
    },
    approval: {
      kind: "object",
      fields: {
        status: { kind: "string", values: ["pending", "approved"] },
        approverClass: stringShape,
        evidence: { kind: "nullable", item: stringShape },
      },
    },
    rollback: {
      kind: "object",
      fields: {
        strategy: stringShape,
        evidence: stringShape,
        restoresSource: { kind: "boolean" },
      },
    },
    inPlace: {
      kind: "object",
      fields: {
        justification: { kind: "nullable", item: stringShape },
      },
    },
  },
};

const schemaInvalid = (path: string, expected: string): AdoptionFinding =>
  finding(
    "ADOPTION_SCHEMA_INVALID",
    `${path} must be ${expected}.`,
    "Supply every required field with the exact type declared by the closed adoption schema.",
  );

const validateRuntimeShape = (
  value: unknown,
  shape: RuntimeShape,
  path = "work package",
): AdoptionFinding[] => {
  if (shape.kind === "literal")
    return value === shape.value
      ? []
      : [schemaInvalid(path, JSON.stringify(shape.value))];
  if (shape.kind === "string")
    return typeof value === "string" &&
      (!shape.values || shape.values.includes(value))
      ? []
      : [schemaInvalid(path, shape.values?.join(" | ") ?? "a string")];
  if (shape.kind === "boolean")
    return typeof value === "boolean" ? [] : [schemaInvalid(path, "boolean")];
  if (shape.kind === "nullable")
    return value === null ? [] : validateRuntimeShape(value, shape.item, path);
  if (shape.kind === "array")
    return Array.isArray(value)
      ? [
          ...(shape.minItems !== undefined && value.length < shape.minItems
            ? [
                schemaInvalid(
                  path,
                  `an array with at least ${shape.minItems} item`,
                ),
              ]
            : []),
          ...value.flatMap((item, index) =>
            validateRuntimeShape(item, shape.item, `${path}[${index}]`),
          ),
        ]
      : [schemaInvalid(path, "an array")];
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return [schemaInvalid(path, "an object")];
  const object = value as Record<string, unknown>;
  const hasOwn = (subject: object, key: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(subject, key);
  const findings = Object.keys(object)
    .filter((key) => !hasOwn(shape.fields, key))
    .map((key) =>
      finding(
        "ADOPTION_SCHEMA_CLOSED",
        `${path} contains unknown field: ${key}`,
        "Remove fields that are not declared by the adoption work-package schema.",
      ),
    );
  for (const [key, field] of Object.entries(shape.fields)) {
    findings.push(
      ...(hasOwn(object, key)
        ? validateRuntimeShape(object[key], field, `${path}.${key}`)
        : [schemaInvalid(`${path}.${key}`, "present")]),
    );
  }
  return findings;
};

const preflightFindings = (input: PreflightInput): AdoptionFinding[] => {
  const findings: AdoptionFinding[] = [];
  const source = normalized(input.roots.source);
  const target = normalized(input.roots.target);
  const sourceWorktree = normalized(input.roots.sourceWorktree);
  const targetWorktree =
    input.roots.targetWorktree === null
      ? null
      : normalized(input.roots.targetWorktree);
  if (
    !source ||
    !target ||
    !sourceWorktree ||
    (input.roots.targetWorktree !== null && !targetWorktree)
  )
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
    if (input.worktrees.target.exists && input.worktrees.target.clean !== true)
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
    if (!input.rollback.restoresSource)
      findings.push(
        finding(
          "ADOPTION_IN_PLACE_ROLLBACK_UNSAFE",
          "In-place adoption rollback does not restore the source.",
          "Require rollback.restoresSource=true before approving in-place adoption.",
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
  const findings = preflightFindings(input);
  if (
    !input.worktrees.source.exists ||
    input.worktrees.source.clean !== true ||
    input.worktrees.source.revision === null ||
    !validRevision(input.worktrees.source.revision) ||
    (input.worktrees.target.exists
      ? input.roots.targetWorktree === null ||
        input.worktrees.target.clean !== true ||
        input.worktrees.target.revision === null ||
        !validRevision(input.worktrees.target.revision)
      : input.roots.targetWorktree !== null ||
        input.worktrees.target.clean !== null ||
        input.worktrees.target.revision !== null ||
        input.mode === "in-place")
  )
    findings.push(
      finding(
        "ADOPTION_WORKTREE_BINDING_INVALID",
        "The work package is not bound to exact clean source and target revisions.",
        "Rebuild the package from clean worktrees at lowercase SHA-1 or SHA-256 revisions.",
      ),
    );
  if (
    !validChecksum(input.authority.fingerprint) ||
    !text(input.authority.template.tag) ||
    !validRevision(input.authority.template.commit) ||
    !validChecksum(input.authority.template.archiveChecksum) ||
    !validChecksum(input.authority.template.manifestChecksum)
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_BINDING_INVALID",
        "The work package lacks an exact launch-authority and immutable template binding.",
        "Bind the computed authority fingerprint and reviewed template tag, commit, archive checksum, and manifest checksum.",
      ),
    );
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
    !unique(input.editableBoundaries) ||
    hasPathOverlap(input.editableBoundaries)
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
    const remainingPaths = [
      ...input.deletion.paths,
      input.rollback.evidence,
      ...(input.approval.evidence === null ? [] : [input.approval.evidence]),
    ];
    if (remainingPaths.some((value) => !validPath(value)))
      findings.push(
        finding(
          "ADOPTION_PATH_INVALID",
          "Adoption evidence or deletion paths are not canonical POSIX relative paths.",
          "Use nonempty POSIX relative paths without aliases, whitespace, controls, traversal, or repeated separators.",
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
  const decisionPaths = input.decisions.map(({ path }) => path);
  if (!unique(decisionPaths) || hasPathOverlap(decisionPaths))
    findings.push(
      finding(
        "ADOPTION_DISPOSITION_OVERLAP",
        "Adoption decisions contain duplicate or ancestor/descendant paths.",
        "Use disjoint exact paths so no preserve, port, replace, or delete operation can overlap another.",
      ),
    );
  if (
    input.mode === "in-place" &&
    decisionPaths.some(
      (path) =>
        !input.editableBoundaries.some((boundary) =>
          relativeContains(boundary, path),
        ),
    )
  )
    findings.push(
      finding(
        "ADOPTION_EDITABLE_BOUNDARY_VIOLATION",
        "An in-place adoption decision is outside every reviewed editable boundary.",
        "Move the decision under one exact editable boundary or use a separate target.",
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
  const deletes = input.decisions
    .filter(({ disposition }) => disposition === "delete")
    .map(({ path }) => path);
  const declaredDeletes = input.deletion.paths;
  if (
    !unique(declaredDeletes) ||
    deletes.length !== declaredDeletes.length ||
    deletes.some((path) => !declaredDeletes.includes(path)) ||
    declaredDeletes.some((path) => !deletes.includes(path))
  )
    findings.push(
      finding(
        "ADOPTION_DELETION_SET_MISMATCH",
        "Deletion paths do not exactly match caller delete decisions.",
        "Declare each delete decision path exactly once and no additional deletion paths.",
      ),
    );
  if (
    input.deletion.timing === "during-adoption" ||
    (deletes.length > 0 &&
      (input.deletion.timing !== "after-approved-cutover" ||
        input.approval.status !== "approved" ||
        !input.approval.evidence ||
        !input.rollback.restoresSource))
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
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            )
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

export const previewAdoptionPreflight = (input: unknown): AdoptionPreview => {
  const schemaFindings = validateRuntimeShape(input, adoptionShape);
  const findings =
    schemaFindings.length === 0
      ? preflightFindings(input as AdoptionWorkPackage)
      : schemaFindings;
  return {
    ok: findings.length === 0,
    mutationPosture: "dry-run",
    findings,
    artifact: null,
  };
};

export const previewAdoptionWorkPackage = (input: unknown): AdoptionPreview => {
  const schemaFindings = validateRuntimeShape(input, adoptionShape);
  if (schemaFindings.length > 0)
    return {
      ok: false,
      mutationPosture: "dry-run",
      findings: schemaFindings,
      artifact: null,
    };
  const workPackage = input as AdoptionWorkPackage;
  const findings = packageFindings(workPackage);
  return {
    ok: findings.length === 0,
    mutationPosture: "dry-run",
    findings,
    artifact:
      findings.length === 0
        ? {
            path: `adoption/${workPackage.id}.work-package.json`,
            content: `${JSON.stringify(canonical(workPackage), null, 2)}\n`,
          }
        : null,
  };
};
