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
import { isExpectedGoldenNavigationAbort } from "./fixtures/saas-ui-golden";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("golden browser authority startup", () => {
  it("allows only aborted lazy scripts from the outgoing authority navigation", () => {
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4173/assets/_workspace._dashboard.tag._tag.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4173/assets/_workspace._dashboard.tag._tag.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
        navigationUrl:
          "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4173/assets/_workspace._dashboard.tag._tag.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4173/contacts?goldenAuthority=reference",
        navigationUrl:
          "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(true);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4173/assets/_workspace._dashboard.tag._tag.js",
        errorText: "net::ERR_FAILED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "document",
        url: "http://127.0.0.1:4173/contacts",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4174/assets/_workspace._dashboard.tag._tag.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "https://example.test/assets/chunk.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
    expect(
      isExpectedGoldenNavigationAbort({
        resourceType: "script",
        url: "http://127.0.0.1:4173/assets/chunk.js",
        errorText: "net::ERR_ABORTED",
        pageUrl: "https://example.test/contacts",
        navigationUrl:
          "http://127.0.0.1:4174/contacts?goldenAuthority=generated",
      }),
    ).toBe(false);
  });

  it("registers one browser gate that runs every behavioral golden spec", () => {
    const packageJson = JSON.parse(
      readFileSync(`${root}/package.json`, "utf8"),
    ) as { scripts: Record<string, string> };

    const browserSmoke = packageJson.scripts["smoke:golden:browser"] ?? "";
    expect(browserSmoke).toBeTypeOf("string");
    expect(browserSmoke).toContain("saas-ui-golden.spec.ts");
    expect(packageJson.scripts["smoke:golden:browser"]).toContain(
      "saas-ui-golden.acceptance.spec.ts",
    );
    expect(packageJson.scripts["smoke:golden:browser"]).toContain(
      "saas-ui-golden.interactions.spec.ts",
    );
  });

  it("installs automatic browser runtime-error gates", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden-test.ts`,
      "utf8",
    );

    expect(fixture).toContain('page.on("console"');
    expect(fixture).toContain('page.on("pageerror"');
    expect(fixture).toContain('page.on("requestfailed"');
    expect(fixture).toContain('page.on("response"');
    expect(fixture).toContain('resourceType() === "document"');
    expect(fixture).toContain('resourceType() === "script"');
    expect(fixture).toContain("status() >= 400");
    expect(fixture).toContain("assertNoNewGoldenServerErrors");
    const helper = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );
    expect(helper).toContain("baselineGoldenServerErrors");
  });

  it("captures and tees authority launcher output into redacted server evidence", () => {
    const authorityScript = readFileSync(
      `${root}/tooling/saas-ui/golden-authority.mts`,
      "utf8",
    );

    expect(authorityScript).toContain('stdio: ["ignore", "pipe", "pipe"]');
    expect(authorityScript).toContain("process.stdout.write");
    expect(authorityScript).toContain("process.stderr.write");
    expect(authorityScript).toContain("createGoldenServerErrorRecorder");
    expect(authorityScript).toContain("evidenceRoot");
  });

  it("keeps evidence outside Playwright's disposable output directory", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );

    expect(fixture).toContain('"artifacts", "saas-ui-golden"');
    expect(fixture).not.toContain('testInfo.outputPath("saas-ui-golden"');
  });

  it("starts a pinned reference and a freshly generated customer target", () => {
    const config = readFileSync(`${root}/playwright.config.ts`, "utf8");

    expect(config).toContain("tooling/saas-ui/golden-authority.mts reference");
    expect(config).toContain("tooling/saas-ui/golden-authority.mts generated");
    expect(config).not.toContain("reuseExistingServer: true");
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
      "const targetRoot = generated?.targetRoot ?? repositoryRoot",
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
          join(
            targetRoot,
            "apps/web/src/routes/_workspace._dashboard.admin.tsx",
          ),
        ),
      ).toBe(false);
      expect(
        existsSync(
          join(
            targetRoot,
            "apps/web/src/routes/_workspace._dashboard.agents.tsx",
          ),
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

  it("keeps shared fixture seeding independent of route content", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );
    const readinessLocators = fixture.indexOf("const meaningfulReadyLocators");
    expect(readinessLocators).toBeGreaterThanOrEqual(0);
    const sharedFixture = fixture.slice(0, readinessLocators);

    expect(sharedFixture).not.toContain("Good morning, Alex Morgan");
    expect(sharedFixture).not.toContain('page.getByText("Acme Inc.")');
  });

  it("seeds fixtures before navigation without self-authored result metadata", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );
    const navigation = fixture.indexOf("await input.page.goto");
    expect(fixture).toContain("window.localStorage.setItem");
    expect(navigation).toBeGreaterThanOrEqual(0);
    expect(fixture).not.toContain("document.documentElement.dataset.golden");
    expect(fixture).not.toContain('toHaveAttribute(\n    "data-golden');
  });

  it("clears persisted mutations once per seed but preserves them on reload", () => {
    const fixture = readFileSync(
      `${root}/tests/e2e/fixtures/saas-ui-golden.ts`,
      "utf8",
    );

    expect(fixture).toContain("window.sessionStorage.getItem(markerKey)");
    expect(fixture).toContain('window.sessionStorage.setItem(markerKey, "1")');
    expect(fixture).toMatch(
      /if \(!window\.sessionStorage\.getItem\(markerKey\)\) \{[\s\S]*?removeItem\("maestro-golden-contacts"\)/,
    );
  });
});
