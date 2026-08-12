import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GeneratedFile } from "../index";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
type FrontendManifest = Readonly<{
  registry: Readonly<{
    catalog: string;
    config: string;
  }>;
  compositions: readonly Readonly<{
    files: readonly Readonly<{ source: string; destination: string }>[];
  }>[];
  licenses: readonly Readonly<{ destination: string }>[];
}>;
type RegistryReceipt = Readonly<{
  files: readonly Readonly<{ destination: string }>[];
}>;

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8")) as T;
const manifest = readJson<FrontendManifest>(
  "docs/template/saas-ui-upstream.json",
);
const registryReceipt = readJson<RegistryReceipt>(
  "docs/template/saas-ui-registry-files.json",
);

// These are the frontend's non-upstream control-plane files. The source
// compositions and registry receipt remain the authorities for application
// source; this list only covers the files that make that source installable,
// lintable, private, and reviewable in a generated target.
const FRONTEND_SUPPORT_PATHS = [
  "tsconfig.base.json",
  "apps/web/src/vite-env.d.ts",
  "apps/web/src/router.tsx",
  "apps/web/src/react-global.ts",
  "apps/web/src/index.css",
  "apps/web/src/env.ts",
  "apps/web/src/routes/__root.tsx",
  "apps/web/src/routes/_auth.tsx",
  "apps/web/src/routes/_auth.forgot-password.tsx",
  "apps/web/src/routes/_auth.login.tsx",
  "apps/web/src/routes/_auth.reset-password.tsx",
  "apps/web/src/routes/_auth.signup.tsx",
  "apps/web/src/routes/_workspace.tsx",
  "apps/web/src/routes/_workspace._dashboard.tsx",
  "apps/web/src/routes/_workspace._dashboard.billing.tsx",
  "apps/web/src/routes/_workspace._dashboard.forms.tsx",
  "apps/web/src/routes/_workspace._dashboard.kanban.tsx",
  "apps/web/src/routes/_workspace.onboarding.tsx",
  "apps/web/src/routes/_workspace._dashboard.reports.tsx",
  "apps/web/src/routes/_workspace.settings.tsx",
  "apps/web/src/routes/_workspace.settings.index.tsx",
  "apps/web/src/routes/_workspace.settings.account.tsx",
  "apps/web/src/routes/_workspace.settings.account.index.tsx",
  "apps/web/src/routes/_workspace.settings.account.profile.tsx",
  "apps/web/src/routes/_workspace.settings.account.security.tsx",
  "apps/web/src/routes/_workspace.settings.billing.tsx",
  "apps/web/src/routes/_workspace.settings.members.tsx",
  "apps/web/src/routes/_workspace.settings.plans.tsx",
  "apps/web/src/routes/_workspace.settings.tags.tsx",
  "apps/web/src/routes/_workspace.settings.workspace.tsx",
  "apps/web/src/routes/_workspace._dashboard.contacts.tsx",
  "apps/web/src/routes/_workspace._dashboard.contacts.index.tsx",
  "apps/web/src/routes/_workspace._dashboard.contacts.$contactId.tsx",
  "apps/web/src/routes/_workspace._dashboard.contacts.$type.tsx",
  "apps/web/src/routes/_workspace._dashboard.contacts.view.$id.tsx",
  "apps/web/src/routes/_workspace.getting-started.tsx",
  "apps/web/src/routes/_workspace._dashboard.inbox.tsx",
  "apps/web/src/routes/_workspace._dashboard.inbox.$id.tsx",
  "apps/web/src/routes/_workspace._dashboard.search.tsx",
  "apps/web/src/routes/_workspace._dashboard.tag.$tag.tsx",
  "apps/web/src/routes/_workspace._dashboard.states.tsx",
  "apps/web/src/routes/dashboard.tsx",
  "apps/web/src/routes/privacy.tsx",
  "apps/web/src/routes/terms.tsx",
  "apps/web/src/navigation/route-ux-boundary.tsx",
  "apps/web/src/navigation/route-announcements.ts",
  "apps/web/src/navigation/network-state.ts",
  "apps/web/src/navigation/reference-app-routes.ts",
  "apps/web/src/navigation/workspace.ts",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/vite.config.ts",
  "apps/web/src/bundle-policy.ts",
  "apps/web/src/bundle-policy.test.ts",
  "apps/web/src/features/golden/adapters.tsx",
  "apps/web/src/features/golden/archetypes.test.tsx",
  "apps/web/src/features/golden/dashboard-page.tsx",
  "apps/web/src/features/golden/fixtures.ts",
  "apps/web/src/features/golden/form-page.tsx",
  "apps/web/src/features/golden/kanban-page.tsx",
  "apps/web/src/features/golden/state-page.tsx",
  "apps/web/src/features/common/layouts/app-layout.tsx",
  "apps/web/src/features/common/layouts/dashboard-layout.tsx",
  "apps/web/src/features/common/layouts/fullscreen-layout.tsx",
  "apps/web/src/features/common/components/app-sidebar.tsx",
  "apps/web/src/features/common/components/client-resizer.tsx",
  "apps/web/src/features/common/components/global-search-input.tsx",
  "apps/web/src/features/common/components/hotkeys.tsx",
  "apps/web/src/features/common/components/user-menu.tsx",
  "apps/web/src/features/common/components/workspaces-menu.tsx",
  "apps/web/src/features/common/components/sidebar-tags.tsx",
  "apps/web/src/features/common/hooks/use-current-user.ts",
  "apps/web/src/features/common/hooks/use-current-workspace.ts",
  "apps/web/src/features/common/hooks/use-workspace-slug.ts",
  "apps/web/src/features/common/hooks/use-workspaces.ts",
  "apps/web/src/features/common/hooks/use-tags.ts",
  "apps/web/src/features/common/util/get-base-url.ts",
  "apps/web/src/features/public-funnel/legal-page.tsx",
  "apps/web/src/features/public-funnel/public-shell.tsx",
  "apps/web/public/img/onboarding/light.svg",
  "apps/web/public/img/onboarding/dark.svg",
  "apps/web/scripts/check-client-bundle-budget.mjs",
  "apps/web/scripts/check-client-bundle-budget.test.mjs",
  "eslint.config.mjs",
  "tooling/eslint-plugin-template/index.mjs",
  "tooling/eslint-plugin-template/saas-ui-registry-receipt.mjs",
  "tooling/quality/saas-ui-foundation.ts",
  "tooling/quality/saas-ui-foundation.test.ts",
  "tooling/quality/check-saas-ui-foundation.mts",
  "docs/template/saas-ui-frontend-authority.md",
  "docs/template/saas-ui-upstream-update.md",
  "docs/template/saas-ui-golden-review.md",
  "docs/template/saas-ui-upstream.json",
  "docs/template/saas-ui-registry-files.json",
  "docs/template/saas-ui-acceptance.json",
  "docs/template/saas-ui-deviations.json",
] as const;

const currentWebSourcePaths = (directory: string): readonly string[] =>
  readdirSync(resolve(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return currentWebSourcePaths(path);
    return /\.(?:ts|tsx|mts|mjs)$/.test(entry.name) &&
      !/(?:\/sample\/|\/settings-surface\.|\/setup-surface\.|\/posthog\.test\.|\/confect-generated-refs\.test\.|\/generated\/confectManifest\.ts$)/.test(
        path,
      )
      ? [path]
      : [];
  });

const STARTER_SOURCE_ROOTS = [
  "apps/web/src/components",
  "apps/web/src/adapters",
  "apps/web/src/lib",
  "apps/web/src/providers",
  "apps/web/src/saas-ui",
  "apps/web/src/workspace",
  "apps/web/src/features/auth",
  "apps/web/src/features/billing",
  "apps/web/src/features/common",
  "apps/web/src/features/contacts",
  "apps/web/src/features/getting-started",
  "apps/web/src/features/reports",
  "apps/web/src/features/search",
  "apps/web/src/features/settings",
  "apps/web/src/features/workspaces",
] as const;

const manifestCompositionPaths = (): readonly string[] =>
  manifest.compositions.flatMap((composition) =>
    composition.files.map(({ destination }) => destination),
  );
const manifestSourceByDestination = new Map(
  manifest.compositions.flatMap((composition) =>
    composition.files.map(({ source, destination }) => [destination, source]),
  ),
);

const foundationPaths = [
  ...manifestCompositionPaths(),
  manifest.registry.catalog,
  manifest.registry.config,
  ...registryReceipt.files.map(({ destination }) => destination),
  ...manifest.licenses.map(({ destination }) => destination),
  ...FRONTEND_SUPPORT_PATHS,
  ...STARTER_SOURCE_ROOTS.flatMap(currentWebSourcePaths),
];

const UNIQUE_FOUNDATION_PATHS = Object.freeze(
  [...new Set(foundationPaths)].sort((left, right) =>
    left.localeCompare(right),
  ),
);

export function saasFrontendFoundationPaths(): readonly string[] {
  return UNIQUE_FOUNDATION_PATHS;
}

export function saasFrontendFoundationFiles(
  readSource: (path: string) => string,
): readonly GeneratedFile[] {
  return saasFrontendFoundationPaths().map((path) => {
    const source = manifestSourceByDestination.get(path);
    const sourcePath =
      source !== undefined && existsSync(resolve(repositoryRoot, source))
        ? source
        : path;
    return { path, content: readSource(sourcePath) };
  });
}
