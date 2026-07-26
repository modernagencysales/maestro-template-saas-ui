import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { AdoptionMode } from "./adopt.js";

export type AdoptionRootProbe = {
  readonly requestedRoot: string;
  readonly resolvedRoot: string;
  readonly worktreeRoot: string | null;
  readonly exists: boolean;
  readonly empty: boolean | null;
  readonly clean: boolean | null;
  readonly revision: string | null;
};

export type AdoptionTemplateAuthority = {
  readonly tag: string;
  readonly commit: string;
  readonly archiveChecksum: string;
  readonly manifestChecksum: string;
};

export type AdoptionAuthorityInput = {
  readonly mode: AdoptionMode;
  readonly sourceReadOnly: true;
  readonly source: AdoptionRootProbe;
  readonly target: AdoptionRootProbe;
  readonly baseline: {
    readonly sourceRevision: string;
    readonly targetRevision: string | null;
  };
  readonly template: AdoptionTemplateAuthority & {
    readonly requestedRoot: string;
    readonly resolvedRoot: string;
  };
  readonly reviewedTemplate: AdoptionTemplateAuthority;
  readonly protectedRoots: readonly {
    readonly label: string;
    readonly resolvedRoot: string;
  }[];
};

export type AdoptionAuthorityFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdoptionAuthorityResult = {
  readonly ok: boolean;
  readonly mutationPosture: "read-only";
  readonly findings: readonly AdoptionAuthorityFinding[];
  readonly authorityFingerprint: string | null;
};

const finding = (
  code: string,
  message: string,
  repair: string,
): AdoptionAuthorityFinding => ({ code, message, repair });

const canonicalAbsolute = (path: string): boolean =>
  isAbsolute(path) && resolve(path) === path && path.trim() === path;

const inside = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return (
    path !== "" &&
    path !== ".." &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
};

const overlaps = (left: string, right: string): boolean =>
  left === right || inside(left, right) || inside(right, left);

const validChecksum = (value: string): boolean =>
  /^sha256:[a-f0-9]{64}$/.test(value);
const validRevision = (value: string | null): value is string =>
  typeof value === "string" &&
  (/^[0-9a-f]{40}$/.test(value) || /^[0-9a-f]{64}$/.test(value));

const validateRootShape = (
  label: "source" | "target",
  probe: AdoptionRootProbe,
): AdoptionAuthorityFinding[] => {
  const findings: AdoptionAuthorityFinding[] = [];
  for (const [name, value] of [
    ["requested", probe.requestedRoot],
    ["resolved", probe.resolvedRoot],
    ...(probe.worktreeRoot === null
      ? []
      : ([["worktree", probe.worktreeRoot]] as const)),
  ] as const)
    if (!canonicalAbsolute(value))
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_ROOT_INVALID",
          `The ${label} ${name} root is not a canonical absolute path.`,
          "Re-probe the root through the reviewed path and realpath boundary.",
        ),
      );
  if (
    !probe.exists &&
    [probe.empty, probe.clean, probe.revision, probe.worktreeRoot].some(
      (value) => value !== null,
    )
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_PROBE_INCONSISTENT",
        `The absent ${label} has existing-root facts.`,
        "Supply null worktree, cleanliness, emptiness, and revision facts for an absent root.",
      ),
    );
  if (probe.exists && probe.empty === null)
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_PROBE_INCONSISTENT",
        `The existing ${label} has no emptiness fact.`,
        "Complete the read-only root probe before launch admission.",
      ),
    );
  return findings;
};

const templateFindings = (
  input: AdoptionAuthorityInput,
): AdoptionAuthorityFinding[] => {
  const findings: AdoptionAuthorityFinding[] = [];
  if (
    !canonicalAbsolute(input.template.requestedRoot) ||
    !canonicalAbsolute(input.template.resolvedRoot)
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_TEMPLATE_ROOT_INVALID",
        "The immutable template release root is not canonical.",
        "Resolve the externally supplied release archive root before admission.",
      ),
    );
  if (
    input.template.tag.trim().length === 0 ||
    !validRevision(input.template.commit)
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_TEMPLATE_MISMATCH",
        "The immutable template tag or commit is empty.",
        "Supply the externally resolved reviewed tag and exact commit.",
      ),
    );
  const fields = [
    "tag",
    "commit",
    "archiveChecksum",
    "manifestChecksum",
  ] as const;
  if (
    fields.some(
      (field) => input.template[field] !== input.reviewedTemplate[field],
    ) ||
    !validChecksum(input.template.archiveChecksum) ||
    !validChecksum(input.template.manifestChecksum)
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_TEMPLATE_MISMATCH",
        "The resolved template release does not match the reviewed immutable binding.",
        "Resolve the exact reviewed tag, commit, archive checksum, and manifest checksum externally.",
      ),
    );
  return findings;
};

export const validateAdoptionAuthority = (
  input: AdoptionAuthorityInput,
): AdoptionAuthorityResult => {
  const findings = [
    ...validateRootShape("source", input.source),
    ...validateRootShape("target", input.target),
    ...templateFindings(input),
  ];
  for (const protectedRoot of input.protectedRoots) {
    if (
      protectedRoot.label.trim().length === 0 ||
      !canonicalAbsolute(protectedRoot.resolvedRoot)
    )
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_PROTECTED_ROOT_INVALID",
          "A protected authority root is missing a label or canonical absolute path.",
          "Supply each protected root from the reviewed canonical realpath boundary.",
        ),
      );
    else if (overlaps(protectedRoot.resolvedRoot, input.target.resolvedRoot))
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_PROTECTED_ROOT",
          `The mutation root overlaps protected root ${protectedRoot.label}.`,
          "Choose a mutation root outside every protected root in both containment directions.",
        ),
      );
  }
  if (!input.sourceReadOnly)
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_SOURCE_MUTABLE",
        "The source application is not bound read-only.",
        "Keep the source read-only and write only to the admitted target.",
      ),
    );
  if (!input.source.exists || input.source.worktreeRoot === null)
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_SOURCE_UNAVAILABLE",
        "The source root or its worktree identity is unavailable.",
        "Probe an existing source and its containing worktree before admission.",
      ),
    );
  else if (!input.source.clean)
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_SOURCE_DIRTY",
        "The source worktree is not clean at its reviewed revision.",
        "Commit or discard source changes, then rebuild the adoption baseline from the exact revision.",
      ),
    );
  else if (!overlaps(input.source.worktreeRoot, input.source.resolvedRoot))
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_WORKTREE_INVALID",
        "The source root is outside its claimed worktree.",
        "Use the worktree identity returned by the reviewed Git boundary.",
      ),
    );
  if (
    !validRevision(input.source.revision) ||
    !validRevision(input.baseline.sourceRevision) ||
    input.source.revision !== input.baseline.sourceRevision
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_SOURCE_STALE",
        "The source revision changed after baseline review.",
        "Rebuild and reapprove the adoption work package from the current source revision.",
      ),
    );
  if (
    overlaps(input.template.requestedRoot, input.source.requestedRoot) ||
    overlaps(input.template.resolvedRoot, input.source.resolvedRoot) ||
    overlaps(input.template.requestedRoot, input.target.requestedRoot) ||
    overlaps(input.template.resolvedRoot, input.target.resolvedRoot)
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_TEMPLATE_OVERLAP",
        "The immutable template release overlaps a source or target root.",
        "Keep source, template release, and customer target as disjoint authority roots.",
      ),
    );

  if (input.mode === "separate-target") {
    if (
      overlaps(input.source.requestedRoot, input.target.requestedRoot) ||
      overlaps(input.source.resolvedRoot, input.target.resolvedRoot)
    )
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_ROOT_OVERLAP",
          "The separate source and target roots overlap.",
          "Choose a disjoint customer target beside the read-only source.",
        ),
      );
    if (input.target.exists) {
      if (!input.target.empty)
        findings.push(
          finding(
            "ADOPTION_AUTHORITY_TARGET_NOT_EMPTY",
            "The separate target is not empty.",
            "Choose an absent or empty target; never overwrite ambiguous content.",
          ),
        );
      if (!input.target.clean)
        findings.push(
          finding(
            "ADOPTION_AUTHORITY_TARGET_DIRTY",
            "The existing target worktree is dirty.",
            "Use a clean target worktree before launch.",
          ),
        );
      if (input.target.worktreeRoot !== input.target.resolvedRoot)
        findings.push(
          finding(
            "ADOPTION_AUTHORITY_WORKTREE_INVALID",
            "The target does not exactly match its claimed worktree root.",
            "Create or select a clean dedicated target worktree.",
          ),
        );
    }
    if (input.target.revision !== input.baseline.targetRevision)
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_TARGET_STALE",
          "The target revision changed after baseline review.",
          "Re-probe and reapprove the target before launch.",
        ),
      );
    if (
      input.target.exists &&
      (!validRevision(input.target.revision) ||
        !validRevision(input.baseline.targetRevision))
    )
      findings.push(
        finding(
          "ADOPTION_AUTHORITY_TARGET_REVISION_INVALID",
          "The existing target is not bound to an exact Git revision.",
          "Re-probe the clean target and bind its exact lowercase SHA-1 or SHA-256 commit.",
        ),
      );
  } else if (
    input.source.requestedRoot !== input.target.requestedRoot ||
    input.source.resolvedRoot !== input.target.resolvedRoot ||
    input.source.worktreeRoot !== input.target.worktreeRoot ||
    !input.source.clean ||
    !input.target.clean ||
    input.source.revision !== input.target.revision ||
    input.target.revision !== input.baseline.targetRevision
  )
    findings.push(
      finding(
        "ADOPTION_AUTHORITY_IN_PLACE_UNSAFE",
        "In-place launch lacks one exact clean root, worktree, and revision identity.",
        "Re-probe one clean exact worktree and retain the approved rollback contract.",
      ),
    );

  const authority = {
    mode: input.mode,
    source: input.source,
    target: input.target,
    baseline: input.baseline,
    template: input.template,
    protectedRoots: input.protectedRoots,
  };
  return {
    ok: findings.length === 0,
    mutationPosture: "read-only",
    findings,
    authorityFingerprint:
      findings.length === 0
        ? `sha256:${createHash("sha256").update(JSON.stringify(authority)).digest("hex")}`
        : null,
  };
};
