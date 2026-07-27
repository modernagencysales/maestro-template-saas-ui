import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  previewAdoptionPreflight,
  previewAdoptionWorkPackage,
  type AdoptionWorkPackage,
} from "./adopt.js";

const fixture = (name: string): AdoptionWorkPackage =>
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, `../__fixtures__/adoption/${name}.json`),
      "utf8",
    ),
  ) as AdoptionWorkPackage;

describe("existing-app adoption core", () => {
  it("returns a deterministic separate-target planning artifact without mutation", () => {
    const input = fixture("separate-target");
    const before = structuredClone(input);
    const first = previewAdoptionWorkPackage(input);
    const second = previewAdoptionWorkPackage(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      findings: [],
      artifact: { path: "adoption/adopt-existing-crm.work-package.json" },
    });
    expect(JSON.parse(first.artifact?.content ?? "{}").decisions).toEqual(
      input.decisions,
    );
    expect(input).toEqual(before);
  });

  it("fails same-root and dirty overlapping defaults", () => {
    const input = fixture("separate-target");
    const sameRoot = {
      ...input,
      roots: { ...input.roots, target: input.roots.source },
    };
    const overlap = {
      ...input,
      roots: {
        ...input.roots,
        target: `${input.roots.source}/customer`,
        targetWorktree: input.roots.sourceWorktree,
      },
      worktrees: {
        ...input.worktrees,
        target: { ...input.worktrees.target, clean: false },
      },
    };

    expect(previewAdoptionPreflight(sameRoot)).toMatchObject({
      ok: false,
      findings: [{ code: "ADOPTION_SAME_ROOT" }],
    });
    expect(previewAdoptionPreflight(overlap)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_ROOTS_OVERLAP" }),
        expect.objectContaining({ code: "ADOPTION_TARGET_DIRTY" }),
      ]),
    });
  });

  it("requires a complete rollback contract", () => {
    const input = fixture("separate-target");
    const result = previewAdoptionWorkPackage({
      ...input,
      rollback: { ...input.rollback, strategy: "", evidence: "" },
    });

    expect(result).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_ROLLBACK_REQUIRED" }),
      ]),
      artifact: null,
    });
  });

  it("refuses destructive deletion decisions", () => {
    const input = fixture("destructive-delete");
    const before = structuredClone(input);
    const result = previewAdoptionWorkPackage(input);

    expect(result).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_DELETION_DESTRUCTIVE" }),
      ]),
      artifact: null,
    });
    expect(input).toEqual(before);
  });

  it("allows a justified clean in-place plan with rollback and a boundary", () => {
    const input = fixture("in-place");

    expect(previewAdoptionWorkPackage(input)).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      findings: [],
      artifact: { path: "adoption/adopt-in-place-reviewed.work-package.json" },
    });
  });

  it("does not infer a missing or invalid disposition", () => {
    const input = fixture("separate-target");
    const decisions = [
      { ...input.decisions[0], disposition: "migrate-somehow" },
    ] as unknown as AdoptionWorkPackage["decisions"];
    const result = previewAdoptionWorkPackage({ ...input, decisions });

    expect(result).toMatchObject({
      ok: false,
      findings: [{ code: "ADOPTION_SCHEMA_INVALID" }],
      artifact: null,
    });
  });

  it("rejects unknown fields and pins a closed schema", () => {
    const input = {
      ...fixture("separate-target"),
      inferredArchitecture: "do not accept",
    } as AdoptionWorkPackage;
    const schema = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../schemas/maestro-adoption-work-package.schema.json",
        ),
        "utf8",
      ),
    ) as {
      readonly additionalProperties: boolean;
      readonly properties: Readonly<
        Record<string, { readonly additionalProperties?: boolean }>
      >;
    };

    expect(previewAdoptionWorkPackage(input)).toMatchObject({
      ok: false,
      findings: [{ code: "ADOPTION_SCHEMA_CLOSED" }],
      artifact: null,
    });
    expect(schema.additionalProperties).toBe(false);
    for (const key of [
      "roots",
      "worktrees",
      "baseline",
      "mappings",
      "compatibility",
      "cutover",
      "deletion",
      "approval",
      "rollback",
      "inPlace",
    ])
      expect(schema.properties[key]?.additionalProperties).toBe(false);
  });

  it("does not accept inherited fields as the closed work-package shape", () => {
    const inherited = Object.create(fixture("separate-target")) as unknown;

    expect(previewAdoptionWorkPackage(inherited)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_SCHEMA_INVALID" }),
      ]),
      artifact: null,
    });
    expect(Object.keys(inherited as object)).toEqual([]);
  });

  it("rejects prototype-name fields as unknown own properties", () => {
    const input = fixture("separate-target");
    const rollback = {
      ...input.rollback,
      toString: "undeclared prototype-name field",
    };

    expect(previewAdoptionWorkPackage({ ...input, rollback })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_SCHEMA_CLOSED",
          message: "work package.rollback contains unknown field: toString",
        }),
      ]),
      artifact: null,
    });
  });

  it("accepts valid objects with a null prototype", () => {
    const input = fixture("separate-target");
    const rollback = Object.assign(Object.create(null), input.rollback);
    const workPackage = Object.assign(Object.create(null), input, { rollback });

    expect(previewAdoptionWorkPackage(workPackage)).toMatchObject({
      ok: true,
      findings: [],
      artifact: { path: "adoption/adopt-existing-crm.work-package.json" },
    });
  });

  it.each([
    "alpha//beta",
    ".",
    "./alpha",
    "alpha/./beta",
    "..",
    "alpha/../beta",
    "alpha/",
    "alpha\\beta",
    "/alpha",
    " alpha",
    "alpha ",
    "alpha\tbeta",
    "alpha\u0000beta",
  ])(
    "rejects non-canonical POSIX path alias %j in runtime and schema",
    (path) => {
      const input = fixture("separate-target");
      const before = structuredClone(input);
      const result = previewAdoptionWorkPackage({
        ...input,
        baseline: { ...input.baseline, sourceEvidence: [path] },
      });
      const schema = JSON.parse(
        readFileSync(
          resolve(
            import.meta.dirname,
            "../../../schemas/maestro-adoption-work-package.schema.json",
          ),
          "utf8",
        ),
      ) as {
        readonly $defs: { readonly relativePath: { readonly pattern: string } };
      };

      expect(result).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "ADOPTION_BASELINE_INCOMPLETE" }),
        ]),
        artifact: null,
      });
      expect(new RegExp(schema.$defs.relativePath.pattern).test(path)).toBe(
        false,
      );
      expect(input).toEqual(before);
    },
  );

  it.each([
    { schemaVersion: 2 },
    { mode: "automatic" },
    { rollback: undefined },
    { worktrees: { target: { clean: "yes", revision: "x" } } },
    { roots: { source: 42 } },
    { mappings: { tenant: [{ source: "x", target: "y", rule: 7 }] } },
  ])("fails closed on malformed runtime shape %#", (change) => {
    const input = fixture("separate-target") as unknown as Record<
      string,
      unknown
    >;
    const malformed = structuredClone(input);
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) delete malformed[key];
      else if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        malformed[key] !== null &&
        typeof malformed[key] === "object"
      )
        malformed[key] = {
          ...(malformed[key] as Record<string, unknown>),
          ...value,
        };
      else malformed[key] = value;
    }
    const before = structuredClone(malformed);

    expect(previewAdoptionWorkPackage(malformed)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_SCHEMA_INVALID" }),
      ]),
      artifact: null,
    });
    expect(malformed).toEqual(before);
  });

  it("requires source-restoring rollback and a non-dot in-place boundary", () => {
    const input = fixture("in-place");
    const result = previewAdoptionWorkPackage({
      ...input,
      editableBoundaries: ["."],
      rollback: { ...input.rollback, restoresSource: false },
    });

    expect(result).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_IN_PLACE_ROLLBACK_UNSAFE" }),
        expect.objectContaining({ code: "ADOPTION_EDITABLE_BOUNDARY_INVALID" }),
      ]),
      artifact: null,
    });
  });

  it("requires deletion paths to exactly equal caller delete decisions", () => {
    const base = fixture("separate-target");
    const safe = {
      ...base,
      decisions: [
        ...base.decisions,
        {
          path: "src/obsolete.ts",
          disposition: "delete" as const,
          rationale: "Remove only after approved cutover.",
        },
      ],
      deletion: {
        timing: "after-approved-cutover" as const,
        paths: ["src/obsolete.ts"],
      },
      approval: {
        ...base.approval,
        status: "approved" as const,
        evidence: "evidence/delete-approval.json",
      },
    };

    expect(previewAdoptionWorkPackage(safe).ok).toBe(true);
    for (const paths of [[], ["src/obsolete.ts", "src/extra.ts"]])
      expect(
        previewAdoptionWorkPackage({
          ...safe,
          deletion: { ...safe.deletion, paths },
        }),
      ).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({ code: "ADOPTION_DELETION_SET_MISMATCH" }),
        ]),
        artifact: null,
      });
  });

  it("rejects overlapping decisions and in-place boundary escapes", () => {
    const separate = fixture("separate-target");
    expect(
      previewAdoptionWorkPackage({
        ...separate,
        decisions: [
          ...separate.decisions,
          {
            path: "src/customer.ts/nested",
            disposition: "port" as const,
            rationale: "Conflicts with its reviewed parent path.",
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_DISPOSITION_OVERLAP" }),
      ]),
    });

    const inPlace = fixture("in-place");
    expect(
      previewAdoptionWorkPackage({
        ...inPlace,
        decisions: [
          {
            path: "packages/outside.ts",
            disposition: "replace" as const,
            rationale: "Attempts to escape the editable boundary.",
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_EDITABLE_BOUNDARY_VIOLATION",
        }),
      ]),
    });
  });

  it("renders identical bytes without locale-sensitive ordering and does not mutate", () => {
    const input = fixture("separate-target");
    const before = structuredClone(input);
    const first = previewAdoptionWorkPackage(input).artifact?.content;
    const localeCompare = vi
      .spyOn(String.prototype, "localeCompare")
      .mockImplementation(() => {
        throw new Error("locale-sensitive ordering is forbidden");
      });
    try {
      expect(previewAdoptionWorkPackage(input).artifact?.content).toBe(first);
    } finally {
      localeCompare.mockRestore();
    }
    expect(input).toEqual(before);
  });
});
