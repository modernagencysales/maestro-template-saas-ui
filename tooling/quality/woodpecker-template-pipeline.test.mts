import { existsSync, readFileSync, statSync } from "node:fs";
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

  it("keeps neutral CI scripts free of Buildkite runtime coordinates", () => {
    for (const path of [
      "tooling/ci/setup.sh",
      "tooling/ci/contract-review.sh",
      "tooling/ci/mutation.sh",
      "tooling/ci/taste.sh",
    ]) {
      expect(read(path), path).not.toContain("BUILDKITE");
    }
  });

  it("checks in pipeline entrypoints as executable files", () => {
    for (const path of [
      "tooling/ci/ci-self-protection.sh",
      "tooling/ci/phase1.sh",
      "tooling/ci/setup.sh",
      "tooling/ci/staging-deploy.sh",
      "tooling/ci/production-promote.sh",
    ]) {
      expect(statSync(resolve(root, path)).mode & 0o111, path).not.toBe(0);
    }
  });
});
