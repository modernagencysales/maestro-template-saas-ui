import { describe, expect, it } from "vitest";
import {
  compileFeatureContracts,
  compileFeatureContractSet,
} from "./check-features.mts";

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

  it("identifies the feature file for set findings", () => {
    expect(
      compileFeatureContractSet([required.replace("@required\n", "")], {
        paths: ["features/broken.feature"],
      }).findings,
    ).toContain(
      "features/broken.feature: feature requires exactly one @wip or @required tag",
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

  it("fails required admission when no required scenarios are selected", () => {
    expect(
      compileFeatureContractSet([], { required: true }).findings,
    ).toContain(
      "required contract selection must include at least one scenario",
    );
    expect(
      compileFeatureContractSet([required.replace("@required", "@wip")], {
        required: true,
      }).findings,
    ).toContain(
      "required contract selection must include at least one scenario",
    );
  });

  it("rejects required outlines with no executable example rows", () => {
    const result = compileFeatureContractSet(
      [
        `@required
Feature: Manage records from examples
  @cross_surface
  Scenario Outline: Create and read a record
    When I create <name> in the app
    Then the CLI lists <name>

    Examples:
      | name |
`,
      ],
      { required: true },
    );

    expect(result.findings).toContain(
      'required scenario outline "Create and read a record" requires at least one executable case',
    );
    expect(result.findings).toContain(
      "required contract selection must include at least one scenario",
    );
  });

  it("rejects structurally invalid and zero-step required scenarios", () => {
    expect(
      compileFeatureContractSet(
        [required.replace("@cross_surface", "@ui @cli")],
        { required: true },
      ).ok,
    ).toBe(false);
    expect(
      compileFeatureContractSet(
        [
          required.replace(
            "    When I create a record in the app\n    Then the CLI lists the record\n",
            "",
          ),
        ],
        { required: true },
      ).findings,
    ).toContain(
      'required scenario "Create in the app and read from the CLI" requires at least one step',
    );
  });
});
