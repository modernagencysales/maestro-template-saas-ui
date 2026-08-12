import { type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertNoNewGoldenServerErrors as assertNoNewServerErrors,
  baselineGoldenServerErrors as readServerErrorBaseline,
} from "../../../tooling/saas-ui/golden-authority-runtime";

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
  await page.addInitScript(
    ({ fixtureData }) => {
      window.localStorage.setItem(
        "maestro-golden-fixture",
        JSON.stringify(fixtureData),
      );
    },
    {
      fixtureData: goldenFixtures[fixture],
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

function viewportName(page: Page): GoldenViewport {
  return (page.viewportSize()?.width ?? 1440) <= 600 ? "mobile" : "desktop";
}

function evidencePath(name: string) {
  const evidenceRoot = resolve(process.cwd(), "artifacts", "saas-ui-golden");
  mkdirSync(evidenceRoot, { recursive: true });
  return join(evidenceRoot, `${name}.png`);
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
