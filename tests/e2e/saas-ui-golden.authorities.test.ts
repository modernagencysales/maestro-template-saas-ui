import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { previewCommand } from "../../tooling/saas-ui/golden-authority-command";
import { buildSaasApplicationTargetPlan } from "../../tooling/generators/src/blueprints/saasApplication";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("golden browser authority startup", () => {
  it("starts a pinned reference and a freshly generated customer target", () => {
    const config = readFileSync(`${root}/playwright.config.ts`, "utf8");

    expect(config).toContain("tooling/saas-ui/golden-authority.mts reference");
    expect(config).toContain("tooling/saas-ui/golden-authority.mts generated");
    expect(config).not.toMatch(/apps\/web preview/);
  });

  it("materializes generated output in a distinct temporary root and hashes both authorities", () => {
    const authorityScript = readFileSync(
      `${root}/tooling/saas-ui/golden-authority.mts`,
      "utf8",
    );

    expect(authorityScript).toContain("mkdtempSync");
    expect(authorityScript).toContain('createHash("sha256")');
    expect(authorityScript).toContain(
      "const targetRoot = generated?.targetRoot ?? starterRoot",
    );
    expect(authorityScript).toContain("must have a distinct root and digest");
    expect(authorityScript).toContain("buildSaasApplicationTargetPlan");
    expect(authorityScript).not.toContain("copyTrackedScaffold");
    expect(authorityScript).toContain('["install", "--frozen-lockfile"]');
  });

  it("does not materialize factory-only route sentinels into the generated target", () => {
    const plan = buildSaasApplicationTargetPlan({ name: "Authority absence" });
    const targetRoot = join(root, ".tmp-golden-authority-test");
    rmSync(targetRoot, { recursive: true, force: true });
    try {
      for (const entry of plan.entries) {
        const target = join(targetRoot, entry.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, entry.content);
      }
      expect(
        existsSync(
          join(targetRoot, "apps/web/src/routes/_workspace.admin.tsx"),
        ),
      ).toBe(false);
      expect(
        existsSync(
          join(targetRoot, "apps/web/src/routes/_workspace.agents.tsx"),
        ),
      ).toBe(false);
    } finally {
      rmSync(targetRoot, { recursive: true, force: true });
    }
  });

  it("previews the generated target app rather than the factory app", () => {
    const command = previewCommand({
      repositoryRoot: "/repo",
      targetRoot: "/tmp/generated-target",
      authority: "generated",
      port: "4174",
    });

    expect(command.cwd).toBe("/tmp/generated-target/apps/web");
    expect(command.args).toContain("--dir");
    expect(command.args).toContain("/tmp/generated-target/apps/web");
    expect(command.args).not.toContain("/repo/apps/web");
  });

  it("keeps shared fixture validation independent of route content", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );

    expect(fixture).not.toContain("Good morning, Alex Morgan");
    expect(fixture).not.toContain('page.getByText("Acme Inc.")');
  });

  it("stamps fixture metadata after navigation while seeding storage before it", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );
    const navigation = fixture.indexOf("await input.page.goto");
    const metadata = fixture.indexOf(
      "document.documentElement.dataset.goldenFixture",
    );

    expect(fixture).toContain("window.localStorage.setItem");
    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(metadata).toBeGreaterThan(navigation);
    expect(fixture).toContain("data-golden-state");
    expect(fixture).toContain("data-color-mode");
  });
});
