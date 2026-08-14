import { describe, expect, it } from "vitest";

import {
  behaviorRevisionTag,
  renderProductContractJsonSchema,
  renderProductContractMarkdown,
  validateProductContract,
  type ProductContract,
} from "./productContract";

const activeBehavior = {
  id: "BHV-CORE-1",
  revision: 2,
  title: "Create a workspace",
  actor: "workspace member",
  surfaces: ["web-ui", "public-http"] as const,
  preconditions: ["The member is authenticated"],
  action: "Creates a workspace",
  outcomes: ["The workspace is visible", "An audit event is recorded"] as const,
  status: "required" as const,
};

const contract: ProductContract = {
  schemaVersion: 1,
  product: {
    id: "template",
    name: "Template",
    summary: "A typed product contract",
  },
  behaviors: [activeBehavior],
};

const contractWith = (changes: Record<string, unknown>): unknown => ({
  ...contract,
  behaviors: [
    {
      ...activeBehavior,
      ...changes,
    },
  ],
});

describe("ProductContract", () => {
  it("rejects invalid required behavior fields", () => {
    expect(() =>
      validateProductContract(contractWith({ outcomes: [] })),
    ).toThrow();
    expect(() =>
      validateProductContract(contractWith({ surfaces: [] })),
    ).toThrow();
    expect(() =>
      validateProductContract(contractWith({ revision: 0 })),
    ).toThrow();
    expect(() =>
      validateProductContract(contractWith({ surfaces: ["mcp"] })),
    ).toThrow();
    expect(() =>
      validateProductContract(contractWith({ unexpected: true })),
    ).toThrow();
  });

  it("rejects duplicate IDs and invalid retirement metadata", () => {
    expect(() =>
      validateProductContract({
        ...contract,
        behaviors: [activeBehavior, { ...activeBehavior, title: "Again" }],
      }),
    ).toThrow(/duplicate/i);
    expect(() =>
      validateProductContract(
        contractWith({
          status: "retired",
          retirementReason: "obsolete",
          replacementBehaviorId: "BHV-UNKNOWN-1",
        }),
      ),
    ).toThrow(/replacement/i);
    expect(() =>
      validateProductContract(contractWith({ status: "retired" })),
    ).toThrow(/reason/i);
    expect(() =>
      validateProductContract(
        contractWith({ status: "required", retirementReason: "not retired" }),
      ),
    ).toThrow();
  });

  it("validates revision tags and emits deterministic browser-safe renderings", () => {
    expect(behaviorRevisionTag(activeBehavior)).toBe("@BHV-CORE-1-R2");
    expect(
      renderProductContractMarkdown({
        contract,
        links: [
          {
            behaviorId: "BHV-CORE-1",
            planPaths: ["z-plan.md", "a-plan.md"],
            appMapTargets: ["z-target", "a-target"],
            acceptancePaths: ["z.spec.ts", "a.spec.ts"],
          },
        ],
      }),
    ).toMatch(/\| Revision \| 2 \|/);
    expect(
      renderProductContractMarkdown({
        contract,
        links: [
          {
            behaviorId: "BHV-CORE-1",
            planPaths: [],
            appMapTargets: [],
            acceptancePaths: ["z.spec.ts", "a.spec.ts"],
          },
        ],
      }),
    ).toMatch(/Acceptance file paths.*a\.spec\.ts.*z\.spec\.ts/s);
    expect(renderProductContractMarkdown({ contract, links: [] })).toMatch(
      /\| Acceptance file paths \| — \|/,
    );
    expect(renderProductContractMarkdown({ contract, links: [] })).toContain(
      "The links below are structural coverage only. Causal strength and declared-surface usefulness are `unproven` and review-owned. Current verification comes only from the exact-head `.maestro/verification-receipt.json`.",
    );
    expect(renderProductContractMarkdown({ contract, links: [] })).toMatch(
      /\n$/,
    );
    expect(renderProductContractJsonSchema()).toContain('"schemaVersion"');
    expect(renderProductContractJsonSchema()).toMatch(/\n$/);
  });

  it("projects runtime string, uniqueness, and optional-key constraints", () => {
    const rendered = JSON.parse(renderProductContractJsonSchema()) as {
      readonly properties: {
        readonly product: {
          readonly properties: {
            readonly name: Record<string, unknown>;
          };
        };
      };
    };
    expect(rendered.properties.product.properties.name).toMatchObject({
      type: "string",
      allOf: expect.arrayContaining([
        { minLength: 1 },
        { pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$" },
      ]),
    });
    const serialized = JSON.stringify(rendered);
    expect(serialized).toContain('"uniqueItems":true');
    expect(serialized).not.toContain('"type":"null"');
  });
});
