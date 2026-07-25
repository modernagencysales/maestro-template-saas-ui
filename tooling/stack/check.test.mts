import { expect, test } from "vitest";
import { checkPlanFile } from "./check.mts";

test("a valid plan file yields no errors", () => {
  expect(
    checkPlanFile(new URL("./__fixtures__/plan.valid.json", import.meta.url)),
  ).toEqual([]);
});

test("uses accepted repository ADR files as the authority", () => {
  expect(
    checkPlanFile(new URL("./__fixtures__/plan.valid.json", import.meta.url)),
  ).not.toContain(expect.stringContaining("adrRefs"));
});

test("a too-deep plan file is rejected", () => {
  const errs = checkPlanFile(
    new URL("./__fixtures__/plan.deep.json", import.meta.url),
  );
  expect(errs.some((e) => e.includes("depth"))).toBe(true);
});
