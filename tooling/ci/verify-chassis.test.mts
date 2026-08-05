import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("customer chassis Woodpecker admission", () => {
  it("runs one pinned, secret-free PR verification step", () => {
    const source = read(".woodpecker/verify.yml");
    expect(source).toContain("tooling/ci/verify-chassis.sh");
    expect(source).toContain("node:22.12.0-bookworm@sha256:");
    expect(source).not.toMatch(/from_secret|^timeout:/mu);
    expect(source).toContain("- event: pull_request");
    expect(source.match(/^ {2}- name:/gmu)).toHaveLength(1);
  });

  it("declares the sole deterministic PR context", () => {
    expect(read(".factory/project.yaml")).toContain(
      "required_contexts: [ci/woodpecker/pr/verify]",
    );
  });

  it("keeps the decisive command closure explicit", () => {
    const script = read("tooling/ci/verify-chassis.sh");
    for (const command of [
      "pnpm exec playwright install --with-deps chromium",
      "pnpm --dir tooling/agent-pack test:customer",
      "pnpm --dir tooling/generators test",
      "pnpm --dir tooling/release test",
      "pnpm --dir apps/cli test:create-root-integration",
      "pnpm --dir apps/web typecheck",
      "pnpm --dir apps/web build",
      "pnpm --dir apps/web test:runtime-longevity",
    ]) {
      expect(script).toContain(command);
    }
  });
});
