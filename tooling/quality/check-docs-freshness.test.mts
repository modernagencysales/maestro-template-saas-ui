import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { expectDescriptorPassesAndFails } from "./src/check-test-helpers.mts";
import { descriptor } from "./check-docs-freshness.mts";

describe("check:docs-freshness", () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const readRepoFile = (path: string): string =>
    readFileSync(resolve(repoRoot, path), "utf8");
  const normalizeMarkdownText = (text: string): string =>
    text.replace(/\s+/g, " ");

  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("keeps starter quickstart and maturity docs aligned with the real command flow", () => {
    const quickstart = normalizeMarkdownText(
      readRepoFile("docs/template/quickstart.md"),
    );
    const maturity = normalizeMarkdownText(
      readRepoFile("docs/template/template-maturity-model.md"),
    );
    const backlog = normalizeMarkdownText(
      readRepoFile("docs/template/porting-backlog.md"),
    );

    expect(quickstart).toContain(
      'pnpm maestro -- create ../launch-tracker \\ --name "Launch Tracker"',
    );
    expect(quickstart).toContain(
      "pnpm --dir ../launch-tracker maestro -- preflight --mode fake",
    );
    expect(quickstart).toContain('git commit -m "feat: add Milestone slice"');
    expect(maturity).toContain(
      "Current baseline: this repo can prove L0 through L4",
    );
    expect(maturity).toContain("L5 is client-fork-specific");
    expect(maturity).toContain(
      "apps/web/src/features/common/layouts/app-layout.tsx",
    );
    expect(maturity).toContain("docs/template/saas-ui-frontend-authority.md");
    expect(maturity).not.toContain("apps/web/src/saas-ui/business-shell.tsx");
    expect(
      readRepoFile("docs/template/golden-path-business-slice.md"),
    ).not.toContain("apps/web/src/saas-ui/business-shell.tsx");
    expect(backlog).toContain(
      "Current readiness commands and the maturity model are authoritative",
    );
  });

  it("keeps template default decisions explicit for client fork surfaces", () => {
    const defaults = normalizeMarkdownText(
      readRepoFile("docs/template/template-defaults.md"),
    );
    const maturity = normalizeMarkdownText(
      readRepoFile("docs/template/template-maturity-model.md"),
    );
    const status = normalizeMarkdownText(
      readRepoFile("docs/template/effectification-status.md"),
    );

    expect(defaults).toContain("Template Defaults And Extension Paths");
    expect(defaults).toContain("Billing");
    expect(defaults).toContain("Notifications");
    expect(defaults).toContain("Retention and DSAR");
    expect(defaults).toContain("Deploy promotion");
    expect(defaults).toContain(
      "Promotion is a code, docs, test, and handoff event",
    );
    expect(maturity).toContain(
      "[template-defaults.md](./template-defaults.md)",
    );
    expect(status).toContain("[template-defaults.md](./template-defaults.md)");
  });
});
