import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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
      findings: [{ code: "ADOPTION_DISPOSITION_INVALID" }],
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
});
