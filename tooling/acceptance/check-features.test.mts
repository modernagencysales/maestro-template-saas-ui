import { describe, expect, it } from "vitest";
import { compileFeatureContracts } from "./check-features.mts";

const surfaces = ["lead-magnet-builder"];
const valid = `@journey_custom-blueprint @assembling @covers_lead-magnet-builder
Feature: Custom blueprint
  Scenario: Visitor sees a composed blueprint
    Given a qualified visitor
    When they request a blueprint
    Then the blueprint is visible
`;

describe("static feature contracts", () => {
  it("compiles journey identity and lifecycle", () => {
    expect(compileFeatureContracts(valid, surfaces)).toMatchObject({
      ok: true,
      journeys: [{ id: "custom-blueprint", lifecycle: "assembling" }],
    });
  });

  it("requires one journey tag", () => {
    expect(
      compileFeatureContracts(
        valid.replace("@journey_custom-blueprint ", ""),
        surfaces,
      ),
    ).toMatchObject({
      ok: false,
      findings: [expect.stringMatching(/exactly one @journey_/)],
    });
  });

  it("requires one lifecycle tag", () => {
    expect(
      compileFeatureContracts(
        valid.replace("@assembling", "@assembling @admitted"),
        surfaces,
      ),
    ).toMatchObject({
      ok: false,
      findings: [expect.stringMatching(/exactly one lifecycle tag/)],
    });
  });

  it("rejects unknown public surfaces and implementation steps", () => {
    expect(
      compileFeatureContracts(
        valid.replace("lead-magnet-builder", "database"),
        surfaces,
      ).findings,
    ).toContainEqual(expect.stringMatching(/unknown public surface/));
    expect(
      compileFeatureContracts(
        valid.replace("a qualified visitor", "the users database table"),
        surfaces,
      ).findings,
    ).toContainEqual(expect.stringMatching(/implementation instruction/));
  });
});
