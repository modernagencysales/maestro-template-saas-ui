import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  renderProductContractMarkdown,
  type ProductBehavior,
  type ProductContract,
  type ProductBehaviorDocumentation,
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
import {
  parsePlaywrightJsonReport,
  validateAcceptanceReportBoundary,
  validateNativeAcceptanceReportBoundary,
  type ParsedPlaywrightJsonReport,
} from "./playwright-report.mts";
import {
  assertCheckoutState,
  snapshotCheckoutState,
} from "./checkout-state.mts";

export type LoadedProductPlan = {
  readonly path: string;
  readonly frontmatter: ProductPlanFrontmatter;
};

export type AcceptanceTestIdentity = Pick<
  ParsedPlaywrightJsonReport["tests"][number],
  "id" | "file" | "title" | "behaviorTag" | "expectedStatus" | "annotations"
>;

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
  const hasLeadingOpener = /^(?:\uFEFF)?---[ \t]*(?:\r?\n|$)/u.test(markdown);
  if (!match && hasLeadingOpener)
    throw new Error(`${sourcePath}: frontmatter has no closing delimiter`);
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
): { readonly targetCommit: string; readonly mergeBase: string } => {
  const branch = environment.CI_COMMIT_TARGET_BRANCH?.trim() || "main";
  if (!safeBranch(branch))
    throw new Error(`Invalid canonical CI comparison branch: ${branch}`);
  let trustedRef: string | undefined;
  let targetCommit: string | undefined;
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
        targetCommit = resolved;
        break;
      }
    } catch {
      // Try the canonical local namespace after the CI remote namespace.
    }
  }
  if (!trustedRef || !targetCommit)
    throw new Error(`Canonical CI comparison ref does not exist: ${branch}`);
  const mergeBase = readGit(["merge-base", "HEAD", targetCommit]);
  if (!/^[a-f0-9]{40,64}$/u.test(mergeBase))
    throw new Error("Git did not return a valid actual merge base");
  return { targetCommit, mergeBase };
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
  const findings: string[] = [];
  if (test.expectedStatus !== "passed")
    findings.push(
      `${test.file}: acceptance test expected status must be passed`,
    );
  for (const annotation of test.annotations)
    if (["skip", "fixme", "fail"].includes(annotation.type))
      findings.push(
        `${test.file}: acceptance test cannot use ${annotation.type} annotation`,
      );
  const match = behaviorTag.exec(test.behaviorTag);
  if (!match?.groups)
    return [
      ...findings,
      `${test.file}: invalid behavior tag ${test.behaviorTag}`,
    ];
  const id = match.groups.id as string;
  const revision = Number(match.groups.revision);
  const behavior = known.get(id);
  if (!behavior) return [...findings, `${test.file}: unknown behavior ${id}`];
  if (behavior.status === "retired")
    return [
      ...findings,
      `${test.file}: retired behavior ${id} cannot have acceptance coverage`,
    ];
  counts.set(id, (counts.get(id) ?? 0) + 1);
  if (revision !== behavior.revision)
    findings.push(
      `${id} has stale revision R${revision}; current revision is R${behavior.revision}`,
    );
  return findings;
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
    if (behavior.status !== "required") continue;
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

type MutableDocumentationLink = {
  readonly planPaths: Set<string>;
  readonly appMapTargets: Set<string>;
  readonly acceptancePaths: Set<string>;
};

const initialLinks = (
  contract: ProductContract,
): Map<string, MutableDocumentationLink> =>
  new Map(
    contract.behaviors.map((behavior) => [
      behavior.id,
      {
        planPaths: new Set<string>(),
        appMapTargets: new Set<string>(),
        acceptancePaths: new Set<string>(),
      },
    ]),
  );

const addPlanLinks = (
  links: Map<string, MutableDocumentationLink>,
  plans: readonly LoadedProductPlan[],
): void => {
  for (const plan of plans)
    for (const workPackage of plan.frontmatter.workPackages)
      for (const id of workPackage.behaviorIds) {
        const link = links.get(id);
        if (!link) continue;
        link.planPaths.add(plan.path);
        for (const target of workPackage.appMapTargets)
          link.appMapTargets.add(target);
      }
};

const addAcceptanceLinks = (
  links: Map<string, MutableDocumentationLink>,
  tests: readonly AcceptanceTestIdentity[],
): void => {
  for (const test of tests) {
    const id = behaviorTag.exec(test.behaviorTag)?.groups?.id;
    const link = id === undefined ? undefined : links.get(id);
    if (link) link.acceptancePaths.add(test.file);
  }
};

const projectionLinks = (
  contract: ProductContract,
  plans: readonly LoadedProductPlan[],
  tests: readonly AcceptanceTestIdentity[],
): readonly ProductBehaviorDocumentation[] => {
  const links = initialLinks(contract);
  addPlanLinks(links, plans);
  addAcceptanceLinks(links, tests);
  return [...links.entries()].map(([behaviorId, link]) => ({
    behaviorId,
    planPaths: sorted([...link.planPaths]),
    appMapTargets: sorted([...link.appMapTargets]),
    acceptancePaths: sorted([...link.acceptancePaths]),
  }));
};

const readNativePlaywrightListing = (
  repoRoot: string,
  sourceRoot: string,
): ParsedPlaywrightJsonReport => {
  const initialCheckoutState = snapshotCheckoutState(sourceRoot);
  try {
    const configPath = repoPath(
      repoRoot,
      sourceRoot,
      "playwright.acceptance.config.ts",
    );
    const output = execFileSync(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "--config",
        configPath,
        "--list",
        "--pass-with-no-tests",
        "--reporter=json",
      ],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    const report = parsePlaywrightJsonReport(JSON.parse(output) as unknown);
    validateNativeAcceptanceReportBoundary({ sourceRoot, report });
    return report;
  } finally {
    assertCheckoutState(
      initialCheckoutState,
      "Product contract checkout/source mutation during discovery",
    );
  }
};

type DiscoveryOptions = {
  readonly readAcceptanceReport?: () => Promise<ParsedPlaywrightJsonReport>;
};

const loadAcceptanceDiscovery = async (
  repoRoot: string,
  sourceRoot: string,
  options: DiscoveryOptions,
): Promise<ParsedPlaywrightJsonReport> =>
  options.readAcceptanceReport
    ? options.readAcceptanceReport()
    : readNativePlaywrightListing(repoRoot, sourceRoot);

export const generateProductContract = async (options: {
  readonly repoRoot: string;
  readonly sourceRoot: string;
  readonly readAcceptanceReport?: () => Promise<ParsedPlaywrightJsonReport>;
}): Promise<void> => {
  const sourceRoot = boundedSourceRoot(options.repoRoot, options.sourceRoot);
  const contract = loadContract(sourceRoot);
  const plans = await loadPlans(options.repoRoot, options.sourceRoot);
  const report = await loadAcceptanceDiscovery(
    options.repoRoot,
    sourceRoot,
    options,
  );
  validateAcceptanceReportBoundary({ sourceRoot, report });
  const discoveryFindings = validateAcceptanceDiscovery({
    contract,
    tests: report.tests,
  });
  if (discoveryFindings.length > 0)
    throw new Error(discoveryFindings.join("\n"));
  const findings = validateProductPlanBindings({
    contract,
    plans: plans.map(({ frontmatter }) => frontmatter),
  });
  if (findings.length > 0) throw new Error(findings.join("\n"));
  const links = projectionLinks(contract, plans, report.tests);
  await mkdir(dirname(repoPath(sourceRoot, ".", generatedPath)), {
    recursive: true,
  });
  await writeFile(repoPath(sourceRoot, ".", schemaPath), schemaProjection());
  await writeFile(
    repoPath(sourceRoot, ".", generatedPath),
    renderProductContractMarkdown({ contract, links }),
  );
};

const readFirstContractFeatureHistory = (
  readGit: (args: readonly string[]) => string,
  mergeBase: string,
  contractRelativePath: string,
): {
  readonly contracts: readonly ProductContract[];
  readonly findings: readonly string[];
} => {
  const featureHistory = readGit([
    "log",
    "--format=%H",
    "--reverse",
    `${mergeBase}..HEAD`,
    "--",
    contractRelativePath,
  ]);
  try {
    const contracts = featureHistory
      .split("\n")
      .filter(Boolean)
      .map((commit) =>
        validateProductContract(
          parseYaml(readGit(["show", `${commit}:${contractRelativePath}`])),
        ),
      );
    const deleted = readGit([
      "log",
      "--format=%H",
      "--diff-filter=D",
      `${mergeBase}..HEAD`,
      "--",
      contractRelativePath,
    ]);
    return {
      contracts,
      findings:
        deleted === ""
          ? []
          : ["product contract was deleted in first-contract feature history"],
    };
  } catch (error) {
    return {
      contracts: [],
      findings: [
        `first-contract feature history is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};

const readTrustedContract = (
  readGit: (args: readonly string[]) => string,
  mergeBase: string,
  targetCommit: string,
  allowFirstContract: boolean,
  contractRelativePath: string,
): {
  readonly contracts: readonly ProductContract[];
  readonly findings: readonly string[];
} => {
  const listing = readGit([
    "ls-tree",
    "--name-only",
    mergeBase,
    "--",
    contractRelativePath,
  ]);
  if (listing === "") {
    if (
      allowFirstContract &&
      readGit(["rev-parse", "--is-shallow-repository"]) === "true"
    )
      return {
        contracts: [],
        findings: [
          "shallow Git history cannot bootstrap the first product contract",
        ],
      };
    const targetHistory = readGit([
      "log",
      "--format=%H",
      targetCommit,
      "--",
      contractRelativePath,
    ]);
    if (targetHistory !== "")
      return {
        contracts: [],
        findings: ["trusted contract is missing but existed in target history"],
      };
    if (!allowFirstContract)
      return {
        contracts: [],
        findings: ["trusted base has no product contract"],
      };
    return readFirstContractFeatureHistory(
      readGit,
      mergeBase,
      contractRelativePath,
    );
  }
  if (listing !== contractRelativePath)
    return {
      contracts: [],
      findings: ["trusted contract lookup returned an unexpected path"],
    };
  try {
    return {
      contracts: [
        validateProductContract(
          parseYaml(readGit(["show", `${mergeBase}:${contractRelativePath}`])),
        ),
      ],
      findings: [],
    };
  } catch (error) {
    return {
      contracts: [],
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
  readonly readAcceptanceReport?: () => Promise<ParsedPlaywrightJsonReport>;
};

const loadTrustedHistory = (
  options: ContractCheckOptions,
  contractRelativePath: string,
): {
  readonly trusted: readonly ProductContract[];
  readonly findings: readonly string[];
} => {
  const readGit = gitReader(options.repoRoot);
  try {
    const { mergeBase, targetCommit } = deriveTrustedMergeBase(
      readGit,
      process.env,
    );
    const loaded = readTrustedContract(
      readGit,
      mergeBase,
      targetCommit,
      options.allowFirstContract,
      contractRelativePath,
    );
    return { trusted: loaded.contracts, findings: loaded.findings };
  } catch (error) {
    return {
      trusted: [],
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
    for (const workPackage of owning) {
      for (const target of sorted(workPackage.appMapTargets)) {
        if (nodeIds.has(target)) continue;
        if (
          behavior.status !== "draft" ||
          workPackage.work.kind !== "template-gap"
        )
          findings.push(
            `${behavior.id} App Map target ${target} does not resolve`,
          );
      }
    }
  }
  return findings;
};

const generatedProjectionFindings = async (
  sourceRoot: string,
  contract: ProductContract,
  plans: readonly LoadedProductPlan[],
  tests: readonly AcceptanceTestIdentity[],
): Promise<readonly string[]> => {
  const links = projectionLinks(contract, plans, tests);
  const findings: string[] = [];
  for (const [path, expected] of [
    [schemaPath, schemaProjection()],
    [generatedPath, renderProductContractMarkdown({ contract, links })],
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
  const sourceRoot = boundedSourceRoot(options.repoRoot, options.sourceRoot);
  const contractRelativePath = relative(
    resolve(options.repoRoot),
    repoPath(sourceRoot, ".", contractPath),
  )
    .split(sep)
    .join("/");
  const findings: string[] = [];
  let current: ProductContract;
  try {
    current = loadContract(sourceRoot);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const history = loadTrustedHistory(options, contractRelativePath);
  findings.push(
    ...history.findings,
    ...history.trusted.flatMap((trusted, index) =>
      compareProductContractHistory(
        trusted,
        history.trusted[index + 1] ?? current,
      ),
    ),
  );
  let plans: readonly LoadedProductPlan[] = [];
  try {
    plans = await loadPlans(options.repoRoot, options.sourceRoot);
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  let discoveredTests: readonly AcceptanceTestIdentity[] = [];
  try {
    const report = await loadAcceptanceDiscovery(
      options.repoRoot,
      sourceRoot,
      options,
    );
    validateAcceptanceReportBoundary({ sourceRoot, report });
    discoveredTests = report.tests;
    findings.push(
      ...validateAcceptanceDiscovery({
        contract: current,
        tests: report.tests,
      }),
    );
  } catch (error) {
    findings.push(
      `Playwright discovery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
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
  const hasAppMapBoundBehavior = current.behaviors.some(
    (behavior) =>
      behavior.status === "required" ||
      plans.some(({ frontmatter }) =>
        frontmatter.workPackages.some(
          ({ behaviorIds, work }) =>
            behaviorIds.includes(behavior.id) && work.kind !== "template-gap",
        ),
      ),
  );
  if (hasAppMapBoundBehavior) {
    const appMap = await resolveCurrentAppMapNodes(options);
    findings.push(
      ...appMap.findings,
      ...validatePlanTargets(current, plans, appMap.nodeIds),
    );
  }
  findings.push(
    ...(await generatedProjectionFindings(
      sourceRoot,
      current,
      plans,
      discoveredTests,
    )),
  );
  return findings;
};

export type ProductContractArguments = {
  readonly mode: "generate" | "check";
  readonly sourceRoot: string;
  readonly allowFirstContract: boolean;
};

type MutableCliState = {
  sourceRoot?: string;
  allowFirstContract: boolean;
};

const consumeCliArgument = (
  argv: readonly string[],
  index: number,
  mode: "generate" | "check",
  state: MutableCliState,
): number => {
  const argument = argv[index];
  if (argument === "--source-root") {
    if (state.sourceRoot !== undefined || argv[index + 1] === undefined)
      throw new Error("--source-root must appear once with a value");
    const value = argv[index + 1] as string;
    if (value.startsWith("--"))
      throw new Error("--source-root requires a value");
    state.sourceRoot = value;
    return index + 2;
  }
  if (argument === "--allow-first-contract") {
    if (state.allowFirstContract || mode === "generate")
      throw new Error("--allow-first-contract is valid once for check only");
    state.allowFirstContract = true;
    return index + 1;
  }
  throw new Error(`Unknown or misplaced argument: ${argument}`);
};

export const parseProductContractArguments = (
  argv: readonly string[],
): ProductContractArguments => {
  const mode = argv[0];
  if (mode !== "generate" && mode !== "check")
    throw new Error("Mode must be generate or check");
  const state: MutableCliState = { allowFirstContract: false };
  for (let index = 1; index < argv.length;)
    index = consumeCliArgument(argv, index, mode, state);
  if (state.sourceRoot === undefined)
    throw new Error("--source-root is required");
  if (mode === "check" && state.sourceRoot !== ".")
    throw new Error("check requires --source-root .");
  return {
    mode,
    sourceRoot: state.sourceRoot,
    allowFirstContract: state.allowFirstContract,
  };
};

const main = async (): Promise<void> => {
  const { mode, sourceRoot, allowFirstContract } =
    parseProductContractArguments(process.argv.slice(2));
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  if (mode === "generate") {
    await generateProductContract({ repoRoot, sourceRoot });
    return;
  }
  const findings = await checkProductContract({
    repoRoot,
    sourceRoot,
    allowFirstContract,
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
