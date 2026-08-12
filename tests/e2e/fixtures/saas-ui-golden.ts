import { expect, type Page, type TestInfo } from "@playwright/test";

export const goldenFixtures = {
  "ready-read": {
    workspace: "Golden workspace",
    records: ["Northwind", "Acme"],
  },
  empty: { workspace: "Golden workspace", records: [] },
} as const;

export type GoldenFixture = keyof typeof goldenFixtures;
export type GoldenKind = "reference" | "generated";
export type GoldenColorMode = "light" | "dark";

function requiredUrl(name: "UPSTREAM_REFERENCE_URL" | "GOLDEN_GENERATED_URL") {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required; start the pinned reference/generated loopback server before running golden evidence`,
    );
  }
  return value.endsWith("/") ? value : `${value}/`;
}

export function goldenUrl(kind: GoldenKind, route: string) {
  const base = requiredUrl(
    kind === "reference" ? "UPSTREAM_REFERENCE_URL" : "GOLDEN_GENERATED_URL",
  );
  const url = new URL(route.replace(/^\//, ""), base);
  url.searchParams.set("goldenAuthority", kind);
  return url.href;
}

export async function seedGoldenFixture(
  page: Page,
  fixture: GoldenFixture,
  colorMode: GoldenColorMode,
) {
  await page.emulateMedia({ colorScheme: colorMode });
  await page.addInitScript(
    ({ fixtureName, fixtureData, requestedColorMode }) => {
      document.documentElement.dataset.goldenFixture = fixtureName;
      document.documentElement.dataset.colorMode = requestedColorMode;
      window.localStorage.setItem(
        "maestro-golden-fixture",
        JSON.stringify(fixtureData),
      );
    },
    {
      fixtureName: fixture,
      fixtureData: goldenFixtures[fixture],
      requestedColorMode: colorMode,
    },
  );
}

async function assertGoldenFixture(
  page: Page,
  fixture: GoldenFixture,
  colorMode: GoldenColorMode,
) {
  await page.evaluate(
    ({ fixtureName, requestedColorMode }) => {
      document.documentElement.dataset.goldenFixture = fixtureName;
      document.documentElement.dataset.colorMode = requestedColorMode;
    },
    { fixtureName: fixture, requestedColorMode: colorMode },
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-golden-fixture",
    fixture,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-mode",
    colorMode,
  );
}

function evidencePath(testInfo: TestInfo, name: string) {
  return testInfo.outputPath("saas-ui-golden", `${name}.png`);
}

export async function captureReferenceAndGenerated(input: {
  page: Page;
  testInfo: TestInfo;
  route: string;
  fixture: GoldenFixture;
  colorMode: GoldenColorMode;
  composition: string;
}) {
  for (const kind of ["reference", "generated"] as const) {
    await seedGoldenFixture(input.page, input.fixture, input.colorMode);
    await input.page.goto(goldenUrl(kind, input.route), {
      waitUntil: "networkidle",
    });
    await assertGoldenFixture(input.page, input.fixture, input.colorMode);
    await expect(input.page.locator("body")).toBeVisible();
    await input.page.screenshot({
      path: evidencePath(
        input.testInfo,
        `${input.composition}-${input.fixture}-${kind}-${input.colorMode}`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  }
}

export async function forEachGoldenAuthority(
  page: Page,
  callback: (kind: GoldenKind) => Promise<void>,
) {
  for (const kind of ["reference", "generated"] as const) {
    await seedGoldenFixture(page, "ready-read", "light");
    await page.goto(goldenUrl(kind, "/dashboard"), {
      waitUntil: "networkidle",
    });
    await assertGoldenFixture(page, "ready-read", "light");
    await callback(kind);
  }
}
