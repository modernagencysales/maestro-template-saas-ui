import { describe, expect, it } from "vitest";

import { createGenerationIncident, resumeGenerationIncident } from "./support";

describe("paid generation support", () => {
  it("resumes a recoverable incident without requiring another purchase", () => {
    const incident = createGenerationIncident({
      incidentId: "support_1",
      packId: "pack_1",
      purchaseId: "purchase_1",
      failedStage: "research",
    });
    const resumed = resumeGenerationIncident(incident, {
      operatorReason: "Provider capacity restored",
    });
    expect(resumed.status).toBe("resumed");
    expect(resumed.purchaseId).toBe("purchase_1");
    expect(resumed.requiresRepurchase).toBe(false);
  });

  it("does not resume an incident that needs manual support", () => {
    const incident = {
      ...createGenerationIncident({
        incidentId: "support_1",
        packId: "pack_1",
        purchaseId: "purchase_1",
        failedStage: "research",
      }),
      status: "needs-support" as const,
    };
    expect(() =>
      resumeGenerationIncident(incident, { operatorReason: "retry" }),
    ).toThrow(/not recoverable/i);
  });

  it("requires an operator reason before resuming paid work", () => {
    const incident = createGenerationIncident({
      incidentId: "support_2",
      packId: "pack_2",
      purchaseId: "purchase_2",
      failedStage: "specify",
    });
    expect(() =>
      resumeGenerationIncident(incident, { operatorReason: "   " }),
    ).toThrow(/operator reason/i);
  });
});
