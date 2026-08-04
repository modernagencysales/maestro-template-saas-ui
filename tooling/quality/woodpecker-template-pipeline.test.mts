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

    expect(existsSync(resolve(root, ".github/workflows/quality.yml"))).toBe(
      false,
    );
  });

  it("provisions the Linux syscall tracer required by privacy gates", () => {
    expect(read(".woodpecker/verify.yml")).toContain(
      "apt-get install -y --no-install-recommends strace",
    );
  });

  it("runs the comprehensive verification suite exactly once", () => {
    const phase = read("tooling/ci/phase1.sh");
    expect(phase.match(/^pnpm verify$/gmu)).toHaveLength(1);
    expect(phase).not.toContain("pnpm check:coverage-ratchet");
    expect(phase).not.toContain("pnpm check:types-coverage");
  });

  it("allows the measured full verification suite to finish", () => {
    expect(read(".woodpecker/verify.yml")).toContain("timeout: 60");
  });

  it("bootstraps deploy preflights with the checksum-pinned pnpm setup", () => {
    const deployPipeline = read(".woodpecker/deploy.yml");
    expect(deployPipeline).toContain("source tooling/ci/setup.sh");
    expect(deployPipeline).not.toContain("corepack enable");
  });

  it("keeps candidate verification tokenless and Qlty advisory", () => {
    const verifyPipeline = read(".woodpecker/verify.yml");
    expect(verifyPipeline).not.toContain("GITHUB_TOKEN");
    expect(verifyPipeline).not.toContain("from_secret:");
    expect(verifyPipeline).toContain("name: qlty-advisory");
    expect(verifyPipeline).toContain("timeout 30s pnpm check:qlty || true");
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
