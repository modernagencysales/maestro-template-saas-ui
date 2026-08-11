import { describe, expect, it } from "vitest";
import {
  runRequiredAcceptanceAdmission,
  runStructuralProductContractAdmission,
} from "../../../../tooling/acceptance/template-product-contract-admission.mts";

describe("generated customer product contract admission", () => {
  it("validates generated customer product contract", async () => {
    await expect(
      runStructuralProductContractAdmission(),
    ).resolves.toBeUndefined();
  }, 900_000);

  it("executes required Records product behaviors", async () => {
    await expect(runRequiredAcceptanceAdmission()).resolves.toBeUndefined();
  }, 900_000);
});
