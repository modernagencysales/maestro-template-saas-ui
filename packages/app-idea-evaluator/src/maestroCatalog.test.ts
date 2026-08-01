import { describe, expect, it } from "vitest";

import {
  maestroBlueprintCatalog,
  selectMaestroBlueprint,
} from "./maestroCatalog";

const pack = {
  productBrief: "Fill cancelled dental appointments.",
  customerAndProblem: "Dental practices lose chair revenue.",
  scope: ["Waitlist matching"],
  requirements: ["Notify eligible patients"],
  userJourneys: ["Operator fills a cancellation"],
  dataModel: ["Practice — tenant account", "Appointment — open chair"],
  architecture: "Tenant-aware responsive SaaS web application",
  integrations: ["Transactional email"],
  securityAndPrivacy: ["Tenant isolation"],
  deliveryPlan: ["Pilot"],
  acceptanceCriteria: ["Fill one cancellation"],
  risks: ["Consent"],
  openQuestions: [],
  competitorClaims: [],
};

describe("Maestro evaluator blueprint catalog", () => {
  it("has unique ids and executable commands only for implemented blueprints", () => {
    expect(new Set(maestroBlueprintCatalog.map(({ id }) => id)).size).toBe(
      maestroBlueprintCatalog.length,
    );
    for (const blueprint of maestroBlueprintCatalog) {
      if (blueprint.status === "implemented") {
        expect(blueprint.generatorCommands.length).toBeGreaterThan(0);
        expect(blueprint.followUpGates.length).toBeGreaterThan(0);
      } else {
        expect(blueprint.generatorCommands).toEqual([]);
      }
    }
  });

  it("selects the implemented SaaS baseline for a conventional web product", () => {
    expect(selectMaestroBlueprint(pack)).toMatchObject({
      blueprint: { id: "saas-application", status: "implemented" },
      fit: "strong",
    });
  });

  it("selects a planned non-executable path for native offline requirements", () => {
    const selection = selectMaestroBlueprint({
      ...pack,
      productBrief: "Native field app",
      architecture: "Native iOS and Android clients with offline sync",
      requirements: ["Work offline on iOS"],
    });
    expect(selection).toMatchObject({
      blueprint: { id: "custom-domain-ai-app", status: "planned" },
      fit: "low",
    });
    expect(selection.blueprint.generatorCommands).toEqual([]);
  });
});
