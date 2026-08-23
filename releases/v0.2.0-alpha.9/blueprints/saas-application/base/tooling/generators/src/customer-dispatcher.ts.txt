import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  findCanonicalSystems,
  normalizeSystemLookup,
} from "@maestro-template/template-core/systemCatalog";
import {
  buildAgentFiles,
  buildAgentSeatFiles,
  buildCapabilityFiles,
  buildCapabilityPromotionFiles,
  buildFeatureFiles,
  buildTableFiles,
  buildWorkflowFiles,
  buildWorkflowPromotionFiles,
  doctorTemplateInstance,
  parseCustomerTemplateInstance,
  readDataResourceCatalog,
  readProductTopology,
  readSystemCatalog,
  type GeneratedFile,
  type SystemGeneratorDisposition,
} from "./customer-runtime";
import { executePrivatePackagePlan } from "./private-package";
import { buildShellConfigurationFiles } from "./shell-configuration";
import { bumpRelease, publishRelease } from "./workflow-release-commands";

export type CustomerCommandResult = {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
};

const valueAfter = (
  argv: readonly string[],
  flag: string,
): string | undefined => {
  const index = argv.indexOf(flag);
  return index < 0 ? undefined : argv[index + 1];
};

const writeFiles = (files: readonly GeneratedFile[], cwd: string): void => {
  for (const file of files) {
    const path = resolve(cwd, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
};

const json = (value: unknown): CustomerCommandResult => ({
  exitCode: 0,
  stdout: `${JSON.stringify(value, null, 2)}\n`,
  stderr: "",
});

const ownership = (
  argv: readonly string[],
): {
  readonly system: string;
  readonly disposition: SystemGeneratorDisposition;
} => {
  const system = valueAfter(argv, "--system");
  const disposition = valueAfter(argv, "--disposition");
  if (!system || (disposition !== "reuse" && disposition !== "extend")) {
    throw new Error(
      "Commands require --system <id> --disposition reuse|extend",
    );
  }
  return { system, disposition };
};

const customerCommands = [
  "add-feature",
  "add-table",
  "add-capability",
  "add-workflow",
  "add-agent",
  "add-agent-seat",
  "promote-capability",
  "promote-workflow",
  "bump-capability",
  "bump-workflow",
  "publish-capability",
  "publish-workflow",
  "private-package:dry-run",
  "private-package:import",
  "configure-shell",
  "doctor",
  "systems",
  "smoke",
] as const;

type CustomerCommand = (typeof customerCommands)[number];

const customerCommandHelp = {
  "add-feature":
    "template:add-feature --name <name> --system <canonical-id> --disposition reuse|extend --screen-catalog-id <exact-id> [--description <text>] [--write]",
  "add-table":
    "template:add-table --name <name> --system <canonical-id> --disposition extend --tenant-scope global|organization|workspace|user --sensitivity public|internal|confidential|restricted --pii <comma-list|none> --export-mode markdown|json|redacted-json|not-applicable --delete-mode delete|redact|retain-audit|not-applicable --retention <action> [--append-only] [--description <text>] [--write]",
  "add-capability":
    "template:add-capability --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--exposure web|workflow|headless] [--write]",
  "add-workflow":
    "template:add-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
  "add-agent":
    "template:add-agent --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
  "add-agent-seat":
    "template:add-agent-seat --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
  "promote-capability":
    "template:promote-capability --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
  "promote-workflow":
    "template:promote-workflow --name <name> --system <canonical-id> --disposition reuse|extend [--description <text>] [--write]",
  "bump-capability":
    "template:bump-capability --name <name> --from <N> --to <N+1> [--write]",
  "bump-workflow":
    "template:bump-workflow --name <name> --from <N> --to <N+1> [--write]",
  "publish-capability":
    "template:publish-capability --name <name> --version <N>",
  "publish-workflow": "template:publish-workflow --name <name> --version <N>",
  "private-package:dry-run":
    "template:private-package:dry-run --fixture <path> --system <canonical-id> --disposition reuse|extend",
  "private-package:import":
    "template:private-package:import --fixture <path> --system <canonical-id> --disposition reuse|extend --write",
  "configure-shell":
    "template:configure-shell --dashboard-label <text> --dashboard-screen reports|connections --inbox-label <text> --inbox-screen contacts|brain --contacts-label <text> --contacts-screen contacts|clients --kanban-label <text> --kanban-route <route> --showcase-label <text> --showcase-route <route> --search-screen workspace|assistant [--write]",
  doctor:
    "template:doctor [--mode fake|test|live] [--path <template-instance.json>]",
  systems:
    "template:systems [--query <exact-id-alias-responsibility-or-table>]",
  smoke: "template:smoke",
} as const satisfies Readonly<Record<CustomerCommand, string>>;

export const CUSTOMER_COMMANDS: readonly CustomerCommand[] = customerCommands;

const help = (command: CustomerCommand): CustomerCommandResult => ({
  exitCode: 0,
  stdout: `${customerCommandHelp[command]}\n`,
  stderr: "",
});

export const runCustomerGeneratorCli = (
  argv: readonly string[],
  cwd = process.cwd(),
  // eslint-disable-next-line complexity -- AP-008 tracks splitting projected customer command dispatch.
): CustomerCommandResult => {
  if (argv[0] === "--") return runCustomerGeneratorCli(argv.slice(1), cwd);
  try {
    const cliArgv = argv.filter((argument) => argument !== "--");
    const command = cliArgv[0];
    if (!command || command === "help")
      return json({ commands: customerCommands });
    if (
      customerCommands.includes(command as CustomerCommand) &&
      (cliArgv[1] === "--help" || cliArgv[1] === "-h")
    )
      return help(command as CustomerCommand);
    const name = valueAfter(cliArgv, "--name");
    const description = valueAfter(cliArgv, "--description");
    const write = cliArgv.includes("--write");
    const finish = (value: { readonly files: readonly GeneratedFile[] }) => {
      if (write) writeFiles(value.files, cwd);
      return json(value);
    };
    if (command === "systems") {
      const catalog = readSystemCatalog(cwd);
      const query = valueAfter(cliArgv, "--query");
      return json(
        query
          ? findCanonicalSystems(catalog, normalizeSystemLookup(query))
          : catalog,
      );
    }
    if (command === "doctor") {
      const path = resolve(
        cwd,
        valueAfter(cliArgv, "--path") ?? "template-instance.json",
      );
      const requestedMode = valueAfter(cliArgv, "--mode");
      if (
        requestedMode !== undefined &&
        !["fake", "test", "live"].includes(requestedMode)
      )
        throw new Error(`Unknown provider mode: ${requestedMode}`);
      return json(
        doctorTemplateInstance(
          parseCustomerTemplateInstance(readFileSync(path, "utf8")),
          {
            repoRoot: cwd,
            instancePath: path,
            ...(requestedMode === undefined
              ? {}
              : { mode: requestedMode as "fake" | "test" | "live" }),
          },
        ),
      );
    }
    if (command === "smoke") {
      return json({
        ok: true,
        systems: readSystemCatalog(cwd).systems.length,
        dataResources: readDataResourceCatalog(cwd).resources.length,
        topology: readProductTopology(cwd).resources.length,
      });
    }
    if (command === "configure-shell") {
      const required = (flag: string): string => {
        const value = valueAfter(cliArgv, flag);
        if (!value)
          throw new Error(`Missing required ${flag} for configure-shell`);
        return value;
      };
      const dashboardScreen = required("--dashboard-screen");
      const inboxScreen = required("--inbox-screen");
      const contactsScreen = required("--contacts-screen");
      const kanbanRoute = required("--kanban-route");
      const showcaseRoute = required("--showcase-route");
      const searchScreen = required("--search-screen");
      if (dashboardScreen !== "reports" && dashboardScreen !== "connections")
        throw new Error("--dashboard-screen must be reports or connections");
      if (inboxScreen !== "contacts" && inboxScreen !== "brain")
        throw new Error("--inbox-screen must be contacts or brain");
      if (contactsScreen !== "contacts" && contactsScreen !== "clients")
        throw new Error("--contacts-screen must be contacts or clients");
      if (
        kanbanRoute !== "/$workspace/kanban" &&
        kanbanRoute !== "/$workspace/settings/account/profile"
      )
        throw new Error("Unsupported --kanban-route");
      if (
        showcaseRoute !== "/$workspace/showcase" &&
        showcaseRoute !== "/$workspace/search"
      )
        throw new Error("Unsupported --showcase-route");
      if (searchScreen !== "workspace" && searchScreen !== "assistant")
        throw new Error("--search-screen must be workspace or assistant");
      return finish(
        buildShellConfigurationFiles({
          dashboardLabel: required("--dashboard-label"),
          dashboardScreen,
          inboxLabel: required("--inbox-label"),
          inboxScreen,
          contactsLabel: required("--contacts-label"),
          contactsScreen,
          kanbanLabel: required("--kanban-label"),
          kanbanRoute,
          showcaseLabel: required("--showcase-label"),
          showcaseRoute,
          searchScreen,
        }),
      );
    }
    if (
      command === "private-package:dry-run" ||
      command === "private-package:import"
    ) {
      const rejectedFlag = [
        "--preflight-fingerprint",
        "--privacy-reviewed",
      ].find((flag) => cliArgv.includes(flag));
      if (rejectedFlag)
        throw new Error(
          `Private-package import does not accept ${rejectedFlag}`,
        );
      const fixture = valueAfter(cliArgv, "--fixture");
      if (!fixture)
        throw new Error(`Missing required --fixture for ${command}`);
      return json(
        executePrivatePackagePlan({
          fixturePath: resolve(cwd, fixture),
          fixtureArgument: fixture,
          targetRoot: cwd,
          ...ownership(cliArgv),
          mode: command === "private-package:import" ? "import" : "dry-run",
          write,
        }),
      );
    }
    if (!name) throw new Error(`Missing required --name for ${command}`);
    if (command.startsWith("bump-")) {
      return json(
        bumpRelease({
          cwd,
          kind: command.endsWith("workflow") ? "workflow" : "capability",
          name,
          from: valueAfter(cliArgv, "--from"),
          to: valueAfter(cliArgv, "--to"),
          write,
        }),
      );
    }
    if (command.startsWith("publish-")) {
      return json(
        publishRelease({
          cwd,
          kind: command.endsWith("workflow") ? "workflow" : "capability",
          name,
          version: valueAfter(cliArgv, "--version"),
        }),
      );
    }
    const owner = ownership(cliArgv);
    const common = { name, ...owner, ...(description ? { description } : {}) };
    if (command === "add-feature") {
      const screenCatalogId = valueAfter(cliArgv, "--screen-catalog-id");
      if (!screenCatalogId)
        throw new Error(
          "Missing required --screen-catalog-id for add-feature. Select an exact assembled screen from docs/template/saas-ui-screen-catalog.json.",
        );
      return finish(
        buildFeatureFiles({ ...common, screenCatalogId, catalogRoot: cwd }),
      );
    }
    if (command === "add-capability")
      return finish(
        buildCapabilityFiles({
          ...common,
          exposure: (valueAfter(cliArgv, "--exposure") ?? "headless") as
            "web" | "workflow" | "headless",
        }),
      );
    if (command === "add-workflow") return finish(buildWorkflowFiles(common));
    if (command === "add-agent") return finish(buildAgentFiles(common));
    if (command === "add-agent-seat")
      return finish(buildAgentSeatFiles(common));
    if (command === "promote-capability")
      return finish(buildCapabilityPromotionFiles(common));
    if (command === "promote-workflow")
      return finish(buildWorkflowPromotionFiles(common));
    if (command === "add-table") {
      if (owner.disposition !== "extend")
        throw new Error("New durable tables must use --disposition extend");
      const required = (flag: string): string => {
        const value = valueAfter(cliArgv, flag);
        if (!value) throw new Error(`Missing required ${flag} for add-table`);
        return value;
      };
      const pii = required("--pii");
      return finish(
        buildTableFiles(
          {
            ...common,
            disposition: "extend",
            tenantScope: required("--tenant-scope") as
              "global" | "organization" | "workspace" | "user",
            sensitivity: required("--sensitivity") as
              "public" | "internal" | "confidential" | "restricted",
            pii:
              pii === "none"
                ? []
                : pii
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
            exportMode: required("--export-mode") as
              "markdown" | "json" | "redacted-json" | "not-applicable",
            deleteMode: required("--delete-mode") as
              "delete" | "redact" | "retain-audit" | "not-applicable",
            retention: required("--retention") as
              | "retain-until-workspace-delete"
              | "retain-audit-window"
              | "hash-or-redact-on-export"
              | "retain-until-account-delete"
              | "retain-until-organization-delete"
              | "retain-configuration",
            appendOnly: cliArgv.includes("--append-only"),
            businessEntity: cliArgv.includes("--business-entity"),
          },
          {
            systems: readSystemCatalog(cwd),
            dataResources: readDataResourceCatalog(cwd),
          },
        ),
      );
    }
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Unsupported customer generator command: ${command}\n`,
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
};

export type ReviewedGeneratorDescriptor = {
  readonly generatorId:
    | "add-feature"
    | "add-table"
    | "add-capability"
    | "add-workflow"
    | "add-agent"
    | "add-agent-seat";
  readonly command: `pnpm template:${string}`;
  readonly codegen: readonly string[];
  readonly focusedGates: readonly string[];
};

const backendCodegen = [
  "pnpm confect:codegen",
  "pnpm confect:manifest",
  "pnpm format",
];
const featureCodegen = [...backendCodegen, "pnpm --dir apps/web build"];

export const REVIEWED_GENERATOR_DESCRIPTORS: readonly ReviewedGeneratorDescriptor[] =
  [
    {
      generatorId: "add-feature",
      command: "pnpm template:add-feature",
      codegen: featureCodegen,
      focusedGates: [
        "pnpm check:confect-contracts",
        "pnpm --dir apps/web typecheck",
      ],
    },
    {
      generatorId: "add-table",
      command: "pnpm template:add-table",
      codegen: backendCodegen,
      focusedGates: [
        "pnpm check:system-catalog",
        "pnpm check:data-resources",
        "pnpm check:schema-migration-notes",
      ],
    },
    {
      generatorId: "add-capability",
      command: "pnpm template:add-capability",
      codegen: backendCodegen,
      focusedGates: ["pnpm check:confect-contracts"],
    },
    {
      generatorId: "add-workflow",
      command: "pnpm template:add-workflow",
      codegen: backendCodegen,
      focusedGates: ["pnpm check:confect-contracts"],
    },
    {
      generatorId: "add-agent",
      command: "pnpm template:add-agent",
      codegen: backendCodegen,
      focusedGates: ["pnpm check:confect-contracts"],
    },
    {
      generatorId: "add-agent-seat",
      command: "pnpm template:add-agent-seat",
      codegen: backendCodegen,
      focusedGates: ["pnpm check:confect-contracts"],
    },
  ];

export const resolveReviewedGenerator = (generatorId: string) =>
  REVIEWED_GENERATOR_DESCRIPTORS.some(
    (item) => item.generatorId === generatorId,
  )
    ? { supported: true as const }
    : {
        supported: false as const,
        nearest: REVIEWED_GENERATOR_DESCRIPTORS.slice(0, 1),
      };

export const runReviewedGenerator = (request: {
  readonly generatorId: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly write: boolean;
  readonly cwd: string;
  // eslint-disable-next-line complexity -- AP-008 tracks splitting reviewed generator descriptor dispatch.
}) => {
  const descriptor = REVIEWED_GENERATOR_DESCRIPTORS.find(
    (item) => item.generatorId === request.generatorId,
  );
  if (!descriptor)
    return {
      ok: false as const,
      message: `Unsupported generator: ${request.generatorId}`,
    };
  const argv = [request.generatorId];
  for (const [key, value] of Object.entries(request.args)) {
    const flag = `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    if (value === true) argv.push(flag);
    else if (value !== false && value !== undefined)
      argv.push(
        flag,
        Array.isArray(value)
          ? value.length
            ? value.join(",")
            : "none"
          : String(value),
      );
  }
  const preview = runCustomerGeneratorCli(argv, request.cwd);
  if (preview.exitCode !== 0)
    return { ok: false as const, message: preview.stderr.trim() };
  const value = JSON.parse(preview.stdout) as {
    readonly files: readonly GeneratedFile[];
    readonly followUp?: readonly string[];
  };
  const reviewedMutablePaths = new Set([
    "docs/template/system-catalog.json",
    "docs/template/data-resources.json",
    "packages/convex/confect/ops/dataResources.generated.ts",
  ]);
  const collisions = value.files
    .map((file) => file.path)
    .filter((path) => !reviewedMutablePaths.has(path))
    .filter((path) => existsSync(resolve(request.cwd, path)));
  if (request.write && collisions.length)
    return {
      ok: false as const,
      message: `Refusing to overwrite existing paths: ${collisions.join(", ")}.`,
    };
  if (request.write) {
    const written = runCustomerGeneratorCli([...argv, "--write"], request.cwd);
    if (written.exitCode !== 0)
      return { ok: false as const, message: written.stderr.trim() };
  }
  return {
    ok: true as const,
    output: {
      files: value.files,
      provenancePaths: value.files
        .map((file) => file.path)
        .filter((path) => path.includes("/provenance/")),
      collisions,
      semanticRuleIds: [] as readonly string[],
      manualFollowUp: value.followUp ?? [],
      codegen: descriptor.codegen,
      focusedGates: descriptor.focusedGates,
    },
  };
};
