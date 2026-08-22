# Upstream-Derived Saas UI Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every freshly generated Maestro SaaS application ship a running
frontend chassis directly transplanted from the pinned TanStack Start Starter
Kit Pro and the complete pinned Saas UI Pro registry, with no competing generic
UI authority.

**Architecture:** Preserve upstream source structure and behavior, then adapt
only its route, authentication, service, and neutral-data seams. A
registry-driven materializer commits the complete editable Pro graph; one
provenance manifest, one empty-by-default deviation ledger, and one acceptance
map drive projection and verification. The factory app and a fresh generated
target use the same frontend closure, while the immutable public release remains
unchanged until separately authorized.

**Tech Stack:** React 19, TanStack Start/Router, Chakra UI 3, Saas UI 3, Saas UI
Pro, WorkOS AuthKit, Convex, TypeScript, Vitest, Playwright,
`@axe-core/playwright`, ESLint 9, pnpm 10.

## Global Constraints

- Source pins are exact: template `acf0bc4be38dea842f321831387fc77cf7242439`,
  starter `b76cb4514b9ab47f7db87901cb9b593b4adc3129`, and Pro
  `ac3a40c8dc05e403f9d501a87c092646891d3c40`.
- Preserve upstream JSX structure, component selection, style props, theme
  behavior, spacing, density, typography, responsive behavior, keyboard
  behavior, focus behavior, and interaction composition.
- Permitted adaptations are limited to TanStack route definitions,
  WorkOS/Convex/service seams, neutral fixtures, semantic product roles, and the
  smallest dependency-compatibility changes.
- Every structural or style deviation must identify the exact source,
  destination, changed property or structure, compatibility reason, and
  evidence; aesthetic preference is invalid and the target ledger is empty.
- The complete installable catalog is derived from the pinned Pro registry;
  policy and tests must not hard-code `27`.
- The frontend foundation is mandatory generated-app chassis, never an optional
  `SaasApplicationPatternSelection`.
- Use one shared neutral fixture data set for the pinned reference and
  generated-app captures.
- Reuse the repository's Playwright and `@axe-core/playwright`; add no
  visual-regression or accessibility dependency.
- Preserve upstream license notices and prevent paid source from entering a
  public npm package, public artifact, or unintended distribution bundle.
- Maestro Brain and `modernagencysales/b2b-creator-os` remain unchanged until
  the owner approves both the running golden app's appearance and interactions.
- Do not seal or publish a release, change `CURRENT_PUBLIC_SOURCE`, overwrite
  `releases/v0.2.0-alpha.3`, deploy externally, merge, or enable Fabro in this
  batch.
- Woodpecker status `ci/woodpecker/pr/verify` on the exact final head is
  blocking; every Qlty result is advisory.
- Focused task checks run per commit. Run full `pnpm verify` exactly once on the
  immutable final batch head, preferably through `maestro-remote-test`.

## Scope Guard

- In scope: the factory frontend, mandatory current-blueprint projection,
  private-source provenance, complete Pro block materialization, golden
  generated target, guardrails, browser evidence, and owner review instructions.
- Preserved domain scope: WorkOS, Convex, Confect, Effect, CLI, MCP, public
  funnel behavior, and backend authorities change only where an import must
  point at the accepted frontend adapter.
- Out of scope: product migrations, frontend redesign, backend redesign, a
  plugin framework, a second UI abstraction, release sealing/publication/default
  switching, and deployment of paid source to a public host.

## Quality Targets

- The generated shell, theme, menus, search, layouts, and archetypes retain
  their pinned upstream structure; `saas-ui-deviations.json` is `[]` unless a
  concrete compatibility proof requires an entry.
- `components.json.installed` equals the complete sorted installable Pro
  registry root set, and a second materialization is byte-for-byte idempotent.
- A fresh generated target installs, typechecks, builds, starts, and passes
  behavior, accessibility, and capture checks without factory-only aliases or
  workspace-only paid dependencies.
- No route imports `business-shell.tsx`; no generic `@maestro-template/ui`
  shell, page, table, drawer, dialog, empty-state, or visualization substitute
  survives.
- Authenticated desktop/mobile and light/dark captures use identical fixtures on
  the upstream reference and generated target.

## Test Plan

- Static contracts: pins, provenance, registry graph completeness, deterministic
  hashes, empty/explained deviations, licenses, artifact privacy, semantic
  colors, shell import authority, and projection closure.
- Component behavior: loading, empty, ready/read, ready/edit, toggle, mutation
  success, and mutation failure where supported by each archetype.
- Browser behavior: resize/collapse/persist/flyout/mobile sidebar, menus, global
  search and keyboard commands, DataGrid filter/sort/page/select, list-board
  switch, split/detail navigation, Kanban drag, overlays, forms, and focus
  restoration.
- Accessibility: automated axe checks plus keyboard-only completion, visible
  focus, names, focus trap/restore, reduced motion, 200% zoom, and 320 px
  reflow.
- Visual evidence: direct pinned-reference versus fresh-generated captures for
  desktop/mobile and light/dark, plus meaningful archetype states;
  component-presence assertions do not count.

## Delivery Batches

### Batch 1: Private upstream-derived frontend candidate

- Tasks: 1-12.
- Branch/head: `feature/saas-ui-upstream-transplant-design`; freeze and record
  its final SHA after Task 12.
- Base: `origin/main` at `acf0bc4be38dea842f321831387fc77cf7242439`.
- PR target: `main` in the private `maestro-template-saas-ui` repository.
- Focused checks: each task's named Vitest, ESLint, TypeScript, generator,
  build, or Playwright command.
- Whole-batch review: `rtk git diff --check origin/main...HEAD` and
  `rtk git diff --stat origin/main...HEAD`, followed by the repository's
  requesting-code-review workflow.
- Required verification: commit the final implementation head, then run
  `rtk maestro-remote-test -- pnpm verify` once. If the remote worker is
  unavailable, run `rtk host-test-slot --class full pnpm verify` once.
- CI authority: open a draft PR and require `ci/woodpecker/pr/verify` on that
  exact SHA; record Qlty without blocking.
- Acceptance boundary: produce a local/private running golden URL and evidence
  bundle, then stop for owner approval. Release sealing, publication,
  public-default switching, deployment, and product migrations require later
  explicit authorization.

---

### Task 1: Establish the source and acceptance authorities

**Files:**

- Create: `docs/template/saas-ui-upstream.json`
- Create: `docs/template/saas-ui-deviations.json`
- Create: `docs/template/saas-ui-acceptance.json`
- Create: `tooling/quality/saas-ui-foundation.ts`
- Create: `tooling/quality/saas-ui-foundation.test.ts`
- Create: `tooling/quality/check-saas-ui-foundation.mts`
- Modify: `package.json`

**Interfaces:**

- Consumes: the three exact source commits in Global Constraints and repository
  files resolved relative to the factory root.
- Produces: `readSaasUiManifest(root: string): SaasUiManifest`,
  `readSaasUiDeviations(root: string): readonly SaasUiDeviation[]`,
  `readSaasUiAcceptance(root: string): SaasUiAcceptanceMap`, and
  `checkSaasUiFoundation(root: string): readonly string[]`.
- Produces schema fields: `pins`, `registry`, `compositions`, `licenses`,
  `factoryDestination`, `generatedDestination`, `route`, `behaviorCheck`, and
  `evidence`.

- [ ] **Step 1: Write the failing authority tests**

```ts
it("pins every paid source and maps every accepted composition", () => {
  const manifest = readSaasUiManifest(root);
  expect(manifest.pins).toEqual({
    template: "acf0bc4be38dea842f321831387fc77cf7242439",
    starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
    pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
  });
  expect(new Set(manifest.compositions.map(({ id }) => id))).toEqual(
    new Set([
      "app-shell",
      "dashboard-report",
      "data-grid",
      "filterable-collection",
      "list-detail",
      "split-inbox",
      "record-aside",
      "settings",
      "form",
      "onboarding",
      "kanban",
      "auth",
      "billing",
      "search-command",
      "states",
    ]),
  );
  expect(readSaasUiDeviations(root)).toEqual([]);
  expect(checkSaasUiFoundation(root)).toEqual([]);
});
```

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm exec vitest run tooling/quality/saas-ui-foundation.test.ts`

Expected: FAIL because `saas-ui-foundation.ts` and the three JSON authorities do
not exist.

- [ ] **Step 3: Add the minimal typed readers and checker**

```ts
export type SaasUiManifest = Readonly<{
  schemaVersion: 1;
  pins: Readonly<Record<"template" | "starter" | "pro", string>>;
  registry: Readonly<{ catalog: string; config: string; installRoot: string }>;
  compositions: readonly Readonly<{
    id: string;
    source: string;
    factoryDestination: string;
    generatedDestination: string;
    files: readonly Readonly<{ source: string; destination: string }>[];
  }>[];
  licenses: readonly Readonly<{
    source: "starter" | "pro";
    path: string;
    destination: string;
  }>[];
}>;

export type SaasUiDeviation = Readonly<{
  source: string;
  destination: string;
  change: string;
  reason: string;
  evidence: string;
}>;

export type SaasUiAcceptanceMap = Readonly<{
  schemaVersion: 1;
  entries: readonly Readonly<{
    id: string;
    upstream: { repository: "starter" | "pro"; commit: string; path: string };
    factoryDestination: string;
    generatedDestination: string;
    route: string;
    behaviorCheck: string;
    evidence: readonly string[];
  }>[];
}>;
```

Populate the manifest with the exact starter files named in Tasks 3-5, the
registry catalog/config destinations from Task 2, and license destinations under
`docs/licenses/saas-ui/`. Populate the acceptance map with one entry per
composition ID and leave `docs/template/saas-ui-deviations.json` as `[]`.

- [ ] **Step 4: Wire and pass the focused check**

Add
`"check:saas-ui-foundation": "tsx tooling/quality/check-saas-ui-foundation.mts"`
to root scripts. Make the executable print errors and set
`process.exitCode = 1`, or print `Saas UI foundation verified.` when
`checkSaasUiFoundation(process.cwd())` returns no errors.

Run:
`rtk pnpm exec vitest run tooling/quality/saas-ui-foundation.test.ts && rtk pnpm check:saas-ui-foundation`

Expected: PASS and `Saas UI foundation verified.`

- [ ] **Step 5: Commit**

Run:
`rtk git add docs/template/saas-ui-upstream.json docs/template/saas-ui-deviations.json docs/template/saas-ui-acceptance.json tooling/quality/saas-ui-foundation.ts tooling/quality/saas-ui-foundation.test.ts tooling/quality/check-saas-ui-foundation.mts package.json && rtk git commit -m "test: define saas ui source authority"`

### Task 2: Materialize the complete editable Pro registry graph

**Files:**

- Create: `apps/web/components.json`
- Create: `tooling/saas-ui/materialize-pro-registry.mts`
- Create: `tooling/saas-ui/materialize-pro-registry.test.ts`
- Create: registry-resolved files under `apps/web/src/components/` as recorded
  by `apps/web/components.json`
- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/template/saas-ui-upstream.json`
- Modify: `docs/template/saas-ui-acceptance.json`

**Interfaces:**

- Consumes: `@saas-ui/cli@0.1.0-next.1` consumer APIs, pinned Pro
  `packages/blocks/**/component.config.ts`,
  `packages/registry/scripts/build-registry.ts`,
  `packages/registry/public/public-catalog.json`, generated registry payloads,
  and aliases rooted at `apps/web/src`.
- Produces:
  `materializeProRegistry({ proRoot, targetRoot }): Promise<RegistryMaterialization>`
  where `RegistryMaterialization` contains sorted `installed`, resolved
  `items: { name: string; sourceConfig: string }[]`,
  `files: { path: string; sha256: string }[]`, and external dependency
  declarations.
- Produces: `apps/web/components.json.installed`, the sorted complete
  installable root set derived from registry metadata.

- [ ] **Step 1: Write the failing completeness and idempotency test**

```ts
it("installs every published Pro root and is byte-idempotent", async () => {
  const first = await materializeProRegistry({ proRoot, targetRoot });
  const authoredRoots = discoverComponentConfigs(
    join(proRoot, "packages/blocks"),
  );
  expect(first.installed).toHaveLength(authoredRoots.length);
  for (const config of authoredRoots)
    expect(
      first.items.some(({ sourceConfig }) => sourceConfig === config),
    ).toBe(true);
  expect(
    JSON.parse(readFileSync(join(targetRoot, "components.json"), "utf8"))
      .installed,
  ).toEqual(first.installed);
  const before = snapshot(targetRoot);
  await materializeProRegistry({ proRoot, targetRoot });
  expect(snapshot(targetRoot)).toEqual(before);
});
```

Also assert zero conflicts, every planned hash equals the installed file hash,
local imports resolve, dependencies are declared, and no installed source
contains `workspace:`, `@/registry/`, `#registry/`, or a path back into the paid
source checkout.

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm exec vitest run tooling/saas-ui/materialize-pro-registry.test.ts`

Expected: FAIL because the materializer and `components.json` are absent.

- [ ] **Step 3: Implement the upstream consumer flow without a second block
      list**

```ts
const index = await client.getIndex();
const installed = index
  .filter(({ type }) => isRegistryItemTypeInstallable(type))
  .map(({ name }) => name)
  .sort();
const graph = await resolveRegistryGraph(installed, "default", client);
const config = await resolveConfigPaths(targetRoot, {
  system: "chakra",
  style: "default",
  rsc: false,
  tsx: true,
  aliases: {
    components: "@/components",
    ui: "@/components/ui",
    lib: "@/lib",
    utils: "@/lib/utils",
    hooks: "@/hooks",
    icons: "@/components/icons",
  },
});
const result = await installRegistryItems(installed, config, {
  client,
  dependencyInstaller,
  silent: true,
});
if (result.plan.conflicts.length)
  throw new Error(
    `Pro registry conflicts: ${result.plan.conflicts.join(", ")}`,
  );
```

Before resolving the client, run the pinned checkout's existing
`packages/registry/scripts/build-registry.ts` so the index and payloads are
generated from every discovered `component.config.ts`; compare the resulting
root names with the independently discovered config-directory names. Use the
pinned local registry payload resolver from the Pro consumer fixture semantics;
do not fetch `latest` and do not manually copy the 27 block directories. Add
only registry-requested runtime dependencies, using non-workspace versions
compatible with the pinned template.

- [ ] **Step 4: Generate, verify, and check formatting**

Add root script
`"saas-ui:materialize": "tsx tooling/saas-ui/materialize-pro-registry.mts"`. Run
it with explicit source authority:

`rtk pnpm --dir /Users/headless/.cache/codex-research/saas-ui-pro/packages/registry build:registry && rtk pnpm saas-ui:materialize -- --pro-root /Users/headless/.cache/codex-research/saas-ui-pro`

Then run:
`rtk pnpm exec vitest run tooling/saas-ui/materialize-pro-registry.test.ts && rtk pnpm --dir apps/web typecheck && rtk pnpm prettier --check apps/web/components.json apps/web/src/components tooling/saas-ui`

Expected: all PASS; the command reports the registry-derived root and dependency
counts, and the second invocation changes no file.

- [ ] **Step 5: Commit**

Run:
`rtk git add apps/web/components.json apps/web/src/components apps/web/package.json package.json pnpm-lock.yaml tooling/saas-ui docs/template/saas-ui-upstream.json docs/template/saas-ui-acceptance.json && rtk git commit -m "feat: install complete saas ui pro registry"`

### Task 3: Transplant the exact theme and provider foundation

**Files:**

- Create: `tooling/saas-ui/transplant-starter.mts`
- Create: `tooling/saas-ui/transplant-starter.test.ts`
- Create: `apps/web/src/theme/preset.ts`
- Create: `apps/web/src/theme/semantic-tokens/colors.ts`
- Create: `apps/web/src/features/common/providers/app-provider.tsx`
- Create: `apps/web/src/features/common/components/hotkeys.tsx`
- Create: `apps/web/src/config/hotkeys.config.ts`
- Create: `apps/web/src/theme/upstream-theme.test.ts`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/saas-ui/provider.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: starter `theme/preset.ts`, `theme/semantic-tokens/colors.ts`,
  `features/common/providers/app-provider.tsx`, and
  `features/common/components/hotkeys.tsx`; the existing TanStack `Link`;
  existing WorkOS/Convex providers.
- Produces:
  `transplantStarter({ starterRoot, targetRoot, ids }): Promise<readonly TransplantedFile[]>`,
  which rejects a starter checkout whose `HEAD` differs from the manifest pin
  and copies only manifest-listed paths while preserving bytes.
- Produces: `system`, `AppProvider({ children, onError })`, `Hotkeys`, preserved
  light/dark semantic tokens, Inter variable font loading, and one provider
  chain used by `__root.tsx`.

- [ ] **Step 1: Write the failing source-fidelity test**

```ts
it("keeps the starter preset and provider composition authoritative", () => {
  expect(read("src/theme/preset.ts")).toContain(
    "createSystem(defaultConfig, config)",
  );
  expect(read("src/theme/preset.ts")).toContain("@saas-ui/chakra-preset");
  expect(read("src/features/common/providers/app-provider.tsx")).toContain(
    "<SuiProvider",
  );
  expect(read("src/features/common/providers/app-provider.tsx")).toContain(
    "linkComponent={LinkComponent}",
  );
  expect(read("src/index.css")).not.toMatch(/--(?:chakra|saas)-colors-/);
});

it("rejects an unpinned starter checkout", async () => {
  await expect(
    transplantStarter({
      starterRoot: wrongCommitRoot,
      targetRoot,
      ids: ["theme"],
    }),
  ).rejects.toThrow(/expected b76cb451/);
});
```

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm --dir apps/web test -- src/theme/upstream-theme.test.ts`

Expected: FAIL because the upstream preset and provider files are absent.

- [ ] **Step 3: Transplant and adapt only provider seams**

Implement the small pinned copier and use it for the theme/provider source
closure:

```ts
type TransplantOptions = Readonly<{
  starterRoot: string;
  targetRoot: string;
  ids: readonly string[];
}>;
type TransplantedFile = Readonly<{
  source: string;
  destination: string;
  sha256: string;
}>;

export async function transplantStarter({
  starterRoot,
  targetRoot,
  ids,
}: TransplantOptions): Promise<readonly TransplantedFile[]> {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: starterRoot,
    encoding: "utf8",
  }).trim();
  if (actual !== manifest.pins.starter)
    throw new Error(
      `Starter checkout ${actual}; expected ${manifest.pins.starter}`,
    );
  const files = manifest.compositions
    .filter(({ id }) => ids.includes(id))
    .flatMap(({ files }) => files);
  return files.map((file) => {
    const source = resolve(starterRoot, file.source);
    const destination = resolve(targetRoot, file.destination);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return {
      ...file,
      sha256: createHash("sha256")
        .update(readFileSync(destination))
        .digest("hex"),
    };
  });
}
```

Run
`rtk pnpm exec tsx tooling/saas-ui/transplant-starter.mts --starter-root /Users/headless/.tmp/saas-ui-tanstack-pro --ids theme,provider`.
Retain the preset recipes and semantic tokens byte-for-byte. In `AppProvider`,
replace only starter workspace config and feature-service imports with current
template values; keep this provider shape:

```tsx
return (
  <SuiProvider linkComponent={LinkComponent} onError={onError} value={system}>
    <Hotkeys hotkeys={appHotkeys}>{children}</Hotkeys>
  </SuiProvider>
);
```

Keep WorkOS, Convex, query, toast, and error providers outside this upstream
composition in `__root.tsx`; remove the reconstructed theme from
`saas-ui/provider.tsx`. Reduce `index.css` to the starter font import and global
browser resets that are not already in the preset.

- [ ] **Step 4: Verify theme behavior and compatibility**

Run:
`rtk pnpm exec vitest run tooling/saas-ui/transplant-starter.test.ts && rtk pnpm --dir apps/web test -- src/theme/upstream-theme.test.ts src/dependency-compatibility.test.ts && rtk pnpm --dir apps/web typecheck && rtk pnpm --dir apps/web build`

Expected: PASS; production build contains both color modes and no duplicate
system provider.

- [ ] **Step 5: Commit**

Run:
`rtk git add tooling/saas-ui/transplant-starter.mts tooling/saas-ui/transplant-starter.test.ts apps/web/src/theme apps/web/src/config/hotkeys.config.ts apps/web/src/features/common/providers apps/web/src/features/common/components/hotkeys.tsx apps/web/src/routes/__root.tsx apps/web/src/saas-ui/provider.tsx apps/web/src/index.css apps/web/package.json pnpm-lock.yaml && rtk git commit -m "feat: transplant saas ui starter theme"`

### Task 4: Transplant the exact application shell and neutral adapters

**Files:**

- Create: `apps/web/src/features/common/layouts/app-layout.tsx`
- Create: `apps/web/src/features/common/layouts/dashboard-layout.tsx`
- Create: `apps/web/src/features/common/layouts/fullscreen-layout.tsx`
- Create: `apps/web/src/features/common/components/app-sidebar.tsx`
- Create: `apps/web/src/features/common/components/user-menu.tsx`
- Create: `apps/web/src/features/common/components/workspaces-menu.tsx`
- Create: `apps/web/src/features/common/components/global-search-input.tsx`
- Create: `apps/web/src/features/common/components/sidebar-tags.tsx`
- Create: `apps/web/src/features/common/components/billing-status.tsx`
- Create: `apps/web/src/features/common/components/invite-people.tsx`
- Create: `apps/web/src/features/common/hooks/use-current-user.ts`
- Create: `apps/web/src/features/common/hooks/use-current-workspace.ts`
- Create: `apps/web/src/features/common/hooks/use-workspace-slug.ts`
- Create: `apps/web/src/features/common/hooks/use-workspaces.ts`
- Create: `apps/web/src/features/common/hooks/use-tags.ts`
- Create: `apps/web/src/features/common/util/get-base-url.ts`
- Create: `apps/web/src/features/golden/fixtures.ts`
- Create: `apps/web/src/features/golden/adapters.tsx`
- Create: `apps/web/src/features/common/shell.test.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

**Interfaces:**

- Consumes: the pinned starter common shell files, TanStack Router
  link/navigation APIs, WorkOS current user when available, and `goldenFixtures`
  in credential-free mode.
- Produces: `AppLayout`, `DashboardLayout`, `FullscreenLayout`, `AppSidebar`,
  `UserMenu`, `WorkspacesMenu`, `GlobalSearchInput`, and thin hooks with the
  starter-compatible return shapes.
- Produces: `goldenFixtures` as the single neutral
  user/workspace/contact/task/report/settings data authority used by both
  reference and generated modes.

- [ ] **Step 1: Write failing shell and adapter behavior tests**

```tsx
it("preserves upstream shell controls while adapters supply neutral data", async () => {
  render(
    <GoldenAdapterProvider>
      <AppLayout>
        <DashboardLayout>Body</DashboardLayout>
      </AppLayout>
    </GoldenAdapterProvider>,
  );
  expect(
    screen.getByRole("button", { name: /collapse sidebar/i }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: /workspace/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /user menu/i })).toBeVisible();
  expect(screen.getByRole("searchbox", { name: /search/i })).toBeVisible();
  expect(screen.getByText(goldenFixtures.currentWorkspace.name)).toBeVisible();
});
```

Add assertions for persisted collapse state, resize bounds, desktop flyout,
mobile backdrop, workspace switch, user menu action, `/` or the upstream
shortcut opening search, and route links retaining TanStack navigation.

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm --dir apps/web test -- src/features/common/shell.test.tsx`

Expected: FAIL because the transplanted shell and golden adapters do not exist.

- [ ] **Step 3: Transplant shell files and replace only external seams**

Retain the starter JSX and style props. Replace imports from
`@workspace/config`, Better Auth, tRPC, and starter database hooks with the thin
hooks listed above. The adapter provider exposes only:

```ts
export type GoldenFrontendAdapter = Readonly<{
  currentUser: UserFixture;
  currentWorkspace: WorkspaceFixture;
  workspaces: readonly WorkspaceFixture[];
  navigation: readonly NavigationFixture[];
  search(query: string): readonly SearchResultFixture[];
  navigate(to: string): void;
  signOut(): Promise<void>;
}>;
```

No adapter may return JSX, style props, Chakra recipes, Saas UI primitives, or
an alternate shell.

- [ ] **Step 4: Verify shell interactions and source fidelity**

Run:
`rtk pnpm --dir apps/web test -- src/features/common/shell.test.tsx && rtk pnpm --dir apps/web typecheck && rtk pnpm check:saas-ui-foundation`

Expected: PASS with all shell interaction assertions and no unrecorded manifest
drift.

- [ ] **Step 5: Commit**

Run:
`rtk git add apps/web/src/features/common apps/web/src/features/golden apps/web/src/routes/__root.tsx docs/template/saas-ui-upstream.json docs/template/saas-ui-acceptance.json && rtk git commit -m "feat: transplant saas ui application shell"`

### Task 5: Transplant the complete page archetypes and real state fixtures

**Files:**

- Create: every exact destination in **Appendix A: Starter Archetype Closure**
- Create: `apps/web/src/features/golden/dashboard-page.tsx`
- Create: `apps/web/src/features/golden/form-page.tsx`
- Create: `apps/web/src/features/golden/kanban-page.tsx`
- Create: `apps/web/src/features/golden/state-page.tsx`
- Create: `apps/web/src/features/golden/archetypes.test.tsx`
- Modify: `apps/web/src/features/golden/fixtures.ts`
- Modify: `apps/web/src/features/golden/adapters.tsx`

**Interfaces:**

- Consumes: pinned starter compositions, installed Pro blocks/primitives,
  `GoldenFrontendAdapter`, and `goldenFixtures`.
- Produces: complete routes/components for dashboard/report, DataGrid, filters,
  list/detail, split/inbox, aside detail, settings, form, onboarding, Kanban,
  auth, billing, search/command, and state demonstrations.
- Produces state contract:
  `"loading" | "empty" | "ready-read" | "ready-edit" | "mutation-success" | "mutation-failure" | "error" | "not-found" | "permission-denied"`.

- [ ] **Step 1: Write the failing archetype state tests**

```tsx
for (const state of [
  "loading",
  "empty",
  "ready-read",
  "ready-edit",
  "mutation-success",
  "mutation-failure",
  "error",
  "not-found",
  "permission-denied",
] as const) {
  it(`renders and operates the ${state} state`, async () => {
    render(
      <GoldenAdapterProvider initialState={state}>
        <GoldenStatePage state={state} />
      </GoldenAdapterProvider>,
    );
    expect(screen.getByTestId(`golden-state-${state}`)).toBeVisible();
  });
}
```

Add behavior assertions for DataGrid filtering, active-filter removal, sorting,
pagination and selection; list/board switching; list/detail and split
navigation; Kanban drag; settings tabs; form validation and submission
success/failure; dialog/drawer focus restoration; auth and billing presentation;
and search commands.

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm --dir apps/web test -- src/features/golden/archetypes.test.tsx`

Expected: FAIL because the starter archetypes and state pages are absent.

- [ ] **Step 3: Materialize the pinned compositions and adapt data calls**

Use the source manifest to copy these exact starter authorities:
`contacts/list/list-page.tsx`, `contacts/inbox/inbox-layout.tsx`,
`contacts/view/contact-page.tsx`, `reports/reports-page.tsx`,
`settings/common/settings-layout.tsx`,
`getting-started/getting-started-page.tsx`, `auth/*-page.tsx`,
`billing/components/pricing-table.tsx`, and every local file in their import
closure. Replace only Better Auth/tRPC/database/billing calls with
`GoldenFrontendAdapter` values and mutations.

For Kanban, retain the starter's contact board branch and installed upstream
board primitives. For the dashboard and form examples, select the nearest pinned
starter composition and installed Pro block; record their exact source IDs in
the acceptance map. Do not wrap primitives in local `Page`, `Card`, `DataGrid`,
`Dialog`, `Drawer`, or `EmptyState` substitutes.

- [ ] **Step 4: Pass focused rendering and interaction tests**

Run:
`rtk pnpm --dir apps/web test -- src/features/golden/archetypes.test.tsx && rtk pnpm --dir apps/web typecheck && rtk pnpm check:saas-ui-foundation`

Expected: PASS for every named state and interaction; the deviation checker
reports an empty ledger or only concrete compatibility entries.

- [ ] **Step 5: Commit**

Run:
`rtk git add apps/web/src/features/contacts apps/web/src/features/reports apps/web/src/features/settings apps/web/src/features/getting-started apps/web/src/features/auth apps/web/src/features/billing apps/web/src/features/search apps/web/src/features/workspaces apps/web/src/features/golden docs/template/saas-ui-upstream.json docs/template/saas-ui-acceptance.json docs/template/saas-ui-deviations.json && rtk git commit -m "feat: transplant saas ui page archetypes"`

### Task 6: Route the golden app through the upstream chassis and delete competing UI

**Files:**

- Create: `apps/web/src/routes/_workspace.tsx`
- Create: `apps/web/src/routes/_workspace.contacts.tsx`
- Create: `apps/web/src/routes/_workspace.contacts.$contactId.tsx`
- Create: `apps/web/src/routes/_workspace.inbox.tsx`
- Create: `apps/web/src/routes/_workspace.reports.tsx`
- Create: `apps/web/src/routes/_workspace.forms.tsx`
- Create: `apps/web/src/routes/_workspace.kanban.tsx`
- Create: `apps/web/src/routes/_workspace.states.tsx`
- Modify: `apps/web/src/routes/dashboard.tsx`
- Modify: `apps/web/src/routes/_workspace.settings.tsx`
- Modify: `apps/web/src/routes/_workspace.onboarding.tsx`
- Modify: `apps/web/src/routes/_workspace.billing.tsx`
- Modify: `apps/web/src/routeTree.gen.ts`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/platform-routes.test.ts`
- Modify: `apps/web/src/routes/_workspace.admin.tsx`, `_workspace.agents.tsx`,
  `_workspace.analytics.tsx`, `_workspace.api.tsx`, `_workspace.brain.tsx`,
  `_workspace.capabilities.tsx`, `_workspace.data-lifecycle.tsx`,
  `_workspace.data-map.tsx`, `_workspace.documents.tsx`,
  `_workspace.health.tsx`, `_workspace.integrations.tsx`,
  `_workspace.legal.tsx`, `_workspace.notifications.tsx`, `_workspace.runs.tsx`,
  `_workspace.sources.tsx`, and `_workspace.workflows.tsx`
- Modify: `apps/web/src/routes/__root.tsx`, `apps/web/src/router.tsx`,
  `apps/web/src/adapters/confect-state.ts`,
  `apps/web/src/navigation/route-ux-boundary.tsx`,
  `apps/web/src/features/setup/setup-surface.ts`,
  `apps/web/src/features/health/health-surface.tsx`,
  `apps/web/src/features/notifications/notification-center-surface.tsx`, and
  `apps/web/src/features/data-lifecycle/data-lifecycle-surface.tsx` to remove
  `@maestro-template/ui`
- Delete: `apps/web/src/saas-ui/business-shell.tsx`
- Delete: `apps/web/src/shell-style-contract.test.ts`
- Delete: `packages/ui/src/index.tsx`
- Delete: `packages/ui/src/primitives.tsx`
- Delete: `packages/ui/src/blocks/`
- Delete: `packages/ui/src/coediting/`
- Delete: `packages/ui/src/platform/`
- Delete: `packages/ui/src/settings/`
- Delete: `packages/ui/src/shell/`
- Delete: `packages/ui/src/visualize/`
- Delete: `packages/ui/package.json`
- Delete: `packages/ui/tsconfig.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify: `tooling/generators/src/blueprints/customer/index-route.tsx.txt`

**Interfaces:**

- Consumes: Task 4 shell and Task 5 archetypes.
- Produces: one TanStack route tree in which authenticated routes render through
  `AppLayout`/`DashboardLayout`; direct Saas UI imports replace surviving toast,
  focus, error, health, notification, and lifecycle helpers.
- Removes: `BusinessDashboardRoute`, `BusinessSectionRoute`,
  `BusinessSettingsRoute`, `BusinessDataLifecycleRoute`, `AppFrame`,
  `PageHeader`, `SurfaceCard`, and the `@maestro-template/ui` package authority.

- [ ] **Step 1: Rewrite route contract tests to fail on competing authority**

```ts
it("routes every authenticated page through the transplanted chassis", () => {
  expect(read("src/routes/_workspace.tsx")).toContain("<AppLayout");
  expect(read("src/routes/_workspace.tsx")).toContain("<DashboardLayout");
  expect(allApplicationSource()).not.toMatch(
    /business-shell|@maestro-template\/ui/,
  );
  expect(existsSync(resolve(root, "src/saas-ui/business-shell.tsx"))).toBe(
    false,
  );
});
```

Assert all acceptance-map routes exist and that no old generic UI export remains
discoverable.

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm --dir apps/web test -- src/platform-routes.test.ts`

Expected: FAIL because current routes still import `business-shell.tsx` and
`@maestro-template/ui`.

- [ ] **Step 3: Wire routes, replace narrow utilities, and delete the old
      shelf**

Use an authenticated parent route with this composition:

```tsx
function WorkspaceLayout() {
  return (
    <AppLayout>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </AppLayout>
  );
}
```

Point dashboard, contacts, inbox, reports, settings, form, onboarding, Kanban,
billing, and state routes directly at Task 5 pages. For preserved domain routes,
use an applicable transplanted settings/detail/list/state composition and keep
domain behavior in its existing adapter. Replace toast/focus/error imports with
direct official Saas UI or TanStack APIs, then delete the complete generic
`packages/ui` shelf and remove the workspace dependency.

- [ ] **Step 4: Regenerate and verify the single route/UI authority**

Run the existing Vite/TanStack build to regenerate `routeTree.gen.ts`, then run
its repository drift check:

`rtk pnpm --dir apps/web build && rtk pnpm check:route-tree`

Then run:
`rtk pnpm --dir apps/web test -- src/platform-routes.test.ts && rtk pnpm --dir apps/web typecheck && rtk rg 'business-shell|@maestro-template/ui|AppFrame|SurfaceCard' apps/web packages tooling/generators -g '!*.test.*'`

Expected: tests/typecheck/build PASS; `rtk rg` exits 1 with no production-source
matches.

- [ ] **Step 5: Commit**

Run:
`rtk git add -A apps/web packages/ui pnpm-workspace.yaml pnpm-lock.yaml tooling/generators/src/blueprints/customer/index-route.tsx.txt && rtk git commit -m "refactor: remove competing template ui authority"`

### Task 7: Enforce shell, primitive, and semantic-color boundaries

**Files:**

- Create: `tooling/eslint-plugin-template/rules/saas-ui-shell-authority.mjs`
- Create: `tooling/eslint-plugin-template/rules/prefer-saas-ui-primitives.mjs`
- Create: `tooling/eslint-plugin-template/rules/saas-ui-semantic-colors.mjs`
- Modify: `tooling/eslint-plugin-template/index.mjs`
- Modify: `tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs`
- Modify: `eslint.config.mjs`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `docs/template/coding-standards.md`
- Modify: `docs/template/enforced-engineering-rules.md`

**Interfaces:**

- Consumes: ESLint flat config, designated shell root
  `apps/web/src/features/common/`, installed registry paths, and semantic tokens
  from `apps/web/src/theme/`.
- Produces rules `template/saas-ui-shell-authority`,
  `template/prefer-saas-ui-primitives`, and `template/saas-ui-semantic-colors`,
  applied to `apps/**/src/**/*.{ts,tsx}`, `packages/**/src/**/*.{ts,tsx}`,
  `tooling/generators/**/*.{ts,tsx,txt}`, and generated fixture source.

- [ ] **Step 1: Add failing valid/invalid rule cases**

```js
ruleTester.run("saas-ui-shell-authority", shellRule, {
  valid: [
    {
      filename: "apps/web/src/features/common/app-sidebar.tsx",
      code: "import { Sidebar } from '@saas-ui/react'",
    },
  ],
  invalid: [
    {
      filename: "apps/web/src/features/orders/page.tsx",
      code: "import { Sidebar } from '@saas-ui/react'",
      errors: [{ messageId: "shellOnly" }],
    },
  ],
});
```

Add invalid cases for locally declared/imported substitutes named `Button`,
`Dialog`, `Table`, `DataGrid`, `Page`, `Sidebar`, `Drawer`, and `EmptyState`;
raw hex/rgb/hsl/oklch literals and palette slots such as `gray.600` in visible
application JSX. Add valid cases for upstream source destinations, semantic
roles, test fixtures, exported documents, manifests, and non-visible data
values.

- [ ] **Step 2: Confirm RED**

Run: `rtk pnpm --dir tooling/eslint-plugin-template test`

Expected: FAIL because the three rules are not registered.

- [ ] **Step 3: Implement the narrow AST checks and repository coverage**

Implement import/declaration/property-literal checks only; do not add aesthetic
scoring. Use exact forbidden names and source roots from this task, and report
stable message IDs `shellOnly`, `officialPrimitive`, and `semanticColor`.

Enable the rules for every scoped source glob and project the same ESLint config
through the current SaaS application blueprint. Exempt only the
manifest-authorized upstream destinations and explicit non-visual output files.

- [ ] **Step 4: Pass plugin, app lint, and projection checks**

Run:
`rtk pnpm --dir tooling/eslint-plugin-template test && rtk pnpm lint && rtk pnpm --dir tooling/generators test -- saasApplication.test.ts`

Expected: PASS; seeded invalid generated files fail with the matching rule IDs.

- [ ] **Step 5: Commit**

Run:
`rtk git add tooling/eslint-plugin-template eslint.config.mjs tooling/generators/src/blueprints/saasApplication.test.ts docs/template/coding-standards.md docs/template/enforced-engineering-rules.md && rtk git commit -m "feat: enforce saas ui frontend authority"`

### Task 8: Project the frontend as mandatory current-blueprint chassis

**Files:**

- Create: `tooling/generators/src/blueprints/saasFrontendFoundation.ts`
- Create: `tooling/generators/src/blueprints/saasFrontendFoundation.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationPatterns.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/alpha2SaasApplicationPlan.test.ts`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`

**Interfaces:**

- Consumes: Task 1 manifest, registry-installed closure, source files under
  `apps/web`, frontend tooling/docs, and existing `currentSource(path)`
  projection.
- Produces:
  `saasFrontendFoundationFiles(readSource: (path: string) => string): readonly GeneratedFile[]`
  and `saasFrontendFoundationPaths(): readonly string[]`, derived from the
  manifest plus registry installation receipt rather than a manually duplicated
  block list.
- Preserves: `records-example` and `workflow-automation` as the only optional
  application pattern groups; current/released blueprint behavior remains
  explicit.

- [ ] **Step 1: Write failing mandatory-projection tests**

```ts
it("projects the frontend foundation for every current pattern selection", () => {
  for (const patterns of [
    [],
    ["records-example"],
    ["workflow-automation"],
  ] as const) {
    const paths = buildSaasApplicationTargetPlan({
      name: "golden",
      patterns,
    }).entries.map(({ path }) => path);
    for (const required of saasFrontendFoundationPaths())
      expect(paths).toContain(required);
  }
});
```

Assert `components.json`, every registry-installed file, theme, shell,
archetypes, fixtures, lint config, provenance, acceptance, deviations, and
frontend docs reach a fresh target. Assert frontend is absent from pattern
choice metadata and historical alpha blueprint tests remain immutable.

- [ ] **Step 2: Confirm RED**

Run:
`rtk pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasApplication.test.ts && rtk pnpm --dir apps/cli test -- candidateComposition.test.ts createRootIntegration.test.ts`

Expected: FAIL because the current plan omits the frontend closure and still
projects the custom shell route.

- [ ] **Step 3: Add one manifest-derived projection closure**

```ts
export function saasFrontendFoundationFiles(
  readSource: (path: string) => string,
): readonly GeneratedFile[] {
  return saasFrontendFoundationPaths().map((path) => ({
    path,
    content: readSource(path),
  }));
}
```

Derive paths from `saas-ui-upstream.json`, `components.json` install output, and
an explicit short list of frontend config/docs files that are not upstream or
registry artifacts. Append `saasFrontendFoundationFiles(currentSource)`
unconditionally in `saasApplication`, independent of
`selectsSaasApplicationPattern`. Do not modify immutable release manifests or
`apps/cli/src/factory/createComposition.ts` public pins.

- [ ] **Step 4: Pass generator and create-root integration checks**

Run:
`rtk pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasApplication.test.ts alpha2SaasApplicationPlan.test.ts && rtk pnpm --dir apps/cli test -- candidateComposition.test.ts createRootIntegration.test.ts`

Expected: PASS; all current selections include the chassis, released alpha
fixtures remain unchanged, and generated hashes are deterministic.

- [ ] **Step 5: Commit**

Run:
`rtk git add tooling/generators/src/blueprints apps/cli/src/factory/candidateComposition.test.ts apps/cli/src/factory/createRootIntegration.test.ts && rtk git commit -m "feat: project mandatory saas ui chassis"`

### Task 9: Prove a clean generated target and paid-artifact boundary

**Files:**

- Create: `tooling/quality/saas-ui-artifact-safety.test.ts`
- Create: `tooling/quality/check-saas-ui-artifact-safety.mts`
- Create:
  `tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts`
- Modify: `tooling/quality/check-sbom-license.mts`
- Modify: `tooling/quality/check-generated-files.mts`
- Modify: `package.json`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `docs/template/saas-ui-acceptance.json`

**Interfaces:**

- Consumes: current-blueprint target plan, ownership inventory, package privacy
  flags, workspace/public artifact definitions, and source manifest licenses.
- Produces: `assertSaasUiArtifactSafety(root: string): readonly string[]` and a
  generated-target test fixture that materializes into a temporary directory.
- Produces checks that paid files are allowed only in the private factory and
  private generated customer target, never a publishable package or public
  artifact.

- [ ] **Step 1: Write failing generated-target and leakage tests**

```ts
it("builds the exact frontend from a fresh current target", async () => {
  const target = await createCurrentCustomerTarget();
  expect(readJson(join(target, "apps/web/components.json")).installed).toEqual(
    expectedRegistryRoots(),
  );
  expect(checkProjectedFrontend(target)).toEqual([]);
  await run("pnpm", ["install", "--frozen-lockfile"], target);
  await run("pnpm", ["--dir", "apps/web", "typecheck"], target);
  await run("pnpm", ["--dir", "apps/web", "build"], target);
});
```

Add a negative fixture that marks a package non-private or routes paid source
into a public artifact and expects `assertSaasUiArtifactSafety` to report the
exact offending destination.

- [ ] **Step 2: Confirm RED**

Run:
`rtk pnpm exec vitest run tooling/quality/saas-ui-artifact-safety.test.ts tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts`

Expected: FAIL because safety and generated-target checks do not exist.

- [ ] **Step 3: Implement safety and generated-target assertions**

Treat a path as paid when its manifest source is `starter` or `pro`, or it
appears in the registry materialization receipt. Reject it when the owning
package lacks `"private": true`, when an npm packlist includes it, or when a
public deployment/artifact allowlist includes it. Preserve upstream license
files under `docs/licenses/saas-ui/` in authorized private targets.

Add
`"check:saas-ui-artifact-safety": "tsx tooling/quality/check-saas-ui-artifact-safety.mts"`
and invoke it from `check:sbom-license` or the root verification sequence once,
not both.

- [ ] **Step 4: Pass the clean-target proof**

Run:
`rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/saas-ui-artifact-safety.test.ts tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts && rtk pnpm check:saas-ui-artifact-safety`

Expected: PASS; the temporary target completes frozen install, web typecheck,
and production build without source-only aliases or public leakage.

- [ ] **Step 5: Commit**

Run:
`rtk git add tooling/quality tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts apps/cli/src/factory/createRootIntegration.test.ts docs/template/saas-ui-acceptance.json package.json && rtk git commit -m "test: prove generated frontend artifact"`

### Task 10: Replace self-baselines with direct visual, interaction, and accessibility evidence

**Files:**

- Create: `tests/e2e/fixtures/saas-ui-golden.ts`
- Create: `tests/e2e/saas-ui-golden.spec.ts`
- Create: `tests/e2e/saas-ui-golden.accessibility.spec.ts`
- Create: `tests/e2e/saas-ui-golden.visual.spec.ts`
- Create: `tests/e2e/saas-ui-golden.manual.md`
- Create: `artifacts/saas-ui-golden/.gitkeep`
- Delete: `tests/e2e/hosted-reference-app.spec.ts`
- Delete: `tests/e2e/hosted-reference-app.accessibility.spec.ts`
- Delete: `tests/e2e/hosted-reference-app.visual.spec.ts`
- Delete: `tests/e2e/hosted-reference-app.visual.spec.ts-snapshots/`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Modify: `docs/template/saas-ui-acceptance.json`

**Interfaces:**

- Consumes: `UPSTREAM_REFERENCE_URL` and `GOLDEN_GENERATED_URL`, both
  credential-free/private loopback servers seeded from `goldenFixtures`; the
  reference URL is the factory checkout running its manifest-verified pinned
  starter transplant in `REFERENCE_SOURCE_MODE=1`, while the generated URL is a
  freshly materialized customer target; existing desktop and mobile Playwright
  projects.
- Produces: deterministic capture names
  `<composition>-<state>-<reference|generated>-<desktop|mobile>-<light|dark>.png`,
  JSON interaction/axe results, and a completed manual checklist.
- Produces scripts: `smoke:golden:browser`, `smoke:golden:a11y`, and
  `smoke:golden:visual`.

- [ ] **Step 1: Write failing direct-comparison and behavior specs**

```ts
for (const colorMode of ["light", "dark"] as const) {
  test(`dashboard ${colorMode} reference and generated`, async ({
    page,
  }, testInfo) => {
    await captureReferenceAndGenerated({
      page,
      testInfo,
      route: "/dashboard",
      fixture: "ready-read",
      colorMode,
    });
  });
}
```

Add specs for all acceptance-map routes and states. Add interaction tests for
sidebar resize/collapse/persistence/flyout/mobile backdrop, workspace/user
menus, search shortcut/commands, DataGrid filter/remove/sort/page/select, board
switch, split/detail navigation, Kanban drag, dialog/drawer trap and focus
restoration, settings/forms, and success/failure transitions.

Add axe scans and browser assertions for keyboard-only traversal, visible focus,
accessible names, reduced motion, 200% zoom, and 320 px reflow without
document-level horizontal overflow.

- [ ] **Step 2: Confirm RED**

Run:
`rtk pnpm exec playwright test tests/e2e/saas-ui-golden.spec.ts tests/e2e/saas-ui-golden.accessibility.spec.ts tests/e2e/saas-ui-golden.visual.spec.ts`

Expected: FAIL because the paired-server fixtures and evidence helpers do not
exist.

- [ ] **Step 3: Implement paired local-server fixtures and evidence output**

```ts
export async function captureReferenceAndGenerated(input: CaptureInput) {
  for (const [kind, baseURL] of [
    ["reference", process.env.UPSTREAM_REFERENCE_URL],
    ["generated", process.env.GOLDEN_GENERATED_URL],
  ] as const) {
    if (!baseURL) throw new Error(`${kind} URL is required`);
    await input.page.goto(new URL(input.route, baseURL).href);
    await seedGoldenFixture(input.page, input.fixture, input.colorMode);
    await input.page.screenshot({
      path: evidencePath(input, kind),
      fullPage: true,
      animations: "disabled",
    });
  }
}
```

The test must capture both authorities with the same fixture and viewport. It
may report pixel/image diffs using existing Playwright screenshot facilities,
but approval is based on side-by-side source comparison plus interactions, not a
newly generated self-baseline.

- [ ] **Step 4: Run focused browser evidence against both local servers**

Start the pinned reference and fresh generated app on separate loopback ports
using the existing Playwright `webServer` facility. Run:

`rtk pnpm smoke:golden:browser && rtk pnpm smoke:golden:a11y && rtk pnpm smoke:golden:visual`

Expected: PASS; four required shell captures and meaningful archetype state
captures exist under `artifacts/saas-ui-golden/`, with zero serious/critical axe
violations and every interaction assertion passing.

- [ ] **Step 5: Commit code and non-sensitive evidence metadata**

Do not commit paid-source render payloads that violate repository policy. Run:
`rtk git add tests/e2e playwright.config.ts package.json docs/template/saas-ui-acceptance.json artifacts/saas-ui-golden/.gitkeep && rtk git commit -m "test: compare generated app with saas ui source"`

### Task 11: Make the upstream path explicit in docs and review workflow

**Files:**

- Create: `docs/template/saas-ui-frontend-authority.md`
- Create: `docs/template/saas-ui-upstream-update.md`
- Create: `docs/template/saas-ui-golden-review.md`
- Create: `docs/licenses/saas-ui/starter-NOTICE.md`
- Create: `docs/licenses/saas-ui/pro-NOTICE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `.github/pull_request_template.md`
- Modify: `docs/template/repo-map.md`
- Modify: `docs/template/customer-target-contract.md`
- Modify: `docs/template/coding-standards.md`
- Modify: `docs/template/enforced-engineering-rules.md`
- Modify: `tooling/quality/check-docs-freshness.mts`
- Modify: `tooling/quality/saas-ui-foundation.test.ts`

**Interfaces:**

- Consumes: manifest, deviations, acceptance map, materializer command,
  generated-target proof, and artifact-safety rules.
- Produces: one frontend authority guide, one seven-step pinned upstream update
  workflow, one owner review runbook, license notices, and PR fields for exact
  upstream mapping, deviations, and rendered evidence.

- [ ] **Step 1: Add failing documentation contract assertions**

```ts
it("teaches one upstream-derived frontend path", () => {
  const agents = read("AGENTS.md");
  const pr = read(".github/pull_request_template.md");
  expect(agents).toContain("docs/template/saas-ui-frontend-authority.md");
  expect(pr).toContain("Upstream source file or Pro block");
  expect(pr).toContain("Deviation ledger entry");
  expect(pr).toContain("Desktop/mobile light/dark evidence");
  expect(allDocs()).not.toMatch(
    /continues to own its custom shell|port does not replace (?:the )?shell/i,
  );
});
```

- [ ] **Step 2: Confirm RED**

Run:
`rtk pnpm exec vitest run tooling/quality/saas-ui-foundation.test.ts && rtk pnpm check:docs-freshness`

Expected: FAIL because the authority/update/review documents and PR fields are
absent.

- [ ] **Step 3: Write exact operating guidance and remove the adapted shelf**

The authority guide states: choose the closest manifest composition or installed
Pro block; keep its JSX/styles/behavior; edit only adapters and product content;
add a concrete deviation entry for unavoidable compatibility changes; never
create a second generic wrapper.

The update guide encodes exactly: pin commits, regenerate catalog, reapply
adapter-only changes, review/remove deviations, generate a fresh target, repeat
behavior/accessibility/visual/build/Woodpecker checks, and update pins only
after evidence passes.

The golden review guide names the two local URLs, evidence directory,
keyboard/zoom/reflow walkthrough, and explicit approval phrase. The PR template
requires exact source/block mapping, deviation entry or `None`, authenticated
desktop/mobile light/dark evidence, interaction results, and accessibility
results.

- [ ] **Step 4: Pass docs, provenance, and licensing checks**

Run:
`rtk pnpm exec vitest run tooling/quality/saas-ui-foundation.test.ts && rtk pnpm check:docs-freshness && rtk pnpm check:sbom-license && rtk pnpm check:saas-ui-foundation`

Expected: PASS; no documentation recommends custom composition and license
destinations match the manifest.

- [ ] **Step 5: Commit**

Run:
`rtk git add AGENTS.md README.md .github/pull_request_template.md docs/template docs/licenses/saas-ui tooling/quality/check-docs-freshness.mts tooling/quality/saas-ui-foundation.test.ts && rtk git commit -m "docs: require upstream-derived saas ui"`

### Task 12: Freeze, review, verify, and present the golden candidate

**Files:**

- Create: `artifacts/saas-ui-golden/acceptance-summary.json`
- Create: `artifacts/saas-ui-golden/deviation-summary.json`
- Create: `artifacts/saas-ui-golden/interaction-summary.json`
- Create: `artifacts/saas-ui-golden/accessibility-summary.json`
- Modify: `docs/template/saas-ui-acceptance.json`
- No changes: `apps/cli/src/factory/createComposition.ts`
- No changes: `releases/v0.2.0-alpha.3/`
- No changes: Maestro Brain repository
- No changes: B2B Creator OS repository

**Interfaces:**

- Consumes: the exact committed implementation head, all Task 1-11 checks,
  generated local target, paired local servers, and evidence output.
- Produces: frozen head SHA, golden local/private URL, reference URL, evidence
  summaries, complete acceptance-map status, Woodpecker result, and an explicit
  owner approval request.

- [ ] **Step 1: Run focused acceptance once more before freezing**

Run:
`rtk pnpm check:saas-ui-foundation && rtk pnpm check:saas-ui-artifact-safety && rtk pnpm --dir tooling/generators test -- saasFrontendFoundation.test.ts saasFrontendGeneratedTarget.test.ts && rtk pnpm smoke:golden:browser && rtk pnpm smoke:golden:a11y && rtk pnpm smoke:golden:visual`

Expected: PASS; write machine-readable summaries containing command, exit
status, timestamp, source pins, generated target digest, and evidence paths.
`deviation-summary.json` must report zero entries or enumerate every approved
compatibility deviation.

- [ ] **Step 2: Review the whole diff and prohibited repositories**

Run:
`rtk git diff --check origin/main...HEAD && rtk git diff --stat origin/main...HEAD && rtk git status --short`

Expected: no whitespace errors; only intended template files are changed; no
Maestro Brain or B2B Creator OS path appears.

Use the requesting-code-review workflow to verify spec coverage, upstream
fidelity, deletion of competing authority, projection completeness, licensing,
and test quality. Resolve findings with focused checks before proceeding.

- [ ] **Step 3: Commit evidence metadata and freeze the head**

Run:
`rtk git add artifacts/saas-ui-golden docs/template/saas-ui-acceptance.json && rtk git commit -m "chore: record saas ui golden acceptance" && rtk git rev-parse HEAD`

Expected: a final SHA; record it in the PR and do not edit the branch afterward
without invalidating all full-verification evidence.

- [ ] **Step 4: Run the one full required verification on the frozen head**

Preferred: `rtk maestro-remote-test -- pnpm verify`

Fallback only when `maestro-worker` is unavailable:
`rtk host-test-slot --class full pnpm verify`

Expected: PASS on the exact SHA from Step 3. Do not run `pnpm verify` again
unless the head changes.

- [ ] **Step 5: Open the draft PR and wait for Woodpecker**

Open a draft PR to `main` from the frozen branch. Require
`ci/woodpecker/pr/verify` to pass on the exact SHA. Record Qlty findings or
provider failures as advisory and do not invoke Buildkite or Fabro.

- [ ] **Step 6: Present the running golden app for owner approval and stop**

Provide the owner with the private/local generated URL, pinned reference URL,
four required shell comparisons, archetype/state evidence index, interaction
summary, accessibility summary, deviation summary, frozen SHA, and Woodpecker
link/status.

Request explicit approval of both appearance and interactions. Do not
seal/publish a release, switch `CURRENT_PUBLIC_SOURCE`, deploy paid source
publicly, merge, or begin Maestro Brain/B2B Creator OS work in this task.

## Plan Self-Review Record

- Spec coverage: Tasks 1-2 cover pins, registry completeness, provenance,
  inventory, and deviations; Tasks 3-6 cover exact theme, shell, adapters,
  archetypes, states, routes, and deletion; Tasks 7-9 cover lint, mandatory
  projection, clean generation, licenses, and artifact safety; Tasks 10-12 cover
  behavior, accessibility, direct visual comparison, docs, immutable-head
  verification, Woodpecker, and the owner gate. No approved requirement lacks an
  implementation task.
- Placeholder scan: the plan contains no deferred implementation markers, vague
  test instructions, or cross-task shorthand. Every task names its failing
  check, expected RED, minimum implementation, GREEN command, and commit.
- Type/interface consistency: `SaasUiManifest`, `SaasUiDeviation`,
  `SaasUiAcceptanceMap`, `GoldenFrontendAdapter`, `materializeProRegistry`,
  `saasFrontendFoundationFiles`, `saasFrontendFoundationPaths`, and
  artifact/evidence inputs keep the same names and roles at every consumer.
- Delivery review: all tasks belong to one moving feature branch and one
  mergeable private-template outcome. Immutable release
  sealing/publication/default switching remains a separately authorized later
  batch.

## Appendix A: Starter Archetype Closure

Task 5 creates these exact destinations from the same relative paths at pinned
starter commit `b76cb4514b9ab47f7db87901cb9b593b4adc3129`:

- `apps/web/src/features/contacts/common/contact-avatar.tsx`,
  `contact-status.tsx`, `contact-tag.tsx`, and `contact-type.tsx`.
- `apps/web/src/features/contacts/inbox/inbox-layout.tsx`, `inbox-list.tsx`,
  `inbox-view-page.tsx`, and `inbox.not-found.tsx`.
- `apps/web/src/features/contacts/list/add-person-dialog.tsx`,
  `contact-board-header.tsx`, `contact-bulk-actions.tsx`, `contact-card.tsx`,
  `contact-filters.tsx`, `contact-types.tsx`, `get-contact-type.ts`, and
  `list-page.tsx`.
- `apps/web/src/features/contacts/view/activities-panel.tsx`,
  `activity-timeline.tsx`, `contact-page.tsx`, `contact-sidebar.tsx`,
  `contact-tags.tsx`, `contact.error.tsx`, and `contact.not-found.tsx`.
- `apps/web/src/features/reports/reports-page.tsx`, `metrics/activity.tsx`,
  `metrics/metric.tsx`, `metrics/metrics-card.tsx`, `metrics/revenue-chart.tsx`,
  and `metrics/sales-by-country.tsx`.
- `apps/web/src/features/settings/account/account-api-page.tsx`,
  `account-notifications-page.tsx`, `account-profile-page.tsx`,
  `account-security-page.tsx`, `index.ts`, `update-password-dialog.tsx`,
  `schema/profile.schema.ts`, and `schema/update-password.schema.ts`.
- `apps/web/src/features/settings/billing/billing-page.tsx`,
  `billing-status.tsx`, `manage-billing-button.tsx`, and `plans-page.tsx`.
- `apps/web/src/features/settings/common/settings-card.tsx`,
  `settings-layout.tsx`, `settings-sidebar.tsx`, and `support-card.tsx`.
- `apps/web/src/features/settings/members/members-list.tsx` and
  `members-page.tsx`.
- `apps/web/src/features/settings/tags/color-control.tsx`, `manage-tags.tsx`,
  and `tags-settings-page.tsx`.
- `apps/web/src/features/settings/workspace/workspace-settings-page.tsx`.
- `apps/web/src/features/getting-started/appearance.tsx`,
  `create-workspace.tsx`, `getting-started-page.tsx`, `index.ts`,
  `invite-team-members.tsx`, `onboarding-layout.tsx`, `onboarding-step.tsx`,
  `subscribe.tsx`, `schema/appearance.schema.ts`,
  `schema/invite-team.schema.ts`, `schema/subscribe.schema.ts`, and
  `schema/workspace.schema.ts`.
- `apps/web/src/features/auth/auth-layout.tsx`, `auth-provider.tsx`,
  `forgot-password-page.tsx`, `login-page.tsx`, `reset-password-page.tsx`,
  `signup-page.tsx`, `components/auth-card.tsx`, `components/last-used.tsx`,
  `components/providers.tsx`, `components/testimonial.tsx`,
  `schema/forgot-password.schema.ts`, `schema/login.schema.ts`,
  `schema/password.schema.ts`, `schema/reset-password.schema.ts`, and
  `schema/signup.schema.ts`.
- `apps/web/src/features/billing/components/payment-overdue-banner.tsx`,
  `components/pricing-table.tsx`, `hooks/use-plans.ts`, and
  `providers/billing-provider.tsx`.
- `apps/web/src/features/search/search-page.tsx`.
- `apps/web/src/features/workspaces/workspace.loading.tsx`,
  `workspace.not-found.tsx`, and `invite/accept-invite-page.tsx`.
