import { describe, expect, it } from "vitest";

import { validateFunnelEvent } from "./funnelEvents";

describe("privacy-safe funnel analytics", () => {
  it.each([
    "idea",
    "answer",
    "roast",
    "prompt",
    "modelOutput",
    "email",
    "payment",
  ])("rejects %s content in funnel events", (field) => {
    expect(() =>
      validateFunnelEvent({
        name: "evaluation_completed",
        evaluationId: "idea_1",
        verdict: "worth-testing",
        durationMs: 1_000,
        modelCalls: 1,
        estimatedCostCents: 0.03,
        [field]: "private",
      }),
    ).toThrow("analytics property");
  });

  it("accepts the allowlisted completion metrics", () => {
    expect(
      validateFunnelEvent({
        name: "evaluation_completed",
        evaluationId: "idea_1",
        verdict: "worth-testing",
        durationMs: 1_000,
        modelCalls: 1,
        estimatedCostCents: 0.03,
      }),
    ).toMatchObject({ name: "evaluation_completed" });
  });

  it("rejects unknown verdicts and negative operational metrics", () => {
    expect(() =>
      validateFunnelEvent({
        name: "evaluation_completed",
        evaluationId: "idea_1",
        verdict: "definitely-a-unicorn",
        durationMs: -1,
        modelCalls: -1,
        estimatedCostCents: -1,
      }),
    ).toThrow();
  });

  it.each([
    { name: "checkout_started", reportId: "report_1" },
    {
      name: "entitlement_granted",
      reportId: "report_1",
      purchaseStatus: "paid",
    },
    { name: "build_pack_started", packId: "pack_1" },
    {
      name: "build_pack_stage_changed",
      packId: "pack_1",
      stage: "research",
      status: "completed",
      attempts: 1,
    },
    { name: "build_pack_exported", packId: "pack_1", format: "markdown" },
    {
      name: "maestro_offer_selected",
      packId: "pack_1",
      blueprintId: "saas-application",
      fit: "strong",
    },
  ])("accepts the $name operational boundary", (event) => {
    expect(validateFunnelEvent(event)).toEqual(event);
  });

  it("rejects private content on every event type", () => {
    expect(() =>
      validateFunnelEvent({
        name: "checkout_started",
        reportId: "report_1",
        email: "private@example.test",
      }),
    ).toThrow("analytics property");
  });
});
