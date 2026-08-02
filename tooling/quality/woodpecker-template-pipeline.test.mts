import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Woodpecker template pipeline", () => {
  it("uses Woodpecker as the sole guarded release surface", () => {
    expect(existsSync(resolve(root, ".buildkite/pipeline.yml"))).toBe(false);
    expect(read(".woodpecker/verify.yml")).toContain("trusted-ci-policy");
    expect(read(".woodpecker/deploy.yml")).toContain(
      'CI_PIPELINE_DEPLOY_TARGET == "staging"',
    );
    expect(read(".woodpecker/deploy.yml")).toContain(
      'CI_PIPELINE_DEPLOY_TARGET == "production"',
    );
  });
});
