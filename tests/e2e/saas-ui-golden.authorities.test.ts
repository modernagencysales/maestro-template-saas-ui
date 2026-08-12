import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { previewCommand } from "../../tooling/saas-ui/golden-authority-command";

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
});
