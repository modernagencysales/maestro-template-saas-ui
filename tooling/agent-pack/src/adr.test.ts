import { describe, expect, it } from "vitest";
import {
  previewAdrCreate,
  previewAdrStatus,
  previewAdrSupersede,
  validateAdrCatalog,
  type AdrRecord,
  type AdrValidationContext,
} from "./adr.js";

const accepted = (id: string): AdrRecord => ({
  metadata: {
    schemaVersion: 1,
    id,
    title: "Keep one workflow authority",
    status: "accepted",
    owner: "architecture",
    affectedSystems: ["workflow-runtime"],
    affectedResources: ["workflowRuns"],
    links: ["docs/template/workflow-authoring-guide.md"],
    supersedes: [],
    supersededBy: null,
    migration: "Keep existing runs on their published version.",
    rollback: "Restore the prior compiler mapping and rerun focused gates.",
  },
  context: "Two authorities would make replay ambiguous.",
  decision: "Compile Maestro workflows to the canonical runtime.",
  consequences: ["Published versions remain immutable."],
});

const context = (records: readonly AdrRecord[] = []): AdrValidationContext => ({
  records,
  knownSystemIds: ["workflow-runtime", "app-map"],
  knownResourceIds: ["workflowRuns", "workflowArtifacts"],
  existingLinks: [
    "docs/template/workflow-authoring-guide.md",
    "docs/template/promotion-boundary.md",
  ],
});

describe("ADR lifecycle core", () => {
  it("creates the same dry-run document and stable path every time", () => {
    const record = {
      ...accepted("ADR-0003"),
      metadata: {
        ...accepted("ADR-0003").metadata,
        status: "proposed" as const,
        title: "Bind workflow publication identity",
      },
    };

    const first = previewAdrCreate(record, context());
    const second = previewAdrCreate(record, context());

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      operation: "create",
      findings: [],
      writes: [
        {
          path: "docs/template/adr/0003-bind-workflow-publication-identity.md",
        },
      ],
    });
    expect(first.writes[0]?.content).toContain('"id": "ADR-0003"');
    expect(first.writes[0]?.content).toContain("## Migration");
    expect(first.writes[0]?.content).toContain("## Rollback");
  });

  it("fails closed on duplicate IDs, unknown owners, broken links, and missing plans", () => {
    const record = accepted("ADR-0002");
    const invalid: AdrRecord = {
      ...record,
      metadata: {
        ...record.metadata,
        affectedSystems: ["invented-system"],
        affectedResources: ["invented-resource"],
        links: ["docs/missing.md"],
        migration: "",
        rollback: "",
      },
    };

    const result = previewAdrCreate(invalid, context([accepted("ADR-0002")]));

    expect(result.ok).toBe(false);
    expect(result.findings.map(({ code }) => code)).toEqual([
      "ADR_DUPLICATE_ID",
      "ADR_UNKNOWN_SYSTEM",
      "ADR_UNKNOWN_RESOURCE",
      "ADR_BROKEN_LINK",
      "ADR_MIGRATION_REQUIRED",
      "ADR_ROLLBACK_REQUIRED",
    ]);
    expect(result.findings.every(({ repair }) => repair.length > 0)).toBe(true);
    expect(result.writes).toEqual([]);
  });

  it("allows only explicit lifecycle transitions", () => {
    const record = accepted("ADR-0002");
    const proposed = {
      ...record,
      metadata: { ...record.metadata, status: "proposed" as const },
    };

    expect(
      previewAdrStatus("ADR-0002", "accepted", context([proposed])),
    ).toMatchObject({
      ok: true,
      operation: "status",
      writes: [{ record: { metadata: { status: "accepted" } } }],
    });
    expect(
      previewAdrStatus("ADR-0002", "rejected", context([record])),
    ).toMatchObject({
      ok: false,
      findings: [{ code: "ADR_STATUS_TRANSITION_INVALID" }],
    });
    expect(
      previewAdrStatus("ADR-9999", "accepted", context([record])),
    ).toMatchObject({
      ok: false,
      findings: [{ code: "ADR_ID_NOT_FOUND" }],
    });
  });

  it("supersedes an accepted decision with consistent forward and reverse links", () => {
    const prior = accepted("ADR-0002");
    const successor: AdrRecord = {
      ...accepted("ADR-0003"),
      metadata: {
        ...accepted("ADR-0003").metadata,
        supersedes: ["ADR-0002"],
      },
    };

    const result = previewAdrSupersede("ADR-0002", successor, context([prior]));

    expect(result).toMatchObject({
      ok: true,
      operation: "supersede",
      writes: [
        {
          record: {
            metadata: {
              id: "ADR-0002",
              status: "superseded",
              supersededBy: "ADR-0003",
            },
          },
        },
        {
          record: {
            metadata: {
              id: "ADR-0003",
              status: "accepted",
              supersedes: ["ADR-0002"],
            },
          },
        },
      ],
    });
    expect(
      validateAdrCatalog(
        result.writes.map(({ record }) => record),
        context(),
      ),
    ).toEqual([]);
  });

  it("rejects inconsistent supersession declarations", () => {
    const prior = accepted("ADR-0002");
    const successor = accepted("ADR-0003");

    expect(
      previewAdrSupersede("ADR-0002", successor, context([prior])),
    ).toMatchObject({
      ok: false,
      findings: [{ code: "ADR_SUPERSESSION_INCONSISTENT" }],
    });
    expect(
      previewAdrSupersede(
        "ADR-0002",
        {
          ...successor,
          metadata: { ...successor.metadata, supersedes: ["ADR-0002"] },
        },
        context([
          { ...prior, metadata: { ...prior.metadata, status: "rejected" } },
        ]),
      ),
    ).toMatchObject({
      ok: false,
      findings: [{ code: "ADR_SUPERSEDED_STATUS_INVALID" }],
    });
  });

  it.each(["proposed", "rejected"] as const)(
    "rejects a %s successor without producing writes",
    (status) => {
      const prior = accepted("ADR-0002");
      const successor = accepted("ADR-0003");
      const result = previewAdrSupersede(
        "ADR-0002",
        {
          ...successor,
          metadata: {
            ...successor.metadata,
            status,
            supersedes: ["ADR-0002"],
          },
        },
        context([prior]),
      );

      expect(result).toMatchObject({
        ok: false,
        mutationPosture: "dry-run",
        findings: [{ code: "ADR_SUCCESSOR_STATUS_INVALID" }],
        writes: [],
      });
      expect(prior.metadata).toMatchObject({
        status: "accepted",
        supersededBy: null,
      });
    },
  );

  it.each(["proposed", "rejected"] as const)(
    "catalog validation rejects a %s successor without mutation",
    (status) => {
      const prior = {
        ...accepted("ADR-0002"),
        metadata: {
          ...accepted("ADR-0002").metadata,
          status: "superseded" as const,
          supersededBy: "ADR-0003",
        },
      };
      const successor = {
        ...accepted("ADR-0003"),
        metadata: {
          ...accepted("ADR-0003").metadata,
          status,
          supersedes: ["ADR-0002"],
        },
      };
      const records = [prior, successor] as const;
      const before = structuredClone(records);

      expect(validateAdrCatalog(records, context())).toEqual([
        expect.objectContaining({ code: "ADR_SUPERSESSION_INCONSISTENT" }),
      ]);
      expect(records).toEqual(before);
    },
  );

  it("catalog validation accepts an accepted successor without mutation", () => {
    const prior = {
      ...accepted("ADR-0002"),
      metadata: {
        ...accepted("ADR-0002").metadata,
        status: "superseded" as const,
        supersededBy: "ADR-0003",
      },
    };
    const successor = {
      ...accepted("ADR-0003"),
      metadata: {
        ...accepted("ADR-0003").metadata,
        supersedes: ["ADR-0002"],
      },
    };
    const records = [prior, successor] as const;
    const before = structuredClone(records);

    expect(validateAdrCatalog(records, context())).toEqual([]);
    expect(records).toEqual(before);
  });
});
