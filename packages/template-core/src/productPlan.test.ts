import { describe, expect, it } from "vitest";

import {
  validateProductPlanBindings,
  type ProductPlanFrontmatter,
} from "./productPlan";
import type { ProductContract } from "./productContract";

const behavior = {
  id: "BHV-CORE-1",
  revision: 2,
  title: "Create a workspace",
  actor: "workspace member",
  surfaces: ["web-ui", "public-http"] as const,
  preconditions: [],
  action: "Creates a workspace",
  outcomes: ["The workspace is visible"] as const,
  status: "required" as const,
};

const contract: ProductContract = {
  schemaVersion: 1,
  product: { id: "template", name: "Template", summary: "Contract" },
  behaviors: [behavior],
};

const frontend = {
  screenCatalogId:
    "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
  sourceReceipt: "docs/template/saas-ui-starter-files.json",
  shellId: "app-shell",
  allowedAdaptations: ["route-binding", "data-adapter"],
  requiredVisualStates: [
    "loading",
    "empty",
    "error",
    "populated",
    "selected",
    "mutation",
  ],
} as const;

const matchingPlan: ProductPlanFrontmatter = {
  planSchemaVersion: 1,
  productContract: "product.contract.yaml",
  workPackages: [
    {
      id: "WP-CORE-1",
      behaviorIds: ["BHV-CORE-1"],
      appMapTargets: ["web.workspace"],
      work: {
        kind: "pattern-instance",
        target: "workspace",
        generatorCommand: "pnpm template:add-feature",
        followUpGates: ["workspace acceptance"],
        frontend,
      },
    },
  ],
  proofs: [
    {
      behavior: "BHV-CORE-1",
      behaviorRevision: 2,
      level: "black-box",
      surfaces: ["web-ui", "public-http"],
      observation: "Workspace is visible after creation",
      failureWitness: "The workspace is absent",
    },
  ],
};

describe("ProductPlanFrontmatter", () => {
  it("accepts a matching plan and reports stale revisions", () => {
    expect(
      validateProductPlanBindings({ contract, plans: [matchingPlan] }),
    ).toEqual([]);
    const staleRevisionPlan = {
      ...matchingPlan,
      proofs: [{ ...matchingPlan.proofs[0], behaviorRevision: 1 }],
    } as ProductPlanFrontmatter;
    expect(
      validateProductPlanBindings({
        contract,
        plans: [staleRevisionPlan],
      }).join("\n"),
    ).toMatch(/revision/i);
  });

  it("rejects a web work package without selected screen authority", () => {
    const withoutFrontend = {
      ...matchingPlan,
      workPackages: [
        {
          ...matchingPlan.workPackages[0],
          work: {
            kind: "pattern-instance" as const,
            target: "workspace",
            generatorCommand: "pnpm template:add-feature",
            followUpGates: ["workspace acceptance"],
          },
        },
      ],
    } as ProductPlanFrontmatter;
    expect(
      validateProductPlanBindings({
        contract,
        plans: [withoutFrontend],
      }).join("\n"),
    ).toContain("missing frontend screen authority");
  });

  it("reports surface mismatches and retired behavior proofs", () => {
    const wrongSurfacePlan = {
      ...matchingPlan,
      proofs: [{ ...matchingPlan.proofs[0], surfaces: ["cli-process"] }],
    } as ProductPlanFrontmatter;
    expect(
      validateProductPlanBindings({ contract, plans: [wrongSurfacePlan] }).join(
        "\n",
      ),
    ).toMatch(/surfaces/i);

    const retiredContract: ProductContract = {
      ...contract,
      behaviors: [
        { ...behavior, status: "retired", retirementReason: "replaced" },
      ],
    };
    expect(
      validateProductPlanBindings({
        contract: retiredContract,
        plans: [matchingPlan],
      }).join("\n"),
    ).toMatch(/retired/i);
  });
});
