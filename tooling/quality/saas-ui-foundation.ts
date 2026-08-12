import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const MANIFEST_PATH = "docs/template/saas-ui-upstream.json";
const DEVIATIONS_PATH = "docs/template/saas-ui-deviations.json";
const ACCEPTANCE_PATH = "docs/template/saas-ui-acceptance.json";
const REGISTRY_FILES_PATH = "docs/template/saas-ui-registry-files.json";
const PINS = {
  template: "acf0bc4be38dea842f321831387fc77cf7242439",
  starter: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
  pro: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
} as const;
export const SAAS_UI_DEVIATIONS_DIGEST =
  "fbb326a6be7b49a26cac3f8f1a3f21c5c51938372374a00d7fd66d7e29cdf519";

export function hasExecutableEvidenceDeclaration(
  source: string,
  declaration: string,
): boolean {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const expectedArg = declaration.startsWith("test(")
    ? declaration.slice(5, declaration.indexOf(", async"))
    : JSON.stringify(declaration);
  let found = false;
  // eslint-disable-next-line complexity -- validates bounded executable test context.
  const allowedContext = (node: ts.Node): boolean => {
    for (
      let current: ts.Node | undefined = node.parent;
      current;
      current = current.parent
    ) {
      if (
        ts.isIfStatement(current) ||
        ts.isConditionalExpression(current) ||
        (ts.isBinaryExpression(current) &&
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(current.operatorToken.kind)) ||
        ts.isSwitchStatement(current) ||
        (ts.isIterationStatement(current, true) &&
          !(
            ts.isForOfStatement(current) &&
            /(authorities|acceptanceEntries)/u.test(
              current.expression.getText(sourceFile),
            )
          )) ||
        ts.isTryStatement(current) ||
        ts.isCatchClause(current)
      )
        return false;
      if (ts.isFunctionLike(current)) {
        const parent = current.parent;
        if (!(
          ts.isCallExpression(parent) &&
          ((ts.isIdentifier(parent.expression) &&
            parent.expression.text === "describe") ||
            (ts.isPropertyAccessExpression(parent.expression) &&
              parent.expression.name.text === "describe")) &&
          parent.arguments[1] === current
        ))
          return false;
      }
    }
    return true;
  };
  // eslint-disable-next-line complexity -- walks a fixed AST call-shape authority.
  const visit = (node: ts.Node) => {
    if (found || !ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    const callee = node.expression;
    const eachBase = ts.isCallExpression(callee)
      ? callee.expression
      : undefined;
    const validCallee =
      (ts.isIdentifier(callee) &&
        (callee.text === "it" || callee.text === "test")) ||
      (eachBase !== undefined &&
        ts.isPropertyAccessExpression(eachBase) &&
        eachBase.name.text === "each" &&
        ts.isIdentifier(eachBase.expression) &&
        (eachBase.expression.text === "it" ||
          eachBase.expression.text === "test"));
    const callback = node.arguments[1];
    const callable =
      callback !== undefined &&
      (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback));
    if (
      validCallee &&
      callable &&
      allowedContext(node) &&
      node.arguments[0]?.getText(sourceFile) === expectedArg
    )
      found = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
const COMPOSITION_IDS = [
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
] as const;

type ReadonlyRecord = Readonly<Record<string, unknown>>;

export type SaasUiManifest = Readonly<{
  schemaVersion: 1;
  pins: Readonly<Record<keyof typeof PINS, string>>;
  registry: Readonly<{
    catalog: string;
    config: string;
    installRoot: string;
    sourceRoot?: string;
    sourceCommit?: string;
    installed?: readonly string[];
  }>;
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
  evidencePaths: readonly string[];
  evidenceChecks: readonly string[];
  sourceAuthority: "starter-receipt" | "factory-support";
}>;

export type SaasUiAcceptanceMap = Readonly<{
  schemaVersion: 1;
  entries: readonly Readonly<{
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
  }>[];
}>;

export type SaasUiRegistryFiles = Readonly<{
  schemaVersion: 1;
  sourceCommit: string;
  files: readonly Readonly<{
    destination: string;
    sha256: string;
  }>[];
}>;

function readJson(root: string, relativePath: string): unknown {
  return JSON.parse(
    readFileSync(resolve(root, relativePath), "utf8"),
  ) as unknown;
}

function record(value: unknown, label: string): ReadonlyRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as ReadonlyRecord;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function readManifestValue(value: unknown): SaasUiManifest {
  const root = record(value, MANIFEST_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("manifest schemaVersion must be 1");
  const pins = record(root.pins, "manifest.pins");
  for (const key of Object.keys(PINS) as (keyof typeof PINS)[]) {
    if (pins[key] !== PINS[key])
      throw new Error(`manifest pin ${key} is not approved`);
  }
  const registry = record(root.registry, "manifest.registry");
  const compositionsValue = root.compositions;
  if (!Array.isArray(compositionsValue))
    throw new Error("manifest.compositions must be an array");
  const compositions = compositionsValue.map((value, index) => {
    const item = record(value, `manifest.compositions[${index}]`);
    const filesValue = item.files;
    if (!Array.isArray(filesValue))
      throw new Error(`manifest composition ${index} files must be an array`);
    const files = filesValue.map((fileValue, fileIndex) => {
      const file = record(
        fileValue,
        `manifest.compositions[${index}].files[${fileIndex}]`,
      );
      return {
        source: string(file.source, "file.source"),
        destination: string(file.destination, "file.destination"),
      };
    });
    return {
      id: string(item.id, "composition.id"),
      source: string(item.source, "composition.source"),
      factoryDestination: string(
        item.factoryDestination,
        "composition.factoryDestination",
      ),
      generatedDestination: string(
        item.generatedDestination,
        "composition.generatedDestination",
      ),
      files,
    };
  });
  const licensesValue = root.licenses;
  if (!Array.isArray(licensesValue))
    throw new Error("manifest.licenses must be an array");
  const licenses = licensesValue.map((value, index) => {
    const item = record(value, `manifest.licenses[${index}]`);
    const source = string(item.source, "license.source");
    if (source !== "starter" && source !== "pro")
      throw new Error(`license ${index} source must be starter or pro`);
    return {
      source,
      path: string(item.path, "license.path"),
      destination: string(item.destination, "license.destination"),
    } as const;
  });
  return {
    schemaVersion: 1,
    pins: {
      template: pins.template as string,
      starter: pins.starter as string,
      pro: pins.pro as string,
    },
    registry: {
      catalog: string(registry.catalog, "registry.catalog"),
      config: string(registry.config, "registry.config"),
      installRoot: string(registry.installRoot, "registry.installRoot"),
      ...(typeof registry.sourceRoot === "string"
        ? { sourceRoot: registry.sourceRoot }
        : {}),
      ...(typeof registry.sourceCommit === "string"
        ? { sourceCommit: registry.sourceCommit }
        : {}),
      ...(Array.isArray(registry.installed)
        ? { installed: stringArray(registry.installed, "registry.installed") }
        : {}),
    },
    compositions,
    licenses,
  };
}

export function readSaasUiManifest(root: string): SaasUiManifest {
  return readManifestValue(readJson(root, MANIFEST_PATH));
}

// eslint-disable-next-line complexity -- validates the fixed deviation authority schema.
export function readSaasUiDeviations(root: string): readonly SaasUiDeviation[] {
  const value = readJson(root, DEVIATIONS_PATH);
  const authority = record(value, DEVIATIONS_PATH);
  if (authority.schemaVersion !== 1)
    throw new Error("deviations schemaVersion must be 1");
  if (typeof authority.authorityDigest !== "string")
    throw new Error("deviations authorityDigest must be a string");
  if (!Array.isArray(authority.deviations))
    throw new Error("deviations.deviations must be an array");
  const deviations = authority.deviations.map((itemValue, index) => {
    const item = record(itemValue, `deviation[${index}]`);
    return {
      source: string(item.source, "deviation.source"),
      destination: string(item.destination, "deviation.destination"),
      change: string(item.change, "deviation.change"),
      reason: string(item.reason, "deviation.reason"),
      evidence: string(item.evidence, "deviation.evidence"),
      evidencePaths: stringArray(item.evidencePaths, "deviation.evidencePaths"),
      evidenceChecks: stringArray(
        item.evidenceChecks,
        "deviation.evidenceChecks",
      ),
      sourceAuthority: (() => {
        const value = string(item.sourceAuthority, "deviation.sourceAuthority");
        if (value !== "starter-receipt" && value !== "factory-support")
          throw new Error(`unsupported deviation source authority: ${value}`);
        return value;
      })(),
    };
  });
  const digest = createHash("sha256")
    .update(JSON.stringify(deviations))
    .digest("hex");
  if (
    digest !== SAAS_UI_DEVIATIONS_DIGEST ||
    authority.authorityDigest !== SAAS_UI_DEVIATIONS_DIGEST
  )
    throw new Error("deviations authority digest mismatch");
  for (const deviation of deviations) {
    for (const path of deviation.evidencePaths) {
      if (
        path.includes("..") ||
        path.startsWith("/") ||
        !existsSync(resolve(root, path))
      )
        throw new Error(`deviation evidence path is missing: ${path}`);
    }
    for (const check of deviation.evidenceChecks) {
      const [path, ...name] = check.split("#");
      if (!existsSync(resolve(root, path)))
        throw new Error(`deviation evidence check file is missing: ${path}`);
      if (
        name.length > 0 &&
        !readFileSync(resolve(root, path), "utf8").includes(name.join("#"))
      )
        throw new Error(`deviation evidence check is not present: ${check}`);
    }
  }
  return deviations;
}

function readAcceptanceValue(value: unknown): SaasUiAcceptanceMap {
  const root = record(value, ACCEPTANCE_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("acceptance schemaVersion must be 1");
  if (!Array.isArray(root.entries))
    throw new Error("acceptance.entries must be an array");
  return {
    schemaVersion: 1,
    entries: root.entries.map((entryValue, index) => {
      const entry = record(entryValue, `acceptance.entries[${index}]`);
      const upstream = record(entry.upstream, "acceptance.upstream");
      const repository = string(
        upstream.repository,
        "acceptance.upstream.repository",
      );
      if (repository !== "starter" && repository !== "pro")
        throw new Error(
          `acceptance entry ${index} repository must be starter or pro`,
        );
      return {
        id: string(entry.id, "acceptance.id"),
        upstream: {
          repository,
          commit: string(upstream.commit, "acceptance.upstream.commit"),
          path: string(upstream.path, "acceptance.upstream.path"),
        } as const,
        factoryDestination: string(
          entry.factoryDestination,
          "acceptance.factoryDestination",
        ),
        generatedDestination: string(
          entry.generatedDestination,
          "acceptance.generatedDestination",
        ),
        route: string(entry.route, "acceptance.route"),
        behaviorCheck: string(entry.behaviorCheck, "acceptance.behaviorCheck"),
        evidence: stringArray(entry.evidence, "acceptance.evidence"),
      };
    }),
  };
}

function readRegistryFilesValue(value: unknown): SaasUiRegistryFiles {
  const root = record(value, REGISTRY_FILES_PATH);
  if (root.schemaVersion !== 1)
    throw new Error("registry files schemaVersion must be 1");
  const sourceCommit = string(root.sourceCommit, "registry files.sourceCommit");
  if (!Array.isArray(root.files))
    throw new Error("registry files.files must be an array");
  const files = root.files.map((fileValue, index) => {
    const file = record(fileValue, `registry files.files[${index}]`);
    const destination = string(file.destination, "registry files.destination");
    const sha256 = string(file.sha256, "registry files.sha256");
    if (!/^[a-f0-9]{64}$/.test(sha256))
      throw new Error(`registry files.files[${index}] sha256 is invalid`);
    return { destination, sha256 };
  });
  return { schemaVersion: 1, sourceCommit, files };
}

export function readSaasUiAcceptance(root: string): SaasUiAcceptanceMap {
  return readAcceptanceValue(readJson(root, ACCEPTANCE_PATH));
}

export function readSaasUiRegistryFiles(root: string): SaasUiRegistryFiles {
  return readRegistryFilesValue(readJson(root, REGISTRY_FILES_PATH));
}

function duplicateValues(values: readonly string[]): readonly string[] {
  return [
    ...new Set(
      values.filter((value, index) => values.indexOf(value) !== index),
    ),
  ];
}

function readAuthority<T>(read: () => T, errors: string[]): T | undefined {
  try {
    return read();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function validateManifest(manifest: SaasUiManifest): readonly string[] {
  const errors: string[] = [];
  const compositionIds = manifest.compositions.map(({ id }) => id);
  if (compositionIds.join("\u0000") !== COMPOSITION_IDS.join("\u0000"))
    errors.push(
      "manifest compositions do not match the approved acceptance set",
    );
  for (const duplicate of duplicateValues(compositionIds))
    errors.push(`duplicate composition id: ${duplicate}`);
  for (const composition of manifest.compositions) {
    if (composition.files.length === 0)
      errors.push(`composition ${composition.id} has no source files`);
    for (const file of composition.files) {
      if (file.source.startsWith("/") || file.destination.startsWith("/"))
        errors.push(`composition ${composition.id} contains an absolute path`);
    }
  }
  return errors;
}

function validateAcceptance(
  acceptance: SaasUiAcceptanceMap,
  compositionIds: readonly string[],
): readonly string[] {
  const errors: string[] = [];
  const acceptanceIds = acceptance.entries.map(({ id }) => id);
  if (new Set(acceptanceIds).size !== acceptanceIds.length)
    errors.push("acceptance entries contain duplicate ids");
  if (
    new Set(acceptanceIds).size !== new Set(compositionIds).size ||
    acceptanceIds.some((id) => !compositionIds.includes(id))
  )
    errors.push("acceptance entries do not cover every composition");
  for (const entry of acceptance.entries) {
    const expectedCommit =
      entry.upstream.repository === "starter" ? PINS.starter : PINS.pro;
    if (entry.upstream.commit !== expectedCommit)
      errors.push(
        `acceptance ${entry.id} has an unpinned ${entry.upstream.repository} commit`,
      );
    if (!entry.route.startsWith("/"))
      errors.push(`acceptance ${entry.id} route must start with /`);
    if (entry.evidence.length === 0)
      errors.push(`acceptance ${entry.id} has no evidence`);
  }
  return errors;
}

function validateRegistryFiles(
  registryFiles: SaasUiRegistryFiles,
  manifest: SaasUiManifest,
  root: string,
): readonly string[] {
  const errors: string[] = [];
  if (registryFiles.sourceCommit !== manifest.pins.pro)
    errors.push("registry files source commit is not the approved Pro pin");
  const destinations = registryFiles.files.map(
    ({ destination }) => destination,
  );
  for (const duplicate of duplicateValues(destinations))
    errors.push(`duplicate registry file destination: ${duplicate}`);
  for (const destination of destinations) {
    if (destination.startsWith("/") || destination.includes(".."))
      errors.push(
        `registry file destination is not repository-relative: ${destination}`,
      );
  }
  if (registryFiles.files.length === 0)
    errors.push("registry files receipt has no files");
  for (const file of registryFiles.files) {
    try {
      const actual = createHash("sha256")
        .update(readFileSync(resolve(root, file.destination)))
        .digest("hex");
      if (actual !== file.sha256)
        errors.push(`registry file hash mismatch: ${file.destination}`);
    } catch {
      errors.push(`registry file destination is missing: ${file.destination}`);
    }
  }
  return errors;
}

const FACTORY_SUPPORT_DESTINATIONS = new Set([
  "tsconfig.base.json",
  "apps/web/tsconfig.json",
  "apps/web/src/features/common/components/client-resizer.tsx",
  "apps/web/src/routes/__root.tsx",
  "apps/web/src/lib/trpc/react.tsx",
  "apps/web/src/components/back-button.tsx",
  "apps/web/src/features/contacts/list/list-page.tsx",
  "apps/web/src/features/contacts/inbox/inbox-layout.tsx",
  "apps/web/src/features/contacts/inbox/inbox-view-page.tsx",
  "apps/web/src/routes/_workspace.inbox.$id.tsx",
  "patches/@saas-ui-pro__react@1.0.0-next.4.patch",
]);
const DEVIATION_EVIDENCE_AUTHORITY = new Map<string, string>([
  [
    "@saas-ui-pro/react@1.0.0-next.4:components/resize/use-resize.ts:useEventListener(document, ...)|apps/web/src/features/common/components/client-resizer.tsx",
    "apps/web/src/features/common/components/client-resizer.test.tsx#renders its fallback during SSR without evaluating the browser-only resizer",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:components/resize/resize-handle.tsx:ResizeHandle|apps/web/src/features/common/components/app-sidebar.tsx:ResizeHandle",
    "apps/web/src/features/common/shell.test.tsx#guards the upstream resizer from SSR and exposes an accessible separator",
  ],
  [
    "tsconfig.base.json:compilerOptions.exactOptionalPropertyTypes|apps/web/tsconfig.json:compilerOptions.exactOptionalPropertyTypes",
    "tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts#builds a freshly materialized customer target with frozen dependencies",
  ],
  [
    "tsconfig.base.json:compilerOptions.noUncheckedIndexedAccess|apps/web/tsconfig.json:compilerOptions.noUncheckedIndexedAccess",
    "tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts#builds a freshly materialized customer target with frozen dependencies",
  ],
  [
    "@chakra-ui/react@3.30.0:components/stat:StatRoot|apps/web/src/features/reports/reports-page.tsx:Churn by tier metric",
    "apps/web/src/features/reports/reports-page.test.tsx#does not expose the chart legend as an invalid definition-list item",
  ],
  [
    "apps/web/src/features/common/providers/app-provider.tsx:QueryClientProvider/AuthProvider|apps/web/src/features/common/providers/app-provider.tsx",
    "apps/web/src/features/common/providers/app-provider.test.tsx#closes the generated auth and React Query provider boundary",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:components/resize/Resizer|apps/web/src/features/contacts/inbox/inbox-layout.tsx; apps/web/src/features/settings/common/settings-sidebar.tsx",
    "tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts#projects SSR-safe provider and resizer seams for upstream screens",
  ],
  [
    "apps/web/src/routes/__root.tsx:AppProvider|apps/web/src/routes/__root.tsx",
    "tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts#projects SSR-safe provider and resizer seams for upstream screens",
  ],
  [
    "apps/web/src/lib/trpc/react.tsx:fake procedure facade|apps/web/src/lib/trpc/react.tsx",
    "apps/web/src/lib/trpc/react.test.tsx#serves the shared neutral fixtures required by projected SaaS UI screens",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:Aside.Root|apps/web/src/features/contacts/view/contact-page.tsx; apps/web/src/features/contacts/view/contact-sidebar.tsx",
    "tests/e2e/saas-ui-golden.interactions.spec.ts#test(`${kind} navigates list to detail and switches the record aside`, async ({",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:DataGridColumnResizer|apps/web/src/features/contacts/list/list-page.tsx",
    "apps/web/src/features/contacts/list/list-page.ssr.test.tsx#renders the data-grid route during SSR without browser globals",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:DataGridSort and DataGridHeaderCell|patches/@saas-ui-pro__react@1.0.0-next.4.patch; apps/web/src/features/contacts/list/list-page.tsx",
    "tests/e2e/saas-ui-golden.accessibility.spec.ts#test(`${kind} keeps sorting semantics on column headers and names row actions`, async ({",
  ],
  [
    "apps/web/src/features/auth/login-page.tsx; apps/web/src/features/settings/billing/manage-billing-button.tsx|apps/web/src/features/auth/login-page.tsx; apps/web/src/features/settings/billing/manage-billing-button.tsx",
    "tests/e2e/saas-ui-golden.accessibility.spec.ts#test(`${entry.id} ${kind} has no serious or critical axe violations`, async ({",
  ],
  [
    "@saas-ui/react:Steps.List dots recipe|apps/web/src/features/getting-started/getting-started-page.tsx:OnboardingProgress",
    "tests/e2e/saas-ui-golden.accessibility.spec.ts#test(`${kind} exposes the visual step indicator as named progress`, async ({",
  ],
  [
    "@saas-ui/react:BackButtonPrimitive|apps/web/src/components/back-button.tsx",
    "tests/e2e/saas-ui-golden.accessibility.spec.ts#test(`${entry.id} exposes names and visible keyboard focus on both authorities`, async ({",
  ],
  [
    "@chakra-ui/react semantic token fg.error|apps/web/src/theme/semantic-tokens/colors.ts",
    "tests/e2e/saas-ui-golden.accessibility.spec.ts#test(`${kind} has no serious or critical dark-mode axe violations`, async ({",
  ],
  [
    "@saas-ui-pro/react@1.0.0-next.4:components/split-page/SplitPage|apps/web/src/features/contacts/inbox/inbox-layout.tsx; apps/web/src/features/contacts/inbox/inbox-view-page.tsx; apps/web/src/routes/_workspace.inbox.$id.tsx",
    "tests/e2e/saas-ui-golden.interactions.spec.ts#test(`${kind} switches between one inbox pane at a time`, async ({",
  ],
]);

function deviationDestinationPaths(destination: string): readonly string[] {
  return destination.split(";").flatMap((entry) => {
    const path = entry.trim().split(":", 1)[0];
    return path === undefined ? [] : [path];
  });
}

// eslint-disable-next-line complexity -- validates the bounded deviation authority fields.
function validateDeviations(
  deviations: readonly SaasUiDeviation[],
  root: string,
): readonly string[] {
  const errors: string[] = [];
  const receipt = readJson(root, "docs/template/saas-ui-starter-files.json");
  const receiptFiles = Array.isArray(record(receipt, "starter receipt").files)
    ? (record(receipt, "starter receipt").files as readonly unknown[])
    : [];
  const adaptedDestinations = new Set(
    receiptFiles.flatMap((value) => {
      const item = record(value, "starter receipt file");
      return item.adapted === true && typeof item.destination === "string"
        ? [item.destination]
        : [];
    }),
  );
  for (const deviation of deviations) {
    const expectedCheck = DEVIATION_EVIDENCE_AUTHORITY.get(
      `${deviation.source}|${deviation.destination}`,
    );
    if (
      deviation.evidenceChecks.length !== 1 ||
      deviation.evidenceChecks[0] !== expectedCheck
    )
      errors.push(
        `deviation evidence check is not the approved check: ${deviation.destination}`,
      );
    for (const path of deviation.evidencePaths) {
      if (
        path.includes("..") ||
        path.startsWith("/") ||
        !existsSync(resolve(root, path))
      )
        errors.push(`deviation evidence path is missing: ${path}`);
    }
    for (const check of deviation.evidenceChecks) {
      const [path, ...name] = check.split("#");
      if (!existsSync(resolve(root, path)))
        errors.push(`deviation evidence check file is missing: ${path}`);
      else if (
        name.length > 0 &&
        !hasExecutableEvidenceDeclaration(
          readFileSync(resolve(root, path), "utf8"),
          name.join("#"),
        )
      )
        errors.push(`deviation evidence check is not present: ${check}`);
    }
    const paths = deviationDestinationPaths(deviation.destination);
    for (const path of paths) {
      if (deviation.sourceAuthority === "factory-support") {
        if (!FACTORY_SUPPORT_DESTINATIONS.has(path))
          errors.push(
            `factory-support deviation destination is not approved: ${path}`,
          );
      } else if (
        !existsSync(resolve(root, "docs/template/saas-ui-starter-files.json"))
      ) {
        errors.push("starter-receipt deviation authority is missing");
      } else if (!adaptedDestinations.has(path)) {
        errors.push(
          `starter-receipt deviation destination is not adapted: ${path}`,
        );
      }
    }
  }
  return errors;
}

export function checkSaasUiFoundation(root: string): readonly string[] {
  const errors: string[] = [];
  const manifest = readAuthority(() => readSaasUiManifest(root), errors);
  const acceptance = readAuthority(() => readSaasUiAcceptance(root), errors);
  const registryFiles = readAuthority(
    () => readSaasUiRegistryFiles(root),
    errors,
  );
  const deviations = readAuthority(() => readSaasUiDeviations(root), errors);
  for (const deviation of deviations ?? [])
    if (deviation.reason.toLowerCase().includes("aesthetic"))
      errors.push(`deviation ${deviation.source} uses an aesthetic reason`);
  if (!manifest || !acceptance || !registryFiles) return errors;
  errors.push(...validateManifest(manifest));
  errors.push(
    ...validateAcceptance(
      acceptance,
      manifest.compositions.map(({ id }) => id),
    ),
  );
  errors.push(...validateRegistryFiles(registryFiles, manifest, root));
  errors.push(...validateDeviations(deviations ?? [], root));
  return errors;
}

export { COMPOSITION_IDS, PINS };
