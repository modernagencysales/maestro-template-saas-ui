import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

export type PrivatePackageDisposition = "reuse" | "extend";

export type PrivatePackageGeneratedFile = {
  readonly path: string;
  readonly content: string;
};

export type PrivatePackageCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: "pass" | "warn" | "fail";
  readonly detail: string;
};

export type PrivatePackagePlan = {
  readonly fixturePath: string;
  readonly mode: "dry-run" | "import";
  readonly ok: boolean;
  readonly packageName: string;
  readonly files: readonly PrivatePackageGeneratedFile[];
  readonly checks: readonly PrivatePackageCheck[];
  readonly collisions: readonly string[];
  readonly privacy: {
    readonly reads: readonly ["template-package.json"];
    readonly readsSeedData: false;
    readonly readsSecrets: false;
    readonly productionRegistrations: false;
  };
  readonly confirmationCommand: string;
};

type PrivatePackageManifest = {
  readonly name?: string;
  readonly capabilities?: readonly string[];
  readonly workflows?: readonly string[];
  readonly agents?: readonly string[];
  readonly docs?: readonly string[];
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const pascalCase = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("") || "GeneratedModule";

const camelCase = (value: string): string => {
  const pascal = pascalCase(value);
  return `${pascal[0]?.toLowerCase() ?? "g"}${pascal.slice(1)}`;
};

const manifestAt = (
  fixturePath: string,
): {
  readonly manifest: PrivatePackageManifest | undefined;
  readonly error: string | undefined;
} => {
  const path = resolve(fixturePath, "template-package.json");
  if (!existsSync(path)) return { manifest: undefined, error: undefined };
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isPrivatePackageManifest(value))
      return {
        manifest: undefined,
        error: "Manifest declarations are invalid.",
      };
    return { manifest: value, error: undefined };
  } catch {
    return { manifest: undefined, error: "Manifest JSON is malformed." };
  }
};

const isPrivatePackageManifest = (
  value: unknown,
): value is PrivatePackageManifest => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const manifest = value as Record<string, unknown>;
  return (
    (manifest.name === undefined || isDeclaration(manifest.name)) &&
    ["capabilities", "workflows", "agents", "docs"].every(
      (key) =>
        manifest[key] === undefined ||
        (Array.isArray(manifest[key]) && manifest[key].every(isDeclaration)),
    )
  );
};

const isDeclaration = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value !== "." &&
  value !== ".." &&
  !value.includes("/") &&
  !value.includes("\\");

const packageNameFor = (
  fixturePath: string,
  manifest?: PrivatePackageManifest,
): string =>
  slugify(manifest?.name?.trim() ?? basename(fixturePath)) || "client-package";

const capabilityFiles = (
  packageName: string,
  capabilityName: string,
  ownership: {
    readonly system: string;
    readonly disposition: PrivatePackageDisposition;
  },
): readonly PrivatePackageGeneratedFile[] => {
  const name = camelCase(capabilityName);
  const basePath = `private-packages/${packageName}/src/capabilities/${name}`;
  return [
    {
      path: `${basePath}/${name}.contract.json`,
      content: `${JSON.stringify(
        {
          capability: name,
          packageName,
          authScope: "workspace member",
          typedErrors: ["Unauthorized", "ValidationFailed", "Forbidden"],
          surfaces: ["api", "cli", "mcp"],
          promotionCommand: `pnpm template:promote-capability -- --name ${name} --system ${ownership.system} --disposition ${ownership.disposition} --write`,
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalCase(name)} Capability Module

Private package capability module for \`${packageName}\`.

1. Review fixture redaction and source ownership.
2. Promote through \`template:promote-capability\`; never import this module into production.
3. Run \`pnpm check:confect-contracts\` and focused capability tests.
`,
    },
  ];
};

const workflowFiles = (
  packageName: string,
  workflowName: string,
  ownership: {
    readonly system: string;
    readonly disposition: PrivatePackageDisposition;
  },
): readonly PrivatePackageGeneratedFile[] => {
  const name = camelCase(workflowName);
  const basePath = `private-packages/${packageName}/src/workflows/${name}`;
  return [
    {
      path: `${basePath}/${name}.workflow.json`,
      content: `${JSON.stringify(
        {
          workflow: name,
          packageName,
          promoted: false,
          nodes: [
            { id: "source", kind: "source", label: "Source Set" },
            {
              id: "capability",
              kind: "capability",
              label: "Private Capability",
            },
            { id: "approval", kind: "approval", label: "Policy Approval" },
            { id: "receipt", kind: "output", label: "Trust Receipt" },
          ],
          edges: [
            { id: "e1", source: "source", target: "capability" },
            { id: "e2", source: "capability", target: "approval" },
            { id: "e3", source: "approval", target: "receipt" },
          ],
          promotionCommand: `pnpm template:promote-workflow -- --name ${name} --system ${ownership.system} --disposition ${ownership.disposition} --write`,
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `${basePath}/README.md`,
      content: `# ${pascalCase(name)} Workflow Module

Private package workflow module for \`${packageName}\`.

Review graph policy, approvals, idempotency, and receipt behavior before promotion.
`,
    },
  ];
};

const quote = (value: string): string => JSON.stringify(value);

export const buildPrivatePackagePlan = (options: {
  readonly fixturePath: string;
  readonly fixtureArgument?: string;
  readonly targetRoot?: string;
  readonly system: string;
  readonly disposition: PrivatePackageDisposition;
  readonly mode?: "dry-run" | "import";
}): PrivatePackagePlan => {
  const mode = options.mode ?? "dry-run";
  const manifestPath = resolve(options.fixturePath, "template-package.json");
  const manifestResult = manifestAt(options.fixturePath);
  const manifest = manifestResult.manifest;
  const packageName = packageNameFor(options.fixturePath, manifest);
  const capabilities = manifest?.capabilities?.length
    ? manifest.capabilities
    : ["summarizeSource"];
  const workflows = manifest?.workflows?.length
    ? manifest.workflows
    : ["sourceGroundedPlan"];
  const docs = manifest?.docs?.length ? manifest.docs : ["README.md"];
  const checks: readonly PrivatePackageCheck[] = [
    {
      id: "fixture:manifest",
      label: "Package manifest",
      status: manifestResult.error ? "fail" : manifest ? "pass" : "warn",
      detail: manifestResult.error
        ? manifestResult.error
        : manifest
          ? `Found ${manifestPath}`
          : "No template-package.json found; using safe defaults.",
    },
    {
      id: "fixture:privacy",
      label: "Privacy boundary",
      status: "pass",
      detail:
        "Only template-package.json is read; seed data, provider payloads, and secrets are excluded.",
    },
    {
      id: "fixture:contracts",
      label: "Generated contracts",
      status: "pass",
      detail:
        "Capabilities and workflows remain non-production review artifacts.",
    },
  ];
  const baseFiles: readonly PrivatePackageGeneratedFile[] = [
    {
      path: `private-packages/${packageName}/package-plan.json`,
      content: `${JSON.stringify(
        {
          packageName,
          reviewBoundary: "private-packages-first",
          contractReview: "required-before-promotion",
          system: options.system,
          disposition: options.disposition,
          productionRegistrations: false,
          capabilities,
          workflows,
          agents: manifest?.agents ?? [],
          docs,
          ownershipNotes: [
            "Assign a client/package owner before promotion.",
            "Confirm source ownership, retention, and redaction posture.",
          ],
          migrationNotes: [
            "Do not promote directly into template core.",
            "Promote reviewed contracts through template:promote-* commands.",
          ],
          requiredChecks: [
            "pnpm check:confect-contracts",
            "pnpm check:schema-migration-notes",
            "pnpm check:secret-canaries",
          ],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: `private-packages/${packageName}/README.md`,
      content: `# ${packageName} Private Package

Generated from the reviewed manifest at \`${options.fixturePath}\`. Seed files are not read or copied.
`,
    },
    {
      path: `private-packages/${packageName}/src/index.ts`,
      content: `export const privatePackage = ${JSON.stringify(
        {
          packageName,
          capabilities: capabilities.map(camelCase),
          workflows: workflows.map(camelCase),
          docs,
          requiredChecks: [
            "pnpm check:confect-contracts",
            "pnpm check:workflow-graph-boundary",
            "pnpm check:schema-migration-notes",
            "pnpm check:secret-canaries",
          ],
        },
        null,
        2,
      )} as const;\n`,
    },
    ...capabilities.flatMap((name) =>
      capabilityFiles(packageName, name, options),
    ),
    ...workflows.flatMap((name) => workflowFiles(packageName, name, options)),
  ];
  const files = [
    ...baseFiles,
    {
      path: `docs/template/generated/provenance/private-package/${packageName}.json`,
      content: `${JSON.stringify(
        {
          generator: "private-package",
          commandFamily: "template:private-package:import",
          name: packageName,
          ownership: {
            system: options.system,
            disposition: options.disposition,
          },
          generatedPaths: baseFiles.map(({ path }) => path),
        },
        null,
        2,
      )}\n`,
    },
  ] as const;
  const targetRoot = options.targetRoot;
  const collisions = targetRoot
    ? files
        .map(({ path }) => path)
        .filter((path) => existsSync(resolve(targetRoot, path)))
    : [];
  const privacy = {
    reads: ["template-package.json"],
    readsSeedData: false,
    readsSecrets: false,
    productionRegistrations: false,
  } as const;
  const fixtureArgument = options.fixtureArgument ?? options.fixturePath;
  const confirmationCommand = `pnpm template:private-package:import -- --fixture ${quote(fixtureArgument)} --system ${quote(options.system)} --disposition ${options.disposition} --write`;

  return {
    fixturePath: options.fixturePath,
    mode,
    ok: checks.every(({ status }) => status !== "fail"),
    packageName,
    files,
    checks,
    collisions,
    privacy,
    confirmationCommand,
  };
};

const isInside = (root: string, path: string): boolean => {
  const distance = relative(root, path);
  return (
    distance !== "" &&
    distance !== ".." &&
    !distance.startsWith(`..${sep}`) &&
    !isAbsolute(distance)
  );
};

const assertSafeDestinations = (
  plan: PrivatePackagePlan,
  options: { readonly fixturePath: string; readonly targetRoot: string },
): void => {
  const targetRoot = resolve(options.targetRoot);
  const protectedRoots = [
    resolve(options.fixturePath),
    resolve(targetRoot, ".git"),
    resolve(targetRoot, ".maestro"),
    resolve(targetRoot, "node_modules"),
  ];
  for (const file of plan.files) {
    const destination = resolve(targetRoot, file.path);
    if (!isInside(targetRoot, destination))
      throw new Error(
        `Private-package destination escapes target root: ${file.path}`,
      );
    if (protectedRoots.some((root) => isInside(root, destination)))
      throw new Error(
        `Private-package destination is under a protected root: ${file.path}`,
      );
    let ancestor = targetRoot;
    if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink())
      throw new Error(`Refusing symlinked target ancestor: ${ancestor}`);
    for (const segment of relative(targetRoot, destination)
      .split(sep)
      .slice(0, -1)) {
      ancestor = resolve(ancestor, segment);
      if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink())
        throw new Error(`Refusing symlinked target ancestor: ${ancestor}`);
    }
  }
};

const writePrivatePackageFiles = (
  plan: PrivatePackagePlan,
  targetRoot: string,
): void => {
  const created: string[] = [];
  try {
    for (const file of plan.files) {
      const path = resolve(targetRoot, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content, { flag: "wx" });
      created.push(file.path);
    }
  } catch (error) {
    throw new Error(
      `Private-package import failed; newly created paths: ${created.join(", ") || "(none)"}. Remove only those paths before rerunning. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const executePrivatePackagePlan = (options: {
  readonly fixturePath: string;
  readonly fixtureArgument?: string;
  readonly targetRoot: string;
  readonly system: string;
  readonly disposition: PrivatePackageDisposition;
  readonly mode: "dry-run" | "import";
  readonly write: boolean;
}): PrivatePackagePlan => {
  const plan = buildPrivatePackagePlan(options);
  if (!options.write) return plan;
  if (options.mode !== "import" || !plan.ok)
    throw new Error("Private-package import is not safe to write.");
  if (plan.collisions.length > 0) {
    throw new Error(
      `Refusing to overwrite existing private-package paths: ${plan.collisions.join(", ")}`,
    );
  }
  assertSafeDestinations(plan, options);
  writePrivatePackageFiles(plan, options.targetRoot);
  return plan;
};
