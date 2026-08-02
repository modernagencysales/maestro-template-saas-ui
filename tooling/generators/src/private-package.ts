import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

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
  readonly previewFingerprint: `private_package_sha256:${string}`;
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
): PrivatePackageManifest | undefined => {
  const path = resolve(fixturePath, "template-package.json");
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as PrivatePackageManifest)
    : undefined;
};

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

const fingerprint = (value: unknown): `private_package_sha256:${string}` =>
  `private_package_sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`;

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
  const manifest = manifestAt(options.fixturePath);
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
      status: manifest ? "pass" : "warn",
      detail: manifest
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
  const previewFingerprint = fingerprint({
    packageName,
    system: options.system,
    disposition: options.disposition,
    files: files.map(({ path, content }) => ({
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
    collisions,
    privacy,
  });
  const fixtureArgument = options.fixtureArgument ?? options.fixturePath;
  const confirmationCommand = `pnpm template:private-package:import -- --fixture ${quote(fixtureArgument)} --system ${quote(options.system)} --disposition ${options.disposition} --write --preflight-fingerprint ${previewFingerprint}`;

  return {
    fixturePath: options.fixturePath,
    mode,
    ok: checks.every(({ status }) => status !== "fail"),
    packageName,
    files,
    checks,
    collisions,
    privacy,
    previewFingerprint,
    confirmationCommand,
  };
};

export const executePrivatePackagePlan = (options: {
  readonly fixturePath: string;
  readonly fixtureArgument?: string;
  readonly targetRoot: string;
  readonly system: string;
  readonly disposition: PrivatePackageDisposition;
  readonly mode: "dry-run" | "import";
  readonly write: boolean;
  readonly preflightFingerprint?: string;
}): PrivatePackagePlan => {
  const plan = buildPrivatePackagePlan(options);
  if (!options.write) return plan;
  if (options.mode !== "import")
    throw new Error("Only private-package:import accepts --write");
  if (options.preflightFingerprint !== plan.previewFingerprint) {
    throw new Error(
      `Private-package fingerprint mismatch. Review preview and rerun exactly: ${plan.confirmationCommand}`,
    );
  }
  if (plan.collisions.length > 0) {
    throw new Error(
      `Refusing to overwrite existing private-package paths: ${plan.collisions.join(", ")}`,
    );
  }
  for (const file of plan.files) {
    const path = resolve(options.targetRoot, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content, { flag: "wx" });
  }
  return plan;
};
