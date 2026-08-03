import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
    expect(read(".woodpecker/verify.yml")).toContain("tags: true");
    expect(read(".woodpecker/deploy.yml")).toContain("tags: true");
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

    expect(read(".github/workflows/quality.yml")).not.toContain(
      ".buildkite/scripts/",
    );
  });

  it("provisions the Linux syscall tracer required by privacy gates", () => {
    expect(read(".woodpecker/verify.yml")).toContain(
      "apt-get install -y --no-install-recommends strace",
    );
  });

  it("documents AI review gates as manual under the current topology", () => {
    const verifyPipeline = read(".woodpecker/verify.yml");
    const deliveryStory = read("docs/template/delivery-story.md");
    const operationsRunbook = read("docs/template/operations-runbook.md");

    expect(verifyPipeline).not.toMatch(/name: (?:taste|contract-review)/u);
    expect(deliveryStory).toContain("run manually");
    expect(deliveryStory).not.toContain(
      "two fail-closed LLM review gates (taste and contract review)",
    );
    expect(operationsRunbook).toContain(
      "AI review gates are manual under the current Woodpecker topology",
    );
    expect(operationsRunbook).not.toContain(
      "read the step logs for `taste`,\n`contract-review`",
    );
  });

  it("checks in pipeline entrypoints as executable files", () => {
    for (const name of readdirSync(resolve(root, "tooling/ci")).filter((name) =>
      name.endsWith(".sh"),
    )) {
      const path = `tooling/ci/${name}`;
      expect(statSync(resolve(root, path)).mode & 0o111, path).not.toBe(0);
    }
  });
});
