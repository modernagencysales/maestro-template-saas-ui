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
    expect(source).not.toContain("failure: cancel");
    expect(source).toContain("- event: pull_request");
    expect(source.match(/^ {2}- name:/gmu)).toHaveLength(1);
  });

  it("provisions the syscall tracer before privacy verification", () => {
    const source = read(".woodpecker/verify.yml");
    const install = source.indexOf(
      "apt-get install -y --no-install-recommends strace",
    );

    expect(source).toContain("apt-get update");
    expect(install).toBeGreaterThan(source.indexOf("commands:"));
    expect(install).toBeLessThan(
      source.indexOf("tooling/ci/verify-chassis.sh"),
    );
  });

  it("seeds the current immutable release for offline runtime tests", () => {
    const source = read("tooling/ci/seed-frozen-alpha2-store.sh");

    expect(source).toContain("maestro-template-v0.2.0-alpha.2");
    expect(source).toContain(
      "checkout --quiet --force --detach maestro-template-v0.2.0-alpha.3",
    );
  });

  it("declares the sole deterministic PR context", () => {
    const project = read(".factory/project.yaml");
    expect(project).toContain("required: []");
    expect(project).not.toContain("required: [qlty]");
    expect(project).toContain("required_contexts: [ci/woodpecker/pr/verify]");
  });

  it("includes typed product contract and runtime acceptance in root verification", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      readonly scripts: Readonly<Record<string, string>>;
    };

    expect(packageJson.scripts.verify).toContain("pnpm check:product-contract");
    expect(packageJson.scripts.verify).toContain("pnpm acceptance:required");
  });

  it("runs fast acceptance tooling from the root test command", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      readonly scripts: Readonly<Record<string, string>>;
    };

    expect(packageJson.scripts["test:acceptance-tooling"]).toBe(
      "vitest run tooling/acceptance/product-contract.test.mts tooling/acceptance/playwright-report.test.mts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/template-product-contract-admission.test.mts examples/saas-application/seed/source/tests/runtime.test.ts --maxWorkers=1 --no-file-parallelism && vitest run tooling/acceptance/template-product-contract.test.mts --testNamePattern='template product contract adapter' --maxWorkers=1 --no-file-parallelism",
    );
    expect(
      packageJson.scripts.test.match(/pnpm test:acceptance-tooling/gmu),
    ).toHaveLength(1);
  });

  it("binds root product admissions directly to non-skippable TSX commands", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      readonly scripts: Readonly<Record<string, string>>;
    };

    expect(packageJson.scripts["check:product-contract"]).toBe(
      "tsx tooling/acceptance/template-product-contract-admission.mts structural",
    );
    expect(packageJson.scripts["acceptance:required"]).toBe(
      "tsx tooling/acceptance/template-product-contract-admission.mts required",
    );
    for (const script of [
      packageJson.scripts["check:product-contract"],
      packageJson.scripts["acceptance:required"],
    ]) {
      expect(script).not.toMatch(/\bvitest\b|(?:^|\s)-t(?:\s|$)/u);
    }
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
});
