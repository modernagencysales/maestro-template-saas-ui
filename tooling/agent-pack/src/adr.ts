export type AdrStatus = "proposed" | "accepted" | "rejected" | "superseded";

export type AdrMetadata = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly status: AdrStatus;
  readonly owner: string;
  readonly affectedSystems: readonly string[];
  readonly affectedResources: readonly string[];
  readonly links: readonly string[];
  readonly supersedes: readonly string[];
  readonly supersededBy: string | null;
  readonly migration: string;
  readonly rollback: string;
};

export type AdrRecord = {
  readonly metadata: AdrMetadata;
  readonly context: string;
  readonly decision: string;
  readonly consequences: readonly string[];
};

export type AdrValidationContext = {
  readonly records: readonly AdrRecord[];
  readonly knownSystemIds: readonly string[];
  readonly knownResourceIds: readonly string[];
  readonly existingLinks: readonly string[];
};

export type AdrFinding = {
  readonly code: string;
  readonly message: string;
  readonly repair: string;
};

export type AdrWrite = {
  readonly path: string;
  readonly content: string;
  readonly record: AdrRecord;
};

export type AdrPreview = {
  readonly ok: boolean;
  readonly mutationPosture: "dry-run";
  readonly operation: "create" | "status" | "supersede";
  readonly findings: readonly AdrFinding[];
  readonly writes: readonly AdrWrite[];
};

const finding = (
  code: string,
  message: string,
  repair: string,
): AdrFinding => ({
  code,
  message,
  repair,
});

const stableId = (id: string): boolean =>
  id.length === 8 &&
  id.startsWith("ADR-") &&
  [...id.slice(4)].every((character) => character >= "0" && character <= "9");

const nonempty = (value: string): boolean => value.trim().length > 0;

const duplicates = (values: readonly string[]): readonly string[] => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index)),
];

const validateRecord = (
  record: AdrRecord,
  context: AdrValidationContext,
): AdrFinding[] => {
  const metadata = record.metadata;
  const findings: AdrFinding[] = [];
  if (metadata.schemaVersion !== 1)
    findings.push(
      finding(
        "ADR_SCHEMA_INVALID",
        "ADR schemaVersion must be 1.",
        "Set metadata.schemaVersion to 1.",
      ),
    );
  if (!stableId(metadata.id))
    findings.push(
      finding(
        "ADR_ID_INVALID",
        `ADR ID is not stable: ${metadata.id}`,
        "Use ADR- followed by exactly four digits.",
      ),
    );
  if (!nonempty(metadata.title) || !nonempty(metadata.owner))
    findings.push(
      finding(
        "ADR_METADATA_REQUIRED",
        "ADR title and owner are required.",
        "Provide nonempty structured title and owner fields.",
      ),
    );
  for (const systemId of metadata.affectedSystems) {
    if (!context.knownSystemIds.includes(systemId))
      findings.push(
        finding(
          "ADR_UNKNOWN_SYSTEM",
          `Unknown affected system: ${systemId}`,
          "Use an ID from the injected canonical system catalog.",
        ),
      );
  }
  for (const resourceId of metadata.affectedResources) {
    if (!context.knownResourceIds.includes(resourceId))
      findings.push(
        finding(
          "ADR_UNKNOWN_RESOURCE",
          `Unknown affected resource: ${resourceId}`,
          "Use an ID from the injected canonical resource catalog.",
        ),
      );
  }
  if (metadata.affectedSystems.length + metadata.affectedResources.length === 0)
    findings.push(
      finding(
        "ADR_AFFECTED_SCOPE_REQUIRED",
        "ADR has no affected systems or resources.",
        "Declare at least one known affected system or resource.",
      ),
    );
  for (const link of metadata.links) {
    if (!context.existingLinks.includes(link))
      findings.push(
        finding(
          "ADR_BROKEN_LINK",
          `ADR link does not exist: ${link}`,
          "Use an injected existing repository link.",
        ),
      );
  }
  for (const value of [
    ...duplicates(metadata.affectedSystems),
    ...duplicates(metadata.affectedResources),
    ...duplicates(metadata.links),
    ...duplicates(metadata.supersedes),
  ])
    findings.push(
      finding(
        "ADR_DUPLICATE_REFERENCE",
        `ADR reference is duplicated: ${value}`,
        "Keep each structured reference exactly once.",
      ),
    );
  if (!nonempty(metadata.migration))
    findings.push(
      finding(
        "ADR_MIGRATION_REQUIRED",
        "ADR migration is missing.",
        "Describe the migration or explicitly state that none is required and why.",
      ),
    );
  if (!nonempty(metadata.rollback))
    findings.push(
      finding(
        "ADR_ROLLBACK_REQUIRED",
        "ADR rollback is missing.",
        "Describe the rollback or explicitly state why the decision is irreversible.",
      ),
    );
  return findings;
};

const pathFor = (record: AdrRecord): string => {
  const number = record.metadata.id.slice(4);
  const slug = record.metadata.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `docs/template/adr/${number}-${slug || "decision"}.md`;
};

const render = (record: AdrRecord): string => {
  const metadata = `${JSON.stringify(record.metadata, null, 2)}\n`;
  return `<!-- maestro-adr-metadata\n${metadata}-->\n\n# ${record.metadata.id}: ${record.metadata.title}\n\n## Status\n\n${record.metadata.status}\n\n## Context\n\n${record.context}\n\n## Decision\n\n${record.decision}\n\n## Consequences\n\n${record.consequences.map((item) => `- ${item}`).join("\n")}\n\n## Migration\n\n${record.metadata.migration}\n\n## Rollback\n\n${record.metadata.rollback}\n`;
};

const write = (record: AdrRecord): AdrWrite => ({
  path: pathFor(record),
  content: render(record),
  record,
});

const result = (
  operation: AdrPreview["operation"],
  findings: readonly AdrFinding[],
  writes: readonly AdrWrite[],
): AdrPreview => ({
  ok: findings.length === 0,
  mutationPosture: "dry-run",
  operation,
  findings,
  writes: findings.length === 0 ? writes : [],
});

export const previewAdrCreate = (
  record: AdrRecord,
  context: AdrValidationContext,
): AdrPreview => {
  const findings: AdrFinding[] = [];
  if (
    context.records.some(({ metadata }) => metadata.id === record.metadata.id)
  )
    findings.push(
      finding(
        "ADR_DUPLICATE_ID",
        `ADR ID already exists: ${record.metadata.id}`,
        "Choose the next unused stable ADR ID.",
      ),
    );
  findings.push(...validateRecord(record, context));
  if (
    record.metadata.supersedes.length > 0 ||
    record.metadata.supersededBy !== null
  )
    findings.push(
      finding(
        "ADR_SUPERSESSION_INCONSISTENT",
        "Create cannot establish one-sided supersession links.",
        "Use the supersede operation to update both decisions together.",
      ),
    );
  return result("create", findings, [write(record)]);
};

const transitions: Readonly<Record<AdrStatus, readonly AdrStatus[]>> = {
  proposed: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  superseded: [],
};

export const previewAdrStatus = (
  id: string,
  status: AdrStatus,
  context: AdrValidationContext,
): AdrPreview => {
  const record = context.records.find(({ metadata }) => metadata.id === id);
  if (!record)
    return result(
      "status",
      [
        finding(
          "ADR_ID_NOT_FOUND",
          `ADR does not exist: ${id}`,
          "Use an existing ADR ID.",
        ),
      ],
      [],
    );
  if (!transitions[record.metadata.status].includes(status))
    return result(
      "status",
      [
        finding(
          "ADR_STATUS_TRANSITION_INVALID",
          `ADR status cannot change from ${record.metadata.status} to ${status}.`,
          "Use proposed -> accepted/rejected, or the supersede operation for an accepted ADR.",
        ),
      ],
      [],
    );
  const updated = { ...record, metadata: { ...record.metadata, status } };
  return result("status", validateRecord(updated, context), [write(updated)]);
};

export const validateAdrCatalog = (
  records: readonly AdrRecord[],
  context: Omit<AdrValidationContext, "records">,
): AdrFinding[] => {
  const scoped = { ...context, records };
  const findings = records.flatMap((record) => validateRecord(record, scoped));
  for (const id of duplicates(records.map(({ metadata }) => metadata.id)))
    findings.unshift(
      finding(
        "ADR_DUPLICATE_ID",
        `ADR ID is duplicated: ${id}`,
        "Assign every ADR a unique stable ID.",
      ),
    );
  for (const record of records) {
    const { id, status, supersededBy, supersedes } = record.metadata;
    if (status === "superseded") {
      const successor = records.find(
        ({ metadata }) => metadata.id === supersededBy,
      );
      if (
        !successor ||
        successor.metadata.status !== "accepted" ||
        !successor.metadata.supersedes.includes(id)
      )
        findings.push(
          finding(
            "ADR_SUPERSESSION_INCONSISTENT",
            `ADR ${id} lacks a matching successor link.`,
            "Link an accepted successor in both directions.",
          ),
        );
    } else if (supersededBy !== null) {
      findings.push(
        finding(
          "ADR_SUPERSESSION_INCONSISTENT",
          `ADR ${id} names a successor without superseded status.`,
          "Set superseded status through the supersede operation.",
        ),
      );
    }
    for (const priorId of supersedes) {
      const prior = records.find(({ metadata }) => metadata.id === priorId);
      if (
        !prior ||
        prior.metadata.status !== "superseded" ||
        prior.metadata.supersededBy !== id
      )
        findings.push(
          finding(
            "ADR_SUPERSESSION_INCONSISTENT",
            `ADR ${id} lacks a matching prior decision link.`,
            "Update the prior ADR status and supersededBy link atomically.",
          ),
        );
    }
  }
  return findings;
};

export const previewAdrSupersede = (
  priorId: string,
  successor: AdrRecord,
  context: AdrValidationContext,
): AdrPreview => {
  const prior = context.records.find(({ metadata }) => metadata.id === priorId);
  if (!prior)
    return result(
      "supersede",
      [
        finding(
          "ADR_ID_NOT_FOUND",
          `ADR does not exist: ${priorId}`,
          "Use an existing accepted ADR ID.",
        ),
      ],
      [],
    );
  const findings = validateRecord(successor, context);
  if (prior.metadata.status !== "accepted")
    findings.push(
      finding(
        "ADR_SUPERSEDED_STATUS_INVALID",
        `ADR ${priorId} is not accepted.`,
        "Only an accepted ADR can be superseded.",
      ),
    );
  if (successor.metadata.status !== "accepted")
    findings.push(
      finding(
        "ADR_SUCCESSOR_STATUS_INVALID",
        `Successor ADR ${successor.metadata.id} is not accepted.`,
        "Accept the successor ADR before superseding an existing decision.",
      ),
    );
  if (
    prior.metadata.supersededBy !== null ||
    !successor.metadata.supersedes.includes(priorId) ||
    successor.metadata.supersededBy !== null
  )
    findings.push(
      finding(
        "ADR_SUPERSESSION_INCONSISTENT",
        "Supersession metadata is not bidirectionally consistent.",
        "Use an accepted successor that names the prior ADR exactly once and has no successor of its own.",
      ),
    );
  if (
    context.records.some(
      ({ metadata }) => metadata.id === successor.metadata.id,
    )
  )
    findings.push(
      finding(
        "ADR_DUPLICATE_ID",
        `ADR ID already exists: ${successor.metadata.id}`,
        "Choose the next unused stable ADR ID.",
      ),
    );
  if (findings.length > 0) return result("supersede", findings, []);
  const superseded = {
    ...prior,
    metadata: {
      ...prior.metadata,
      status: "superseded" as const,
      supersededBy: successor.metadata.id,
    },
  };
  const catalog = [
    ...context.records.filter(({ metadata }) => metadata.id !== priorId),
    superseded,
    successor,
  ];
  return result("supersede", validateAdrCatalog(catalog, context), [
    write(superseded),
    write(successor),
  ]);
};
