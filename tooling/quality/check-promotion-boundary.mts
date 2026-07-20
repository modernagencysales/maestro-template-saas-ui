import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSystemCatalog } from "@maestro-template/template-core/systemCatalog";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export type PromotionBoundaryFile = {
  readonly path: string;
  readonly content: string;
};

export type PromotionBoundaryFinding = {
  readonly subject: string;
  readonly issue: string;
};

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const walkFiles = (root: string, directory: string): readonly string[] => {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walkFiles(root, path) : [path];
  });
};

const readBoundaryFiles = (root: string): readonly PromotionBoundaryFile[] =>
  ["apps", "packages", "experiments", "private-packages"]
    .flatMap((directory) => walkFiles(root, directory))
    .filter(
      (path) => SOURCE_EXTENSIONS.has(extname(path)) || path.endsWith(".json"),
    )
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

const importedSpecifiers = (source: string): readonly string[] => {
  const matches = [
    ...source.matchAll(/\b(?:from|import)\s*["']([^"']+)["']/g),
    ...source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']/g),
  ];
  return matches.flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
};

const sandboxRegistrations = [
  {
    label: "durable schema",
    pattern: /\b(?:defineSchema|defineTable)\s*\(/,
  },
  { label: "production route", pattern: /\bcreateFileRoute\s*\(/ },
  {
    label: "headless operation",
    pattern: /\b(?:registerHeadlessOperation|headlessRegistry\s*\.)/,
  },
  {
    label: "production job",
    pattern:
      /\b(?:cronJobs|crons\s*\.\s*(?:interval|cron|hourly|daily|weekly|monthly))\b/,
  },
  {
    label: "provider",
    pattern: /\b(?:registerProvider|providerRegistry\s*\.)/,
  },
] as const;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (
  file: PromotionBoundaryFile,
  findings: PromotionBoundaryFinding[],
): UnknownRecord | undefined => {
  try {
    const value = JSON.parse(file.content) as unknown;
    if (!isRecord(value)) throw new Error("must contain an object");
    return value;
  } catch (error: unknown) {
    findings.push({
      subject: file.path,
      issue: `invalid JSON contract: ${error instanceof Error ? error.message : String(error)}`,
    });
    return undefined;
  }
};

const experimentDirectories = (
  files: readonly PromotionBoundaryFile[],
): readonly string[] => [
  ...new Set(
    files.flatMap(({ path }) => {
      const match = /^experiments\/([^/]+)\/([^/]+)\//.exec(path);
      return match === null ? [] : [`experiments/${match[1]}/${match[2]}`];
    }),
  ),
];

const privatePackageDirectories = (
  files: readonly PromotionBoundaryFile[],
): readonly string[] => [
  ...new Set(
    files.flatMap(({ path }) => {
      const match = /^private-packages\/([^/]+)\//.exec(path);
      return match === null ? [] : [`private-packages/${match[1]}`];
    }),
  ),
];

const validateOwnershipContract = (
  file: PromotionBoundaryFile,
  contract: UnknownRecord,
  expectedSystem: string | undefined,
  activeSystems: ReadonlySet<string> | undefined,
  findings: PromotionBoundaryFinding[],
): void => {
  const system = contract.system;
  if (typeof system !== "string" || system.length === 0) {
    findings.push({
      subject: file.path,
      issue: "system must be nonempty text",
    });
  } else {
    if (expectedSystem !== undefined && system !== expectedSystem) {
      findings.push({
        subject: file.path,
        issue: `system ${system} must match its directory ${expectedSystem}`,
      });
    }
    if (activeSystems !== undefined && !activeSystems.has(system)) {
      findings.push({
        subject: file.path,
        issue: `system must name an active canonical system: ${system}`,
      });
    }
  }
  if (contract.disposition !== "reuse" && contract.disposition !== "extend") {
    findings.push({
      subject: file.path,
      issue: "disposition must be reuse or extend",
    });
  }
  if (contract.productionRegistrations !== false) {
    findings.push({
      subject: file.path,
      issue: "productionRegistrations must be false before promotion",
    });
  }
};

export const validatePromotionBoundary = (
  files: readonly PromotionBoundaryFile[],
  activeSystems?: ReadonlySet<string>,
): readonly PromotionBoundaryFinding[] => {
  const findings: PromotionBoundaryFinding[] = [];
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  for (const file of files) {
    if (
      /^(?:apps|packages)\//.test(file.path) &&
      SOURCE_EXTENSIONS.has(extname(file.path))
    ) {
      for (const specifier of importedSpecifiers(file.content)) {
        for (const boundary of ["experiments", "private-packages"] as const) {
          if (specifier.includes(boundary)) {
            findings.push({
              subject: file.path,
              issue: `production code cannot import ${boundary}: ${specifier}`,
            });
          }
        }
      }
    }

    if (
      /^(?:experiments|private-packages)\//.test(file.path) &&
      SOURCE_EXTENSIONS.has(extname(file.path))
    ) {
      for (const registration of sandboxRegistrations) {
        if (registration.pattern.test(file.content)) {
          findings.push({
            subject: file.path,
            issue: `sandbox code cannot register a ${registration.label}; promote it through a template generator`,
          });
        }
      }
    }
  }

  for (const directory of experimentDirectories(files)) {
    const path = `${directory}/experiment.json`;
    const file = filesByPath.get(path);
    if (file === undefined) {
      findings.push({ subject: directory, issue: "missing experiment.json" });
      continue;
    }
    const contract = parseJson(file, findings);
    if (contract === undefined) continue;
    const expectedSystem = directory.split("/")[1];
    if (contract.schemaVersion !== 1) {
      findings.push({ subject: path, issue: "schemaVersion must be 1" });
    }
    if (typeof contract.id !== "string" || contract.id.length === 0) {
      findings.push({ subject: path, issue: "id must be nonempty text" });
    }
    if (
      typeof contract.hypothesis !== "string" ||
      contract.hypothesis.length === 0
    ) {
      findings.push({
        subject: path,
        issue: "hypothesis must be nonempty text",
      });
    }
    if (
      typeof contract.promotionCommand !== "string" ||
      !contract.promotionCommand.includes("--system") ||
      !contract.promotionCommand.includes("--disposition")
    ) {
      findings.push({
        subject: path,
        issue:
          "promotionCommand must use a template generator with --system and --disposition",
      });
    }
    validateOwnershipContract(
      file,
      contract,
      expectedSystem,
      activeSystems,
      findings,
    );
  }

  for (const directory of privatePackageDirectories(files)) {
    const path = `${directory}/package-plan.json`;
    const file = filesByPath.get(path);
    if (file === undefined) {
      findings.push({ subject: directory, issue: "missing package-plan.json" });
      continue;
    }
    const contract = parseJson(file, findings);
    if (contract !== undefined) {
      validateOwnershipContract(
        file,
        contract,
        undefined,
        activeSystems,
        findings,
      );
    }
  }

  return findings;
};

export const checkPromotionBoundary = (
  root = ROOT,
): readonly PromotionBoundaryFinding[] => {
  const catalog = parseSystemCatalog(
    JSON.parse(
      readFileSync(join(root, "docs/template/system-catalog.json"), "utf8"),
    ) as unknown,
  );
  const activeSystems = new Set(
    catalog.systems
      .filter(({ lifecycle }) => lifecycle === "active")
      .map(({ id }) => id),
  );
  return validatePromotionBoundary(readBoundaryFiles(root), activeSystems);
};

const main = (): void => {
  try {
    const findings = checkPromotionBoundary();
    if (findings.length > 0) {
      console.error("x promotion boundary invalid:");
      for (const finding of findings) {
        console.error(`  - ${finding.subject}: ${finding.issue}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log(
      "ok promotion boundary - sandbox freely, promote through canonical generators",
    );
  } catch (error: unknown) {
    console.error(
      `x promotion boundary invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
