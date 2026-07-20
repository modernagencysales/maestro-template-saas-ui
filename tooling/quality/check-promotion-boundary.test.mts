import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkPromotionBoundary,
  validatePromotionBoundary,
  type PromotionBoundaryFile,
} from "./check-promotion-boundary.mts";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const experimentContract = JSON.stringify({
  schemaVersion: 1,
  id: "memory-lab",
  system: "knowledge-brain",
  disposition: "extend",
  hypothesis: "A bounded memory view improves grounded answers.",
  productionRegistrations: false,
  promotionCommand:
    "pnpm template:add-feature -- --name memoryLab --system knowledge-brain --disposition extend --write",
});

const files = (
  additions: readonly PromotionBoundaryFile[] = [],
): readonly PromotionBoundaryFile[] => [
  {
    path: "experiments/knowledge-brain/memory-lab/experiment.json",
    content: experimentContract,
  },
  {
    path: "experiments/knowledge-brain/memory-lab/src/index.ts",
    content: "export const hypothesis = true;\n",
  },
  ...additions,
];

describe("check:promotion-boundary", () => {
  it("accepts the repository boundary contract", () => {
    expect(checkPromotionBoundary(ROOT)).toEqual([]);
  });

  it("blocks production imports from experiments and private packages", () => {
    const findings = validatePromotionBoundary(
      files([
        {
          path: "apps/web/src/features/memory/index.ts",
          content:
            'import { memory } from "../../../../../experiments/knowledge-brain/memory-lab/src";\n',
        },
        {
          path: "packages/convex/confect/ops/shadow.ts",
          content:
            'export { shadow } from "../../../../private-packages/shadow/src";\n',
        },
      ]),
    );

    expect(findings.map(({ issue }) => issue)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("production code cannot import experiments"),
        expect.stringContaining(
          "production code cannot import private-packages",
        ),
      ]),
    );
  });

  it.each([
    ["defineTable({})", "durable schema"],
    ['createFileRoute("/shadow")({})', "production route"],
    ['registerHeadlessOperation("shadow")', "headless operation"],
    ['crons.interval("shadow", {})', "production job"],
    ['registerProvider("shadow", {})', "provider"],
  ])("blocks sandbox production registration: %s", (content, label) => {
    const findings = validatePromotionBoundary(
      files([
        {
          path: "experiments/knowledge-brain/memory-lab/src/register.ts",
          content,
        },
      ]),
    );

    expect(findings).toContainEqual(
      expect.objectContaining({ issue: expect.stringContaining(label) }),
    );
  });

  it("requires one valid contract per experiment directory", () => {
    const findings = validatePromotionBoundary([
      {
        path: "experiments/workflow-runtime/shadow-runner/src/index.ts",
        content: "export const run = () => undefined;\n",
      },
      {
        path: "experiments/knowledge-brain/memory-lab/experiment.json",
        content: JSON.stringify({
          ...JSON.parse(experimentContract),
          system: "workflow-runtime",
          productionRegistrations: true,
        }),
      },
    ]);

    expect(findings.map(({ issue }) => issue)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing experiment.json"),
        expect.stringContaining("must match its directory"),
        expect.stringContaining("productionRegistrations must be false"),
      ]),
    );
  });
});
