import { expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertNoNewGoldenServerErrors as assertNoNewServerErrors,
  baselineGoldenServerErrors as readServerErrorBaseline,
} from "../../../tooling/saas-ui/golden-authority-runtime";
import {
  goldenStates,
  type GoldenState,
} from "../../../apps/web/src/features/golden/fixtures";

export const goldenFixtures = Object.fromEntries(
  goldenStates.map((state) => [state, { state }]),
) as Record<GoldenState, { state: GoldenState }>;

export type GoldenFixture = GoldenState;
export type GoldenKind = "reference" | "generated";
export type GoldenColorMode = "light" | "dark";
export type GoldenViewport = "desktop" | "mobile";

const serverErrorEvidenceRoot = resolve(
  process.cwd(),
  "artifacts",
  "saas-ui-golden",
);
const serverErrorBaselines = new WeakMap<Page, Map<GoldenKind, number>>();

export function baselineGoldenServerErrors(
  page: Page,
  authority: GoldenKind,
): number {
  const baseline = readServerErrorBaseline({
    evidenceRoot: serverErrorEvidenceRoot,
    authority,
  });
  const baselines = serverErrorBaselines.get(page) ?? new Map();
  baselines.set(authority, baseline);
  serverErrorBaselines.set(page, baselines);
  return baseline;
}

export function assertNoNewGoldenServerErrors(page: Page): void {
  const baselines = serverErrorBaselines.get(page);
  if (!baselines) return;
  for (const [authority, baseline] of baselines) {
    assertNoNewServerErrors({
      evidenceRoot: serverErrorEvidenceRoot,
      authority,
      baseline,
    });
  }
}

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
  const seedKey = `maestro-golden-seed-${Date.now()}-${Math.random()}`;
  await page.addInitScript(
    ({ colorMode, fixtureData, seedKey }) => {
      window.localStorage.setItem(
        "maestro-golden-fixture",
        JSON.stringify(fixtureData),
      );
      window.localStorage.setItem(
        "maestro-template.cookie-consent",
        "declined",
      );
      window.localStorage.setItem("theme", colorMode);
      const applyThemeSeed = () => {
        const root = document.documentElement;
        if (!root) return;
        root.classList.toggle("dark", colorMode === "dark");
        root.classList.toggle("light", colorMode === "light");
        root.style.colorScheme = colorMode;
      };
      if (document.documentElement) applyThemeSeed();
      else
        document.addEventListener("DOMContentLoaded", applyThemeSeed, {
          once: true,
        });
      const markerKey = `maestro-golden-seed:${seedKey}`;
      if (!window.sessionStorage.getItem(markerKey)) {
        window.localStorage.removeItem("maestro-golden-contacts");
        window.sessionStorage.setItem(markerKey, "1");
      }
    },
    {
      colorMode,
      fixtureData: goldenFixtures[fixture],
      seedKey,
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
  baselineGoldenServerErrors(input.page, input.kind);
  await seedGoldenFixture(input.page, fixture, colorMode);
  await input.page.goto(goldenUrl(input.kind, input.route), {
    waitUntil: "networkidle",
  });
  assertNoNewGoldenServerErrors(input.page);
}

export async function reducedMotionBehavior(page: Page) {
  return page.evaluate(() => {
    const motion = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const style = getComputedStyle(element);
        const animated =
          style.animationName !== "none" || style.transitionProperty !== "none";
        if (!animated) return undefined;
        const durations = [
          ...style.transitionDuration.split(","),
          ...style.animationDuration.split(","),
        ].map((value) => Number.parseFloat(value) || 0);
        return { durations };
      })
      .filter((value): value is { durations: number[] } => value !== undefined);
    return {
      matched: motion.length,
      reduced: motion.every(({ durations }) =>
        durations.every((duration) => duration <= 0.01),
      ),
    };
  });
}

function viewportName(page: Page): GoldenViewport {
  return (page.viewportSize()?.width ?? 1440) <= 600 ? "mobile" : "desktop";
}

function evidencePath(name: string) {
  const evidenceRoot = resolve(process.cwd(), "artifacts", "saas-ui-golden");
  mkdirSync(evidenceRoot, { recursive: true });
  return join(evidenceRoot, `${name}.png`);
}

const meaningfulReadyLocators: Record<string, (page: Page) => Locator> = {
  "app-shell": (page) =>
    page.getByRole("heading", { name: /Good morning, Alex Morgan/i }),
  "dashboard-report": (page) => page.getByRole("heading", { name: "Reports" }),
  "data-grid": (page) => page.getByRole("table"),
  "filterable-collection": (page) =>
    page.getByRole("link", { name: "Jordan Lee", exact: true }),
  "list-detail": (page) =>
    page
      .getByRole("complementary", { name: "Contact details" })
      .getByText("Jordan Lee", { exact: true }),
  "record-aside": (page) =>
    page
      .getByRole("complementary", { name: "Contact details" })
      .getByText("Jordan Lee", { exact: true }),
  "split-inbox": (page) => page.getByRole("row", { name: /Jordan Lee/ }),
  settings: (page) => page.getByText("Account", { exact: true }),
  form: (page) => page.getByRole("heading", { name: "Form archetype" }),
  onboarding: (page) =>
    page.getByRole("heading", { name: "Create a new workspace" }),
  kanban: (page) => page.getByRole("heading", { name: "Contacts" }),
  auth: (page) => page.getByRole("heading", { name: "Log in" }),
  billing: (page) =>
    page.getByRole("heading", { name: "Billing", exact: true }),
  "search-command": (page) =>
    page.getByRole("textbox", { name: /Search your workspace/i }),
  states: (page) => page.getByRole("heading", { name: "State fixture" }),
};

const meaningfulMainContentLocators: Record<string, (page: Page) => Locator> = {
  "list-detail": (page) =>
    page.getByText("created the contact.", { exact: false }),
  "record-aside": (page) =>
    page.getByText("created the contact.", { exact: false }),
  "split-inbox": (page) =>
    page.getByText("created the contact.", { exact: false }),
};

function meaningfulReadyLocator(page: Page, composition: string) {
  const createLocator = meaningfulReadyLocators[composition];
  if (!createLocator) {
    throw new Error(`Missing golden readiness marker for ${composition}`);
  }
  return createLocator(page);
}

export async function waitForGoldenCaptureReady(input: {
  page: Page;
  fixture: GoldenFixture;
  composition: string;
}) {
  await expect(
    input.page.getByRole("region", { name: "Cookie consent" }),
  ).toBeHidden();
  await expect(
    meaningfulReadyLocator(input.page, input.composition),
  ).toBeVisible();
  const mainContent = meaningfulMainContentLocators[input.composition];
  if (mainContent) {
    await expect(mainContent(input.page)).toBeVisible();
  }
  if (input.fixture !== "loading") {
    await expect(
      input.page.locator('[data-scope="suiLoadingOverlay"]'),
    ).toHaveCount(0);
  }
}

export async function captureReferenceAndGenerated(input: {
  page: Page;
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
    await waitForGoldenCaptureReady(input);
    await input.page.screenshot({
      path: evidencePath(
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
