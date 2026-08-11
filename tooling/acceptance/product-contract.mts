import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  type ProductBehavior,
  type ProductContract,
  renderProductContractJsonSchema,
  validateProductContract,
} from "../../packages/template-core/src/productContract";
import {
  type ProductPlanFrontmatter,
  validateProductPlanFrontmatter,
  validateProductPlanBindings,
} from "../../packages/template-core/src/productPlan";
import {
  composeAppMap,
  resolveRepositoryRevision,
} from "../app-map/src/composition";

export type LoadedProductPlan = {
  readonly path: string;
  readonly frontmatter: ProductPlanFrontmatter;
};

export type AcceptanceTestIdentity = {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly behaviorTag: string;
};

const contractPath = "product.contract.yaml";
const schemaPath = "product.contract.schema.json";
const generatedPath = "docs/template/generated/product-contract.md";
const behaviorTag = /^@(?<id>BHV-[A-Z0-9]+-[0-9]+)-R(?<revision>[1-9][0-9]*)$/u;

const bytewise = (left: string, right: string): number => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (
    let index = 0;
    index < Math.min(leftBytes.length, rightBytes.length);
    index++
  ) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
};

const sorted = (values: readonly string[]): readonly string[] =>
  [...values].sort(bytewise);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => bytewise(left, right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
};

const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalize(value));

const decodePlan = (
  value: unknown,
  sourcePath: string,
): ProductPlanFrontmatter => {
  try {
    return validateProductPlanFrontmatter(value);
  } catch (error) {
    throw new Error(
      `${sourcePath}: invalid product plan frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const parsePlanFrontmatter = (
  markdown: string,
  sourcePath: string,
): ProductPlanFrontmatter | undefined => {
  const match =
    /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u.exec(
      markdown,
    );
  if (!match) return undefined;
  let value: unknown;
  try {
    value = parseYaml(match[1] ?? "");
  } catch (error) {
    throw new Error(
      `${sourcePath}: invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    value === null ||
    typeof value !== "object" ||
    !("planSchemaVersion" in value)
  )
    return undefined;
  return decodePlan(value, sourcePath);
};

const safeBranch = (branch: string): boolean =>
  /^[A-Za-z0-9._/-]+$/u.test(branch) &&
  !branch.startsWith("-") &&
  !branch.includes("..") &&
  !branch.includes("//") &&
  !branch.endsWith("/") &&
  !branch.endsWith(".lock");

export const deriveTrustedMergeBase = (
  readGit: (args: readonly string[]) => string,
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const branch = environment.CI_COMMIT_TARGET_BRANCH?.trim() || "main";
  if (!safeBranch(branch))
    throw new Error(`Invalid canonical CI comparison branch: ${branch}`);
  let trustedRef: string | undefined;
  for (const candidate of [
    `refs/remotes/origin/${branch}`,
    `refs/heads/${branch}`,
  ]) {
    try {
      const resolved = readGit([
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${candidate}^{commit}`,
      ]);
      if (/^[a-f0-9]{40,64}$/u.test(resolved)) {
        trustedRef = candidate;
        break;
      }
    } catch {
      // Try the canonical local namespace after the CI remote namespace.
    }
  }
  if (!trustedRef)
    throw new Error(`Canonical CI comparison ref does not exist: ${branch}`);
  const mergeBase = readGit(["merge-base", "HEAD", trustedRef]);
  if (!/^[a-f0-9]{40,64}$/u.test(mergeBase))
    throw new Error("Git did not return a valid actual merge base");
  return mergeBase;
};

const behaviorSemantic = (behavior: ProductBehavior): unknown => ({
  actor: behavior.actor,
  surfaces: behavior.surfaces,
  preconditions: behavior.preconditions,
  action: behavior.action,
  outcomes: behavior.outcomes,
});

const behaviorKey = (behavior: ProductBehavior): string => behavior.id;

const revisionFindings = (
  previous: ProductBehavior,
  next: ProductBehavior,
): readonly string[] =>
  next.revision < previous.revision
    ? [
        `behavior ${previous.id} revision decreased from ${previous.revision} to ${next.revision}`,
      ]
    : [];

const lifecycleFindings = (
  previous: ProductBehavior,
  next: ProductBehavior,
): readonly string[] => {
  const valid =
    previous.status === next.status ||
    (previous.status === "draft" &&
      (next.status === "required" || next.status === "retired")) ||
    (previous.status === "required" && next.status === "retired");
  return valid
    ? []
    : [
        `invalid lifecycle transition for ${previous.id}: ${previous.status} -> ${next.status}`,
      ];
};

const semanticFindings = (
  previous: ProductBehavior,
  next: ProductBehavior,
): readonly string[] => {
  const semanticEdit =
    canonicalJson(behaviorSemantic(previous)) !==
    canonicalJson(behaviorSemantic(next));
  return semanticEdit && next.revision <= previous.revision
    ? [`behavior ${previous.id} semantic edit requires a greater revision`]
    : [];
};

const compareBehaviorHistory = (
  previous: ProductBehavior,
  next: ProductBehavior | undefined,
): readonly string[] => {
  if (!next)
    return [`behavior ${previous.id} deleted or missing from current contract`];
  const findings = [...revisionFindings(previous, next)];
  if (previous.status === "retired") {
    if (canonicalJson(previous) !== canonicalJson(next))
      findings.push(`retired behavior ${previous.id} is immutable`);
    return findings;
  }
  findings.push(...lifecycleFindings(previous, next));
  findings.push(...semanticFindings(previous, next));
  return findings;
};

export const compareProductContractHistory = (
  trusted: ProductContract | null,
  current: ProductContract,
): readonly string[] => {
  if (!trusted) return [];
  const findings: string[] = [];
  const currentById = new Map<string, ProductBehavior>(
    current.behaviors.map((item) => [behaviorKey(item), item]),
  );
  for (const previous of trusted.behaviors)
    findings.push(
      ...compareBehaviorHistory(previous, currentById.get(previous.id)),
    );
  return findings;
};

const inspectAcceptanceTest = (
  test: AcceptanceTestIdentity,
  known: ReadonlyMap<string, ProductBehavior>,
  counts: Map<string, number>,
): readonly string[] => {
  const match = behaviorTag.exec(test.behaviorTag);
  if (!match?.groups)
    return [`${test.file}: invalid behavior tag ${test.behaviorTag}`];
  const id = match.groups.id as string;
  const revision = Number(match.groups.revision);
  const behavior = known.get(id);
  if (!behavior) return [`${test.file}: unknown behavior ${id}`];
  counts.set(id, (counts.get(id) ?? 0) + 1);
  return revision === behavior.revision
    ? []
    : [
        `${id} has stale revision R${revision}; current revision is R${behavior.revision}`,
      ];
};

export const validateAcceptanceDiscovery = (input: {
  readonly contract: ProductContract;
  readonly tests: readonly AcceptanceTestIdentity[];
}): readonly string[] => {
  const findings: string[] = [];
  const counts = new Map<string, number>();
  const known = new Map<string, ProductBehavior>(
    input.contract.behaviors.map((item) => [item.id, item]),
  );
  for (const test of input.tests)
    findings.push(...inspectAcceptanceTest(test, known, counts));
  for (const behavior of input.contract.behaviors) {
    if (behavior.status === "retired") continue;
    const count = counts.get(behavior.id) ?? 0;
    if (count === 0)
      findings.push(
        `${behavior.id} must have at least one acceptance test, found none`,
      );
  }
  return findings;
};

const repoPath = (repoRoot: string, sourceRoot: string, path: string): string =>
  resolve(repoRoot, sourceRoot, path);

const boundedSourceRoot = (repoRoot: string, sourceRoot: string): string => {
  if (sourceRoot.startsWith("/"))
    throw new Error("source-root must be relative");
  const root = resolve(repoRoot);
  const target = resolve(root, sourceRoot);
  const prefix = `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix))
    throw new Error("source-root must remain beneath the repository root");
  return target;
};

const gitReader =
  (repoRoot: string) =>
  (args: readonly string[]): string =>
    execFileSync("git", [...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

const loadContract = (sourceRoot: string): ProductContract => {
  try {
    return validateProductContract(
      parseYaml(requireFile(sourceRoot, contractPath)),
    );
  } catch (error) {
    throw new Error(
      `${contractPath}: invalid product contract: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const requireFile = (sourceRoot: string, path: string): string => {
  const absolute = repoPath(sourceRoot, ".", path);
  if (!existsSync(absolute)) throw new Error(`${path} is missing`);
  return readFileSync(absolute, "utf8");
};

const markdownFiles = async (directory: string): Promise<readonly string[]> => {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(path);
      return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
    }),
  );
  return files.flat().sort(bytewise);
};

const loadPlans = async (
  repoRoot: string,
  sourceRoot: string,
): Promise<readonly LoadedProductPlan[]> => {
  const root = repoPath(repoRoot, sourceRoot, "docs");
  const files = await markdownFiles(root);
  const generatedPrefix = `${resolve(root, "template", "generated")}${sep}`;
  const plans: LoadedProductPlan[] = [];
  for (const absolute of files) {
    if (absolute.startsWith(generatedPrefix)) continue;
    const path = relative(resolve(repoRoot, sourceRoot), absolute)
      .split(sep)
      .join("/");
    const frontmatter = parsePlanFrontmatter(
      await readFile(absolute, "utf8"),
      path,
    );
    if (frontmatter) plans.push({ path, frontmatter });
  }
  return plans.sort((left, right) => bytewise(left.path, right.path));
};

const schemaProjection = (): string => {
  return renderProductContractJsonSchema();
};

type DocumentationLink = {
  readonly planPaths: readonly string[];
  readonly appMapTargets: readonly string[];
  readonly acceptancePaths: readonly string[];
};

const renderProjection = (
  contract: ProductContract,
  links: ReadonlyMap<string, DocumentationLink>,
): string => {
  const format = (values: readonly string[]): string =>
    sorted(values)
      .map((value) => `\`${value}\``)
      .join(", ") || "—";
  const sections = [...contract.behaviors]
    .sort((left, right) => bytewise(left.id, right.id))
    .map((behavior) => {
      const link = links.get(behavior.id) ?? {
        planPaths: [],
        appMapTargets: [],
        acceptancePaths: [],
      };
      return [
        `## ${behavior.id} — ${behavior.title}`,
        "",
        "| Field | Value |",
        "| --- | --- |",
        `| Revision | ${behavior.revision} |`,
        `| Lifecycle | ${behavior.status} |`,
        `| Surfaces | ${format(behavior.surfaces)} |`,
        `| Typed plan paths | ${format(link.planPaths)} |`,
        `| App Map targets | ${format(link.appMapTargets)} |`,
        `| Acceptance file paths | ${format(link.acceptancePaths)} |`,
        "",
      ].join("\n");
    });
  return ["# Product Contract", "", ...sections].join("\n");
};

const projectionLinks = (
  contract: ProductContract,
  plans: readonly LoadedProductPlan[],
): ReadonlyMap<string, DocumentationLink> => {
  const links = new Map<
    string,
    { planPaths: Set<string>; appMapTargets: Set<string> }
  >();
  for (const behavior of contract.behaviors)
    links.set(behavior.id, { planPaths: new Set(), appMapTargets: new Set() });
  for (const plan of plans) {
    for (const workPackage of plan.frontmatter.workPackages) {
      for (const id of workPackage.behaviorIds) {
        const link = links.get(id);
        if (!link) continue;
        link.planPaths.add(plan.path);
        for (const target of workPackage.appMapTargets)
          link.appMapTargets.add(target);
      }
    }
  }
  return new Map(
    [...links.entries()].map(([id, link]) => [
      id,
      {
        planPaths: sorted([...link.planPaths]),
        appMapTargets: sorted([...link.appMapTargets]),
        acceptancePaths: [],
      },
    ]),
  );
};

export const generateProductContract = async (options: {
  readonly repoRoot: string;
  readonly sourceRoot: string;
}): Promise<void> => {
  const sourceRoot = boundedSourceRoot(options.repoRoot, options.sourceRoot);
  const contract = loadContract(sourceRoot);
  const plans = await loadPlans(options.repoRoot, options.sourceRoot);
  const findings = validateProductPlanBindings({
    contract,
    plans: plans.map(({ frontmatter }) => frontmatter),
  });
  if (findings.length > 0) throw new Error(findings.join("\n"));
  const links = projectionLinks(contract, plans);
  await mkdir(dirname(repoPath(sourceRoot, ".", generatedPath)), {
    recursive: true,
  });
  await writeFile(repoPath(sourceRoot, ".", schemaPath), schemaProjection());
  await writeFile(
    repoPath(sourceRoot, ".", generatedPath),
    renderProjection(contract, links),
  );
};

const readTrustedContract = (
  readGit: (args: readonly string[]) => string,
  mergeBase: string,
  allowFirstContract: boolean,
): {
  readonly contract: ProductContract | null;
  readonly findings: readonly string[];
} => {
  const listing = readGit([
    "ls-tree",
    "--name-only",
    mergeBase,
    "--",
    contractPath,
  ]);
  if (listing === "") {
    const history = readGit([
      "log",
      "--format=%H",
      mergeBase,
      "--",
      contractPath,
    ]);
    if (history !== "")
      return {
        contract: null,
        findings: ["trusted contract is missing but existed in target history"],
      };
    if (!allowFirstContract)
      return {
        contract: null,
        findings: ["trusted base has no product contract"],
      };
    return { contract: null, findings: [] };
  }
  if (listing !== contractPath)
    return {
      contract: null,
      findings: ["trusted contract lookup returned an unexpected path"],
    };
  try {
    return {
      contract: validateProductContract(
        parseYaml(readGit(["show", `${mergeBase}:${contractPath}`])),
      ),
      findings: [],
    };
  } catch (error) {
    return {
      contract: null,
      findings: [
        `trusted product contract is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};

type ContractCheckOptions = {
  readonly repoRoot: string;
  readonly sourceRoot: string;
  readonly allowFirstContract: boolean;
  readonly resolveAppMapNodeIds?: () => Promise<ReadonlySet<string>>;
};

const loadTrustedHistory = (
  options: ContractCheckOptions,
): {
  readonly trusted: ProductContract | null;
  readonly findings: readonly string[];
} => {
  const readGit = gitReader(options.repoRoot);
  try {
    const mergeBase = deriveTrustedMergeBase(readGit, process.env);
    const loaded = readTrustedContract(
      readGit,
      mergeBase,
      options.allowFirstContract,
    );
    return { trusted: loaded.contract, findings: loaded.findings };
  } catch (error) {
    return {
      trusted: null,
      findings: [error instanceof Error ? error.message : String(error)],
    };
  }
};

const resolveCurrentAppMapNodes = async (
  options: ContractCheckOptions,
): Promise<{
  readonly nodeIds: ReadonlySet<string>;
  readonly findings: readonly string[];
}> => {
  try {
    if (options.resolveAppMapNodeIds)
      return { nodeIds: await options.resolveAppMapNodeIds(), findings: [] };
    const revision = await resolveRepositoryRevision(options.repoRoot);
    const composed = await composeAppMap({
      repoRoot: options.repoRoot,
      revision,
    });
    if ("message" in composed) throw new Error(composed.message);
    return {
      nodeIds: new Set(composed.build.map.nodes.map(({ id }) => id)),
      findings: [],
    };
  } catch (error) {
    return {
      nodeIds: new Set(),
      findings: [
        `App Map resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};

const validatePlanTargets = (
  contract: ProductContract,
  plans: readonly LoadedProductPlan[],
  nodeIds: ReadonlySet<string>,
): readonly string[] => {
  const findings: string[] = [];
  const packages = plans.flatMap(({ frontmatter }) => frontmatter.workPackages);
  for (const behavior of contract.behaviors) {
    const owning = packages.filter(({ behaviorIds }) =>
      behaviorIds.includes(behavior.id),
    );
    if (behavior.status === "required" && owning.length === 0)
      findings.push(
        `required behavior ${behavior.id} has no typed plan mapping`,
      );
    const targets = owning.flatMap(({ appMapTargets }) => appMapTargets);
    for (const target of sorted([...new Set(targets)])) {
      if (nodeIds.has(target)) continue;
      const templateGap = owning.some(
        ({ behaviorIds, work }) =>
          behaviorIds.includes(behavior.id) && work.kind === "template-gap",
      );
      if (behavior.status !== "draft" || !templateGap)
        findings.push(
          `${behavior.id} App Map target ${target} does not resolve`,
        );
    }
  }
  return findings;
};

const generatedProjectionFindings = async (
  sourceRoot: string,
  contract: ProductContract,
  plans: readonly LoadedProductPlan[],
): Promise<readonly string[]> => {
  const links = projectionLinks(contract, plans);
  const findings: string[] = [];
  for (const [path, expected] of [
    [schemaPath, schemaProjection()],
    [generatedPath, renderProjection(contract, links)],
  ] as const) {
    const absolute = repoPath(sourceRoot, ".", path);
    if (!existsSync(absolute)) findings.push(`${path} is missing`);
    else if ((await readFile(absolute, "utf8")) !== expected)
      findings.push(`${path} is stale`);
  }
  return findings;
};

export const checkProductContract = async (
  options: ContractCheckOptions,
): Promise<readonly string[]> => {
  if (options.sourceRoot !== ".")
    return ["direct product-contract checking requires --source-root ."];
  const sourceRoot = boundedSourceRoot(options.repoRoot, options.sourceRoot);
  const findings: string[] = [];
  let current: ProductContract;
  try {
    current = loadContract(sourceRoot);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const history = loadTrustedHistory(options);
  findings.push(
    ...history.findings,
    ...compareProductContractHistory(history.trusted, current),
  );
  let plans: readonly LoadedProductPlan[] = [];
  try {
    plans = await loadPlans(options.repoRoot, options.sourceRoot);
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  try {
    findings.push(
      ...validateProductPlanBindings({
        contract: current,
        plans: plans.map(({ frontmatter }) => frontmatter),
      }),
    );
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  const appMap = await resolveCurrentAppMapNodes(options);
  findings.push(
    ...appMap.findings,
    ...validatePlanTargets(current, plans, appMap.nodeIds),
  );
  findings.push(
    ...(await generatedProjectionFindings(sourceRoot, current, plans)),
  );
  return findings;
};

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const main = async (): Promise<void> => {
  const mode = process.argv[2];
  const sourceRoot = argument("--source-root");
  if (
    (mode !== "generate" && mode !== "check") ||
    sourceRoot === undefined ||
    (mode === "check" && sourceRoot !== ".")
  ) {
    throw new Error(
      "Usage: product-contract generate --source-root <relative-path> | check --source-root . [--allow-first-contract]",
    );
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  if (mode === "generate") {
    await generateProductContract({ repoRoot, sourceRoot });
    return;
  }
  const findings = await checkProductContract({
    repoRoot,
    sourceRoot,
    allowFirstContract: process.argv.includes("--allow-first-contract"),
  });
  if (findings.length > 0) throw new Error(findings.join("\n"));
};

if (process.argv[1]?.endsWith("product-contract.mts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
