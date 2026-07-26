import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdoptionAuthorityResult } from "./adoptAuthority.js";
import type { AdoptionWorkPackage } from "./adopt.js";
import {
  compileAdoptionExecutionPlan,
  type AdoptionExecutionIntent,
} from "./adoptExecution.js";

const checksum = (character: string): string =>
  `sha256:${character.repeat(64)}`;

const workPackage = (): AdoptionWorkPackage => {
  const fixture = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../__fixtures__/adoption/separate-target.json",
      ),
      "utf8",
    ),
  ) as AdoptionWorkPackage;
  return {
    ...fixture,
    approval: {
      ...fixture.approval,
      status: "approved",
      evidence: "evidence/adoption-approval.json",
    },
  };
};

const authority = (): AdoptionAuthorityResult => ({
  ok: true,
  mutationPosture: "read-only",
  findings: [],
  authorityFingerprint: checksum("a"),
});

const intents = (): AdoptionExecutionIntent[] => [
  {
    path: "src/theme.css",
    disposition: "preserve",
    sourceChecksum: checksum("b"),
    stagedChecksum: null,
    rollbackChecksum: null,
  },
  {
    path: "src/customer.ts",
    disposition: "port",
    sourceChecksum: checksum("c"),
    stagedChecksum: checksum("d"),
    rollbackChecksum: null,
  },
  {
    path: "src/auth.ts",
    disposition: "replace",
    sourceChecksum: checksum("e"),
    stagedChecksum: checksum("f"),
    rollbackChecksum: checksum("e"),
  },
];

describe("adoption execution planning", () => {
  it("compiles deterministic authority-bound phases without mutation", () => {
    const input = {
      workPackage: workPackage(),
      authority: authority(),
      intents: intents().reverse(),
    };
    const before = structuredClone(input);
    const first = compileAdoptionExecutionPlan(input);
    const second = compileAdoptionExecutionPlan(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "dry-run",
      findings: [],
      artifact: {
        path: "adoption/adopt-existing-crm.execution-plan.json",
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
    });
    const artifact = JSON.parse(first.artifact?.content ?? "{}") as {
      readonly authorityFingerprint: string;
      readonly phases: readonly {
        readonly name: string;
        readonly operations: readonly { readonly path: string }[];
      }[];
    };
    expect(artifact.authorityFingerprint).toBe(checksum("a"));
    expect(artifact.phases.map(({ name }) => name)).toEqual([
      "stage",
      "verify",
      "cutover",
      "post-cutover-deletion",
    ]);
    expect(artifact.phases[0]?.operations.map(({ path }) => path)).toEqual([
      "src/auth.ts",
      "src/customer.ts",
    ]);
    expect(input).toEqual(before);
  });

  it("defers exact delete decisions until a distinct post-cutover phase", () => {
    const base = workPackage();
    const deletionPath = "src/retired.ts";
    const withDeletion: AdoptionWorkPackage = {
      ...base,
      decisions: [
        ...base.decisions,
        {
          path: deletionPath,
          disposition: "delete",
          rationale: "Remove only after approved cutover.",
        },
      ],
      deletion: {
        timing: "after-approved-cutover",
        paths: [deletionPath],
      },
    };
    const result = compileAdoptionExecutionPlan({
      workPackage: withDeletion,
      authority: authority(),
      intents: [
        ...intents(),
        {
          path: deletionPath,
          disposition: "delete",
          sourceChecksum: checksum("3"),
          stagedChecksum: null,
          rollbackChecksum: checksum("3"),
        },
      ],
    });
    const plan = JSON.parse(result.artifact?.content ?? "{}") as {
      readonly phases: readonly {
        readonly name: string;
        readonly operations: readonly { readonly action: string }[];
      }[];
    };

    expect(plan.phases.at(-1)).toEqual({
      name: "post-cutover-deletion",
      operations: [expect.objectContaining({ action: "delete-after-cutover" })],
    });
  });

  it("fails closed without an accepted authority fingerprint", () => {
    const rejectedAuthority: AdoptionAuthorityResult = {
      ...authority(),
      ok: false,
      authorityFingerprint: null,
    };

    expect(
      compileAdoptionExecutionPlan({
        workPackage: workPackage(),
        authority: rejectedAuthority,
        intents: intents(),
      }),
    ).toMatchObject({
      ok: false,
      findings: [{ code: "ADOPTION_EXECUTION_AUTHORITY_REQUIRED" }],
      artifact: null,
    });
  });

  it("requires an approved valid work package", () => {
    const pending = {
      ...workPackage(),
      approval: {
        ...workPackage().approval,
        status: "pending" as const,
        evidence: null,
      },
    };

    expect(
      compileAdoptionExecutionPlan({
        workPackage: pending,
        authority: authority(),
        intents: intents(),
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_EXECUTION_APPROVAL_REQUIRED",
        }),
      ]),
      artifact: null,
    });
  });

  it("requires exact one-to-one decision coverage", () => {
    const missing = intents().slice(1);
    const preserveIntent = intents()[0];
    if (preserveIntent === undefined)
      throw new Error("missing preserve intent");
    const duplicate = [...intents(), preserveIntent];
    const extra = [
      ...intents(),
      {
        ...preserveIntent,
        path: "src/unreviewed.ts",
      },
    ];

    for (const candidate of [missing, duplicate, extra])
      expect(
        compileAdoptionExecutionPlan({
          workPackage: workPackage(),
          authority: authority(),
          intents: candidate,
        }),
      ).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "ADOPTION_EXECUTION_COVERAGE_INVALID",
          }),
        ]),
        artifact: null,
      });
  });

  it("rejects ancestor and descendant execution intents", () => {
    const base = workPackage();
    const first = base.decisions[0];
    if (first === undefined) throw new Error("missing decision");
    const firstIntent = intents().find(({ path }) => path === first.path);
    if (firstIntent === undefined) throw new Error("missing matching intent");
    const overlappingPackage = {
      ...base,
      decisions: [
        first,
        {
          ...first,
          path: `${first.path}/nested`,
        },
      ],
    };
    const overlappingIntents = [
      firstIntent,
      { ...firstIntent, path: `${first.path}/nested` },
    ];
    expect(
      compileAdoptionExecutionPlan({
        workPackage: overlappingPackage,
        authority: authority(),
        intents: overlappingIntents,
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_EXECUTION_PATH_OVERLAP" }),
      ]),
    });
  });

  it("rejects disposition drift from caller-approved decisions", () => {
    const changed = intents().map((intent) =>
      intent.path === "src/customer.ts"
        ? { ...intent, disposition: "replace" as const }
        : intent,
    );

    expect(
      compileAdoptionExecutionPlan({
        workPackage: workPackage(),
        authority: authority(),
        intents: changed,
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_EXECUTION_DECISION_DRIFT" }),
      ]),
    });
  });

  it.each([
    ["preserve with staged bytes", 0, "stagedChecksum", checksum("9")],
    ["port without staged bytes", 1, "stagedChecksum", null],
    ["replace without rollback bytes", 2, "rollbackChecksum", null],
    ["malformed source checksum", 0, "sourceChecksum", "sha256:nope"],
  ] as const)("rejects %s", (_name, index, field, value) => {
    const changed = intents();
    const current = changed[index];
    if (current === undefined) throw new Error("missing test intent");
    changed[index] = { ...current, [field]: value };

    expect(
      compileAdoptionExecutionPlan({
        workPackage: workPackage(),
        authority: authority(),
        intents: changed,
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_EXECUTION_BYTES_INVALID" }),
      ]),
      artifact: null,
    });
  });

  it("uses locale-independent code-unit ordering", () => {
    const packageWithOrdering = {
      ...workPackage(),
      decisions: [
        {
          path: "src/z.ts",
          disposition: "preserve" as const,
          rationale: "Keep z.",
        },
        {
          path: "src/A.ts",
          disposition: "preserve" as const,
          rationale: "Keep A.",
        },
      ],
    };
    const orderedIntents: AdoptionExecutionIntent[] = [
      {
        path: "src/z.ts",
        disposition: "preserve",
        sourceChecksum: checksum("1"),
        stagedChecksum: null,
        rollbackChecksum: null,
      },
      {
        path: "src/A.ts",
        disposition: "preserve",
        sourceChecksum: checksum("2"),
        stagedChecksum: null,
        rollbackChecksum: null,
      },
    ];
    const result = compileAdoptionExecutionPlan({
      workPackage: packageWithOrdering,
      authority: authority(),
      intents: orderedIntents,
    });
    const plan = JSON.parse(result.artifact?.content ?? "{}") as {
      readonly phases: readonly {
        readonly name: string;
        readonly operations: readonly { readonly path: string }[];
      }[];
    };

    expect(
      plan.phases
        .find(({ name }) => name === "verify")
        ?.operations.map(({ path }) => path),
    ).toEqual(["src/A.ts", "src/z.ts"]);
  });
});
