import { expect, test } from "vitest";
import { MAX_DEPTH, type StackPlan, validatePlan } from "./plan.mts";
import { contractRisksForLayers } from "./contract-risk-registry.mts";

type Slice = StackPlan["slices"][number];
type WorkPackage = Slice["workPackages"][number];

const workPackage = (over: Partial<WorkPackage> = {}): WorkPackage => ({
  kind: "pattern-instance",
  target: "packages/convex/confect/capabilities/x",
  generatorCommand:
    "pnpm template:add-capability -- --name x --system knowledge-brain --disposition extend --write",
  followUpGates: [
    "pnpm confect:codegen",
    "pnpm confect:manifest",
    "pnpm check:confect-contracts",
  ],
  notes: "Generated capability scaffold plus focused contract checks.",
  ...over,
});

const slice = (over: Partial<StackPlan["slices"][number]> = {}) => ({
  id: 1,
  branch: "feat/x-1-capability",
  intention: "add the x capability",
  layers: ["capabilities"],
  contractRiskIds: contractRisksForLayers(["capabilities"]),
  workPackages: [workPackage()],
  taskRefs: ["t1"],
  rationale: "standalone: generated capability scaffold",
  estLines: 40,
  ...over,
});

const plan = (over: Partial<StackPlan> = {}): StackPlan => ({
  feature: "x",
  slices: [slice()],
  allTaskRefs: ["t1"],
  ...over,
});

test("a sound single-slice plan passes", () => {
  expect(validatePlan(plan())).toEqual([]);
});

test("rejects a slice missing layer-required contract risks", () => {
  const errs = validatePlan(
    plan({ slices: [slice({ contractRiskIds: ["policy-data-hardcoded"] })] }),
  );
  expect(
    errs.some((e) => e.includes("missing layer-required contractRiskIds")),
  ).toBe(true);
});

test("rejects an oversized estimate", () => {
  const errs = validatePlan(plan({ slices: [slice({ estLines: 301 })] }));
  expect(errs.some((e) => e.includes("estLines"))).toBe(true);
});

test("rejects out-of-order layers (capability below its schema)", () => {
  const errs = validatePlan(
    plan({
      slices: [
        slice({ id: 1, layers: ["capabilities"] }),
        slice({
          id: 2,
          layers: ["schema"],
          branch: "feat/x-2",
          taskRefs: ["t2"],
        }),
      ],
      allTaskRefs: ["t1", "t2"],
    }),
  );
  expect(errs.some((e) => e.includes("dependency order"))).toBe(true);
});

test("rejects an incomplete plan (a task not shipped)", () => {
  const errs = validatePlan(plan({ allTaskRefs: ["t1", "t2"] }));
  expect(errs.some((e) => e.includes("does not cover"))).toBe(true);
});

test("rejects a slice without work-package metadata", () => {
  const errs = validatePlan(
    plan({
      slices: [
        {
          ...slice(),
          workPackages: [],
        },
      ],
    }),
  );
  expect(errs.some((e) => e.includes("workPackages"))).toBe(true);
});

test("rejects an unknown work-package kind", () => {
  const errs = validatePlan(
    plan({
      slices: [
        slice({
          workPackages: [
            workPackage({
              kind: "custom" as WorkPackage["kind"],
            }),
          ],
        }),
      ],
    }),
  );
  expect(errs.some((e) => e.includes("kind"))).toBe(true);
});

test("rejects a pattern instance without generator command", () => {
  const errs = validatePlan(
    plan({
      slices: [
        slice({
          workPackages: [
            workPackage({
              generatorCommand: "",
            }),
          ],
        }),
      ],
    }),
  );
  expect(errs.some((e) => e.includes("generatorCommand"))).toBe(true);
});

test("rejects a fixture-to-real package without focused gates", () => {
  const errs = validatePlan(
    plan({
      slices: [
        slice({
          workPackages: [
            workPackage({
              kind: "fixture-to-real",
              target: "packages/convex/confect/ops/actions.impl.ts",
              generatorCommand: undefined,
              followUpGates: [],
            }),
          ],
        }),
      ],
    }),
  );
  expect(errs.some((e) => e.includes("followUpGates"))).toBe(true);
});

test("rejects a template gap without backlog and resolution path", () => {
  const errs = validatePlan(
    plan({
      slices: [
        slice({
          workPackages: [
            workPackage({
              kind: "template-gap",
              target: "new realtime whiteboard primitive",
              generatorCommand: undefined,
              templateBacklogRef: "",
              templateResolutionPath: "",
            }),
          ],
        }),
      ],
    }),
  );
  expect(errs.some((e) => e.includes("templateBacklogRef"))).toBe(true);
  expect(errs.some((e) => e.includes("templateResolutionPath"))).toBe(true);
});

test("rejects a stack deeper than MAX_DEPTH", () => {
  const slices = Array.from({ length: MAX_DEPTH + 1 }, (_, i) =>
    slice({ id: i + 1, branch: `feat/x-${i + 1}`, taskRefs: [`t${i + 1}`] }),
  );
  const errs = validatePlan(
    plan({ slices, allTaskRefs: slices.map((s) => s.taskRefs[0]) }),
  );
  expect(errs.some((e) => e.includes("depth"))).toBe(true);
});
