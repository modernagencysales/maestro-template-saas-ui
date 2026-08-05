import { describe, expect, it } from "vitest";
import { compileFeatureContracts } from "./check-features.mts";

const required = `@required
Feature: Manage records
  @cross_surface
  Scenario: Create in the app and read from the CLI
    When I create a record in the app
    Then the CLI lists the record
`;

describe("static feature contracts", () => {
  it("accepts required cross-surface and wip single-surface contracts", () => {
    expect(compileFeatureContracts(required)).toEqual({
      ok: true,
      findings: [],
    });
    expect(
      compileFeatureContracts(
        required.replace("@required", "@wip").replace("@cross_surface", "@ui"),
      ),
    ).toEqual({ ok: true, findings: [] });
  });

  it("reports invalid Gherkin", () => {
    expect(compileFeatureContracts("not gherkin").findings).toContainEqual(
      expect.stringMatching(/^invalid Gherkin:/),
    );
  });

  it("requires exactly one feature lifecycle tag", () => {
    expect(
      compileFeatureContracts(required.replace("@required\n", "")).findings,
    ).toContain("feature requires exactly one @wip or @required tag");
    expect(
      compileFeatureContracts(required.replace("@required", "@wip @required"))
        .findings,
    ).toContain("feature requires exactly one @wip or @required tag");
  });

  it("requires exactly one interaction tag on every scenario", () => {
    expect(
      compileFeatureContracts(required.replace("  @cross_surface\n", ""))
        .findings,
    ).toContain(
      'scenario "Create in the app and read from the CLI" requires exactly one @ui, @cli, or @cross_surface tag',
    );
    expect(
      compileFeatureContracts(
        required.replace("@cross_surface", "@cross_surface @ui"),
      ).findings,
    ).toContain(
      'scenario "Create in the app and read from the CLI" requires exactly one @ui, @cli, or @cross_surface tag',
    );
  });

  it("requires a cross-surface scenario for required features", () => {
    expect(
      compileFeatureContracts(required.replace("@cross_surface", "@ui"))
        .findings,
    ).toContain("required feature requires a @cross_surface scenario");
  });
});
