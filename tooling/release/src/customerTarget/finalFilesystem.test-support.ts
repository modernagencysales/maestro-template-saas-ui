import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
const execFileAsync = promisify(execFile);

export type FinalCustomerTree = {
  readonly root: string;
  readonly files: readonly string[];
};

const forbiddenPaths = [
  /^tooling\/agent-pack\/src\/pluginContract\.ts$/,
  /^tooling\/agent-pack\/src\/mcp\//,
  /(?:^|\/)(?:plugin|mcp)(?:Contract)?[^/]*\.test\.[cm]?[jt]sx?$/i,
  /^tooling\/generators\/src\/index\.ts$/,
  /^tooling\/generators\/src\/(?:index|direct-run)\.test\.ts$/,
  /^tooling\/generators\/src\/blueprints\/saasApplication(?:\.test)?\.ts$/,
  /^tooling\/generators\/src\/blueprints\/saasApplicationFactory\.ts$/,
  /^tooling\/generators\/src\/blueprints\/saasRegistrationProjections\.ts$/,
  /^tooling\/generators\/src\/cli\.ts$/,
  /^tooling\/generators\/src\/customer-closure\.test\.ts$/,
  /^tooling\/generators\/src\/upgrade-wiring\.test\.ts$/,
  /^tooling\/generators\/src\/workflow-files\.test\.ts$/,
  /^tooling\/generators\/src\/workflow-(?:output-smoke|semantic-coverage)\.ts$/,
];

const residue = /(?:pluginContract|\.\/mcp(?:\/|["']))/i;
const generatorImport =
  /(?:from\s+["'][^"']*tooling\/generators\/src\/index|tooling\/generators\/src\/index\.ts)/;
const importSensitivePath =
  /^(?:tooling\/release\/|releases\/|apps\/cli\/src\/factory\/)/;

export function enumerateFinalCustomerTree(root: string): FinalCustomerTree {
  const absolute = realpathSync(root);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const relativePath = relative(absolute, path).split(sep).join("/");
      const stat = lstatSync(path);
      if (stat.isSymbolicLink())
        throw new Error(`final customer symlink: ${relativePath}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(relativePath);
      else throw new Error(`non-regular final customer path: ${relativePath}`);
    }
  };
  visit(absolute);
  return { root: absolute, files: files.sort() };
}

export function assertFinalCustomerFilesystem(tree: FinalCustomerTree): void {
  const forbidden = tree.files.filter((path) =>
    forbiddenPaths.some((rule) => rule.test(path)),
  );
  if (forbidden.length > 0)
    throw new Error(`forbidden final customer files:\n${forbidden.join("\n")}`);

  const residueFiles = tree.files.filter((path) => {
    if (!/\.(?:[cm]?[jt]sx?|json)$/.test(path)) return false;
    const source = readFileSync(resolve(tree.root, path), "utf8");
    return (
      (path.startsWith("apps/cli/src/") && residue.test(source)) ||
      (importSensitivePath.test(path) && generatorImport.test(source))
    );
  });
  if (residueFiles.length > 0)
    throw new Error(
      `forbidden customer source residue:\n${residueFiles.join("\n")}`,
    );

  const barrel = readFileSync(
    resolve(tree.root, "tooling/agent-pack/src/index.ts"),
    "utf8",
  );
  if (/pluginContract|["']\.\/mcp(?:\/|["'])/.test(barrel)) {
    throw new Error(
      "final customer agent-pack barrel exports pluginContract or mcp",
    );
  }

  assertAuthoringInventory(tree);
  assertLocalPackageScripts(tree);
}

function assertAuthoringInventory(tree: FinalCustomerTree): void {
  const required = [
    "tooling/agent-pack/src/index.ts",
    "tooling/generators/src/customer.ts",
    "tooling/generators/src/customer-runtime.ts",
    "tooling/generators/src/customer-dispatcher.ts",
    "tooling/generators/src/customer-cli.ts",
    "tooling/generators/src/direct-run.ts",
    "tooling/generators/src/workflow-files.ts",
    "tooling/generators/src/workflow-predeploy.ts",
    "tooling/generators/src/workflow-release-commands.ts",
    "tooling/generators/src/blueprints/gtmImplementation.ts",
    "tooling/quality/check-workflow-policy-snapshots.mts",
    "tooling/quality/check-workflow-principal-propagation.mts",
    "tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json",
    "packages/convex/package.json",
    "apps/web/package.json",
  ];
  const missing = required.filter((path) => !tree.files.includes(path));
  if (missing.length > 0)
    throw new Error(
      `missing supported customer authoring inventory:\n${missing.join("\n")}`,
    );
  const scripts = packageScripts(resolve(tree.root, "package.json"));
  for (const name of [
    "template:add-feature",
    "template:add-capability",
    "template:add-workflow",
    "check:workflow-policy-snapshots",
    "check:workflow-principal-propagation",
  ]) {
    if (!scripts[name])
      throw new Error(`missing supported customer script: ${name}`);
  }
}

function assertLocalPackageScripts(tree: FinalCustomerTree): void {
  for (const packagePath of tree.files.filter(
    (path) => path === "package.json" || path.endsWith("/package.json"),
  )) {
    const scripts = packageScripts(resolve(tree.root, packagePath));
    for (const [name, command] of Object.entries(scripts)) {
      for (const match of command.matchAll(
        /(?:^|\s)(?:tsx|node)\s+([^\s;&|]+)/g,
      )) {
        const entry = match[1];
        if (
          entry &&
          !entry.startsWith("-") &&
          !existsSync(resolve(tree.root, dirname(packagePath), entry))
        )
          throw new Error(
            `${packagePath} script ${name} has missing entrypoint: ${entry}`,
          );
      }
      for (const match of command.matchAll(/pnpm\s+--dir\s+([^\s;&|]+)/g)) {
        const target = match[1];
        if (
          target &&
          !existsSync(
            resolve(tree.root, dirname(packagePath), target, "package.json"),
          )
        )
          throw new Error(
            `${packagePath} script ${name} has missing pnpm --dir target: ${target}`,
          );
      }
    }
  }
}

function packageScripts(path: string): Readonly<Record<string, string>> {
  const value = JSON.parse(readFileSync(path, "utf8")) as {
    scripts?: Record<string, unknown>;
  };
  return Object.fromEntries(
    Object.entries(value.scripts ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export async function runFinalCustomerCompileGates(
  root: string,
): Promise<void> {
  const env = {
    ...process.env,
    CI: "1",
    CONVEX_DEPLOYMENT: "",
    CONVEX_URL: "",
  };
  await execFileAsync(
    "pnpm",
    ["install", "--frozen-lockfile", "--ignore-scripts"],
    { cwd: root, env, maxBuffer: 10 * 1024 * 1024 },
  );
  for (const [command, args] of [
    ["pnpm", ["--dir", "apps/cli", "typecheck"]],
    ["pnpm", ["--dir", "tooling/generators", "typecheck"]],
    ["pnpm", ["check:workflow-policy-snapshots"]],
    ["pnpm", ["check:workflow-principal-propagation"]],
    ["pnpm", ["--dir", "packages/convex", "typecheck"]],
    ["pnpm", ["--dir", "apps/web", "typecheck"]],
    ["pnpm", ["--dir", "apps/web", "build"]],
  ] as const) {
    await execFileAsync(command, args, {
      cwd: root,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });
  }
}

export function assertNoPathEscape(
  root: string,
  files: readonly string[],
): void {
  const absolute = realpathSync(root);
  for (const file of files) {
    const path = realpathSync(resolve(absolute, file));
    const child = relative(absolute, path);
    if (child === ".." || child.startsWith(`..${sep}`))
      throw new Error(`final customer path escaped target: ${file}`);
  }
}
