import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const goldenFixtures = {
  "ready-read": {
    workspace: "Golden workspace",
    records: ["Northwind", "Acme"],
    state: "ready-read",
  },
  "ready-edit": {
    workspace: "Golden workspace",
    records: ["Northwind", "Acme"],
    state: "ready-edit",
  },
  loading: {
    workspace: "Golden workspace",
    records: [],
    state: "loading",
  },
  empty: { workspace: "Golden workspace", records: [], state: "empty" },
  "mutation-success": {
    workspace: "Golden workspace",
    records: ["Northwind"],
    state: "mutation-success",
  },
  "mutation-failure": {
    workspace: "Golden workspace",
    records: ["Northwind"],
    state: "mutation-failure",
  },
} as const;

export type GoldenFixture = keyof typeof goldenFixtures;
export type GoldenKind = "reference" | "generated";
export type GoldenColorMode = "light" | "dark";
export type GoldenViewport = "desktop" | "mobile";

export type AcceptanceEntry = Readonly<{
  id: string;
  upstream: Readonly<{
    repository: "starter" | "pro";
    commit: string;
    path: string;
  }>;
  factoryDestination: string;
  generatedDestination: string;
  route: string;
  behaviorCheck: string;
  evidence: readonly string[];
}>;

type AcceptanceAuthority = Readonly<{
  schemaVersion: 1;
  entries: readonly AcceptanceEntry[];
}>;

const acceptancePath = resolve(
  process.cwd(),
  "docs/template/saas-ui-acceptance.json",
);

export const acceptanceMap = JSON.parse(
  readFileSync(acceptancePath, "utf8"),
) as AcceptanceAuthority;

if (acceptanceMap.schemaVersion !== 1 || acceptanceMap.entries.length !== 15) {
  throw new Error("Saas UI acceptance map must contain exactly 15 entries");
}

export const acceptanceEntries = acceptanceMap.entries;

function requiredUrl(name: "UPSTREAM_REFERENCE_URL" | "GOLDEN_GENERATED_URL") {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required; start the pinned reference/generated loopback server before running golden evidence`,
    );
  }
  return value.endsWith("/") ? value : `${value}/`;
}

export function concreteRoute(route: string) {
  return route
    .replaceAll(":contactId", "contact-1")
    .replaceAll(":id", "contact-1")
    .replaceAll("$contactId", "contact-1")
    .replaceAll("$id", "contact-1");
}

export function goldenUrl(kind: GoldenKind, route: string) {
  const base = requiredUrl(
    kind === "reference" ? "UPSTREAM_REFERENCE_URL" : "GOLDEN_GENERATED_URL",
  );
  const url = new URL(concreteRoute(route).replace(/^\//, ""), base);
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
      document.documentElement.dataset.goldenState = fixtureData.state;
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

export async function gotoGolden(input: {
  page: Page;
  kind: GoldenKind;
  route: string;
  fixture?: GoldenFixture;
  colorMode?: GoldenColorMode;
}) {
  const fixture = input.fixture ?? "ready-read";
  const colorMode = input.colorMode ?? "light";
  await seedGoldenFixture(input.page, fixture, colorMode);
  await input.page.goto(goldenUrl(input.kind, input.route), {
    waitUntil: "networkidle",
  });
  await expect(input.page.locator("html")).toHaveAttribute(
    "data-golden-fixture",
    fixture,
  );
  await expect(input.page.locator("html")).toHaveAttribute(
    "data-golden-state",
    goldenFixtures[fixture].state,
  );
  await expect(input.page.locator("html")).toHaveAttribute(
    "data-color-mode",
    colorMode,
  );
}

function viewportName(page: Page): GoldenViewport {
  return (page.viewportSize()?.width ?? 1440) <= 600 ? "mobile" : "desktop";
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
  const viewport = viewportName(input.page);
  for (const kind of ["reference", "generated"] as const) {
    await gotoGolden({
      page: input.page,
      kind,
      route: input.route,
      fixture: input.fixture,
      colorMode: input.colorMode,
    });
    await input.page.screenshot({
      path: evidencePath(
        input.testInfo,
        `${input.composition}-${goldenFixtures[input.fixture].state}-${kind}-${viewport}-${input.colorMode}`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  }
}

export async function forEachGoldenAuthority(
  page: Page,
  callback: (kind: GoldenKind) => Promise<void>,
  options: {
    route?: string;
    fixture?: GoldenFixture;
    colorMode?: GoldenColorMode;
  } = {},
) {
  for (const kind of ["reference", "generated"] as const) {
    await gotoGolden({
      page,
      kind,
      route: options.route ?? "/dashboard",
      fixture: options.fixture ?? "ready-read",
      colorMode: options.colorMode ?? "light",
    });
    await callback(kind);
  }
}
