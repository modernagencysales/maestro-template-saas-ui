import { describe, expect, it } from "vitest";
import { validateRequiredAcceptanceSummary } from "./template-product-contract-admission.mts";

describe("required acceptance admission summary", () => {
  it.each(["4 required, 4 runtime", "4 required, 5 runtime"])(
    "accepts %s",
    (stdout) => {
      expect(() => validateRequiredAcceptanceSummary(stdout)).not.toThrow();
    },
  );

  it.each([
    ["missing required coverage", "3 required, 5 runtime"],
    ["too few runtime records", "4 required, 3 runtime"],
  ])("rejects %s", (_name, stdout) => {
    expect(() => validateRequiredAcceptanceSummary(stdout)).toThrow(
      "Generated customer required acceptance must report 4 required behaviors and at least 4 runtime records.",
    );
  });
});
