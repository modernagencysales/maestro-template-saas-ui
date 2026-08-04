import { describe, expect, it } from "vitest";
import { validateCucumberContracts } from "./check-contracts.mts";

const source = `module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};\n`;

describe("Cucumber contract", () => {
  it("accepts only the pinned configuration and packages", () => {
    expect(
      validateCucumberContracts(source, {
        "@cucumber/cucumber": "13.2.0",
        "@cucumber/gherkin": "41.0.0",
        "@cucumber/messages": "34.0.1",
      }),
    ).toEqual([]);
  });

  it.each([
    source.replace("retry: 0", "retry: 1"),
    source.replace("parallel: 0", "parallel: 2"),
    source.replace("tsx/cjs", "tsx/esm"),
    source.replace("  },\n};", "    tags: '@focus',\n  },\n};"),
  ])("rejects configuration drift", (candidate) => {
    expect(
      validateCucumberContracts(candidate, {
        "@cucumber/cucumber": "13.2.0",
        "@cucumber/gherkin": "41.0.0",
        "@cucumber/messages": "34.0.1",
      }),
    ).not.toEqual([]);
  });
});
