import { describe, expect, it } from "vitest";

import { compileProductContractSource } from "./productContract";

const compile = (source: string, uri = "features/orders.feature") =>
  compileProductContractSource({ bytes: Buffer.from(source), uri });

describe("compileProductContractSource", () => {
  it("projects official Pickles, inherited step types, examples, and arguments deterministically", () => {
    const source = `@journey_orders @admitted
Feature: Manage café orders
  Background:
    Given an empty café

  @ui @covers_orders_ui
  Scenario: Create an order
    When Maya creates an order
    And she adds a croissant
      | field | value |
      | note  | très  |
    But she does not submit twice
    Then the app shows the order
    And the order is ready
    But no duplicate appears

  Rule: Agents share the same order
    Background:
      Given an agent for the café

    @cli @covers_orders_cli
    Scenario Outline: Read <item>
      When the agent reads <item>
      Then the CLI prints <item>
        """application/json
        {"item":"<item>"}
        """

      @authentication
      Examples: Pastries
        | item      |
        | croissant |
        | éclair    |

      @authorization
      Examples: Drinks
        | item   |
        | coffee |
`;

    const first = compile(source);
    const second = compile(source);

    expect(second).toEqual(first);
    expect(first.source).toMatchObject({
      uri: "features/orders.feature",
      journeyId: "journey_orders",
      lifecycle: "admitted",
      featureName: "Manage café orders",
    });
    expect(first.pickles).toHaveLength(4);
    expect(new Set(first.pickles.map((pickle) => pickle.key)).size).toBe(4);
    expect(first.pickles[0]?.steps.map((step) => step.type)).toEqual([
      "Context",
      "Action",
      "Action",
      "Action",
      "Outcome",
      "Outcome",
      "Outcome",
    ]);
    expect(first.pickles[0]?.steps[2]?.argument).toEqual({
      dataTable: [
        ["field", "value"],
        ["note", "très"],
      ],
    });
    expect(first.pickles.slice(1).map((pickle) => pickle.name)).toEqual([
      "Read croissant",
      "Read éclair",
      "Read coffee",
    ]);
    expect(first.pickles[1]?.steps.map((step) => step.text)).toEqual([
      "an empty café",
      "an agent for the café",
      "the agent reads croissant",
      "the CLI prints croissant",
    ]);
    expect(first.pickles[1]?.steps[3]?.argument).toEqual({
      docString: {
        mediaType: "application/json",
        content: '{"item":"croissant"}',
      },
    });
    expect(first.pickles[1]?.tags).toEqual([
      "@journey_orders",
      "@admitted",
      "@cli",
      "@covers_orders_cli",
      "@authentication",
    ]);
    expect(first.pickles[1]?.scenarioLocation).toEqual({ line: 22, column: 5 });
    expect(first.pickles[1]?.examplesRowLocation).toEqual({
      line: 32,
      column: 9,
    });
    expect(
      first.pickles
        .flatMap((pickle) => pickle.steps)
        .every((step) => /^sha256:[a-f0-9]{64}$/u.test(step.key)),
    ).toBe(true);
  });

  it.each([
    ["BOM", "\ufeff@journey_x @assembling\nFeature: X\n"],
    ["CRLF", "@journey_x @assembling\r\nFeature: X\r\n"],
    ["missing journey", "@assembling\nFeature: X\n"],
    ["duplicate lifecycle", "@journey_x @assembling @admitted\nFeature: X\n"],
    [
      "reserved tag below Feature",
      "@journey_x @assembling\nFeature: X\n  @journey_y @ui\n  Scenario: Y\n    When x\n    Then y\n",
    ],
    [
      "transport at Feature",
      "@journey_x @assembling @ui\nFeature: X\n  Scenario: Y\n    When x\n    Then y\n",
    ],
    [
      "missing transport",
      "@journey_x @assembling\nFeature: X\n  Scenario: Y\n    When x\n    Then y\n",
    ],
    [
      "missing Action",
      "@journey_x @assembling\nFeature: X\n  @ui\n  Scenario: Y\n    Given x\n    Then y\n",
    ],
    [
      "missing Outcome",
      "@journey_x @assembling\nFeature: X\n  @ui\n  Scenario: Y\n    When x\n",
    ],
    [
      "cross-surface with one transport",
      "@journey_x @assembling\nFeature: X\n  @ui @cross-surface\n  Scenario: Y\n    When x\n    Then y\n",
    ],
    [
      "empty Outline",
      "@journey_x @assembling\nFeature: X\n  @ui\n  Scenario Outline: Y <x>\n    When <x>\n    Then y\n    Examples:\n      | x |\n",
    ],
  ])("rejects %s", (_name, source) => {
    expect(() => compile(source)).toThrow();
  });

  it.each([
    "../features/x.feature",
    "features/../x.feature",
    "/features/x.feature",
    "features\\x.feature",
    "FEATURES/x.feature",
  ])("rejects non-canonical URI %s", (uri) => {
    expect(() =>
      compile(
        "@journey_x @assembling\nFeature: X\n  @ui\n  Scenario: Y\n    When x\n    Then y\n",
        uri,
      ),
    ).toThrow();
  });
});
