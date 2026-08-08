import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("customer chassis Woodpecker admission", () => {
  it("runs one pinned, secret-free PR verification step", () => {
    const source = read(".woodpecker/verify.yml");
    expect(source).toContain("tooling/ci/verify-chassis.sh");
    expect(source).toContain(
      "node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a",
    );
    expect(source).not.toMatch(/from_secret|^timeout:/mu);
    expect(source).toContain("- event: pull_request");
    expect(source.match(/^ {2}- name:/gmu)).toHaveLength(1);
  });

  it("declares the sole deterministic PR context", () => {
    expect(read(".factory/project.yaml")).toContain(
      "required_contexts: [ci/woodpecker/pr/verify]",
    );
  });

  it("reaches root verification once and keeps only extra chassis proof", () => {
    const script = read("tooling/ci/verify-chassis.sh");
    expect(script).toContain(
      "pnpm exec playwright install --with-deps chromium",
    );
    const gitleaksInstall = script.indexOf(
      "bash tooling/ci/install-gitleaks.sh",
    );
    const installedToolPath = script.indexOf(
      'export PATH="${HOME}/.local/bin:${PATH}"',
    );
    const verify = script.indexOf("pnpm verify");
    expect(gitleaksInstall).toBeGreaterThan(
      script.indexOf("source tooling/ci/setup.sh"),
    );
    expect(gitleaksInstall).toBeLessThan(verify);
    expect(installedToolPath).toBeGreaterThan(gitleaksInstall);
    expect(installedToolPath).toBeLessThan(verify);
    expect(
      script.match(/^bash tooling\/ci\/install-gitleaks\.sh$/gmu),
    ).toHaveLength(1);
    expect(script).not.toContain("install-gitleaks.sh || true");
    expect(script.match(/^pnpm verify$/gmu)).toHaveLength(1);
    expect(script).toContain("pnpm --dir apps/web test:runtime-longevity");
    for (const duplicate of [
      "pnpm --dir tooling/agent-pack test:customer",
      "pnpm --dir tooling/generators test",
      "pnpm --dir tooling/release test",
      "pnpm --dir apps/cli test:create-root-admission",
      "pnpm --dir apps/cli test:create-root-integration",
      "pnpm --dir apps/web typecheck",
      "pnpm --dir apps/web build",
    ]) {
      expect(script, duplicate).not.toContain(duplicate);
    }
  });

  it("binds admission to the selected four-journey records example", () => {
    const packageJson = JSON.parse(read("apps/cli/package.json")) as {
      readonly scripts: Readonly<Record<string, string>>;
    };
    expect(packageJson.scripts["test:create-root-admission"]).toBe(
      "vitest run src/factory/createRootIntegration.test.ts -t 'executes the selected records example by journey name' --maxWorkers=1 --no-file-parallelism",
    );
  });
});
