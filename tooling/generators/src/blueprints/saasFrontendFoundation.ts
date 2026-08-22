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

// The literal starter tree is the frontend authority. Keep this list to files
// outside that tree which make it installable, private, and enforceable.
const FRONTEND_SUPPORT_PATHS = [
  "tsconfig.base.json",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/vite.config.ts",
  "apps/web/components.json",
  "apps/web/public/img/logo-icon.svg",
  "apps/web/public/img/onboarding/light.svg",
  "apps/web/public/img/onboarding/dark.svg",
  "packages/i18n/lang/.empty",
  "packages/ui/.storybook/preview-head.html",
  "packages/ui/.storybook/static/.empty",
  "packages/ui/.storybook/storybook-logo.svg",
  "eslint.config.mjs",
  "tooling/eslint-plugin-template/index.mjs",
  "tooling/eslint-plugin-template/saas-ui-registry-receipt.mjs",
  "tooling/quality/check-saas-ui-artifact-safety.mts",
  "tooling/quality/check-saas-ui-typecheck.mts",
  "tooling/quality/generate-saas-ui-typecheck-baseline.mts",
  "tooling/quality/check-saas-ui-foundation.mts",
  "tooling/saas-ui/screen-catalog.mts",
  "tooling/quality/src/direct-run.mts",
  "tooling/quality/saas-ui-foundation.ts",
  "tooling/quality/saas-ui-foundation.test.ts",
  "docs/template/saas-ui-frontend-authority.md",
  "docs/template/saas-ui-upstream-update.md",
  "docs/template/saas-ui-golden-review.md",
  "docs/template/saas-ui-upstream.json",
  "docs/template/saas-ui-screen-catalog.json",
  "docs/template/saas-ui-registry-files.json",
  "docs/template/saas-ui-starter-files.json",
  "docs/template/saas-ui-acceptance.json",
  "docs/template/saas-ui-deviations.json",
  "tooling/quality/fixtures/saas-ui-typecheck-baseline.json",
] as const;

export const isObsoleteFrontendAuthority = (path: string): boolean =>
  path.startsWith("apps/web/src/routes/_workspace") ||
  path === "apps/web/src/routes/index.tsx" ||
  path === "apps/web/src/routes/dashboard.tsx" ||
  path.includes("/features/golden/") ||
  path.includes("/features/public-funnel/") ||
  path.includes("business-shell") ||
  path.startsWith("apps/web/src/navigation/") ||
  path.startsWith("apps/web/src/providers/") ||
  path.startsWith("apps/web/src/workspace/") ||
  path.startsWith("apps/web/src/saas-ui/");

const currentSourcePaths = (directory: string): readonly string[] =>
  readdirSync(resolve(repositoryRoot, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory())
      return /(?:node_modules|dist|\.output|__tests__)$/.test(path)
        ? []
        : currentSourcePaths(path);
    return !isObsoleteFrontendAuthority(path) &&
      /\.(?:ts|tsx|mts|mjs|json)$/.test(entry.name)
      ? [path]
      : [];
  });

const STARTER_SOURCE_ROOTS = [
  "apps/web/src",
  "packages/ui",
  "packages/config",
  "packages/i18n",
  "packages/saas-api",
  "tooling/eslint-plugin-template/rules",
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
  ...STARTER_SOURCE_ROOTS.flatMap(currentSourcePaths),
].filter((path) => !isObsoleteFrontendAuthority(path));

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
