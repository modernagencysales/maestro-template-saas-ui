import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  AstBuilder,
  dialects,
  GherkinClassicTokenMatcher,
  Parser,
} from "@cucumber/gherkin";
import { IdGenerator, type Feature, type Scenario } from "@cucumber/messages";

type Result = {
  readonly ok: boolean;
  readonly findings: readonly string[];
};

type CompiledFeature = Result & {
  readonly lifecycle?: "@wip" | "@required";
  readonly scenarios: readonly {
    readonly executableCaseCount: number;
    readonly name: string;
    readonly stepCount: number;
  }[];
};

const LIFECYCLES = new Set(["@wip", "@required"]);
const SURFACES = new Set(["@ui", "@cli", "@cross_surface"]);

const scenariosUnder = (feature: Feature): readonly Scenario[] =>
  feature.children.flatMap((child) => {
    if (child.scenario !== undefined) return [child.scenario];
    if (child.rule === undefined) return [];
    return child.rule.children.flatMap((ruleChild) =>
      ruleChild.scenario === undefined ? [] : [ruleChild.scenario],
    );
  });

const lifecycleFindings = (count: number): readonly string[] =>
  count === 1 ? [] : ["feature requires exactly one @wip or @required tag"];

const scenarioSurfaceFindings = (
  scenarios: readonly Scenario[],
): readonly string[] =>
  scenarios.flatMap((scenario) => {
    const count = scenario.tags.filter(({ name }) => SURFACES.has(name)).length;
    return count === 1
      ? []
      : [
          `scenario ${JSON.stringify(scenario.name)} requires exactly one @ui, @cli, or @cross_surface tag`,
        ];
  });

const executableCaseCount = (
  scenario: Scenario,
  outlineKeywords: readonly string[],
): number =>
  outlineKeywords.includes(scenario.keyword)
    ? scenario.examples.reduce(
        (count, examples) => count + examples.tableBody.length,
        0,
      )
    : 1;

const requiredFeatureFindings = (
  lifecycle: string | undefined,
  scenarios: readonly Scenario[],
  outlineKeywords: readonly string[],
): readonly string[] => {
  if (lifecycle !== "@required") return [];
  return [
    ...(scenarios.some((scenario) =>
      scenario.tags.some(({ name }) => name === "@cross_surface"),
    )
      ? []
      : ["required feature requires a @cross_surface scenario"]),
    ...scenarios
      .filter(({ steps }) => steps.length === 0)
      .map(
        (scenario) =>
          `required scenario ${JSON.stringify(scenario.name)} requires at least one step`,
      ),
    ...scenarios
      .filter(
        (scenario) => executableCaseCount(scenario, outlineKeywords) === 0,
      )
      .map(
        (scenario) =>
          `required scenario outline ${JSON.stringify(scenario.name)} requires at least one executable case`,
      ),
  ];
};

function compileFeature(source: string): CompiledFeature {
  let document;
  try {
    document = new Parser(
      new AstBuilder(IdGenerator.incrementing()),
      new GherkinClassicTokenMatcher(),
    ).parse(source);
  } catch (error) {
    return {
      ok: false,
      findings: [
        `invalid Gherkin: ${error instanceof Error ? error.message : String(error)}`,
      ],
      scenarios: [],
    };
  }

  const feature = document.feature;
  if (feature === undefined)
    return { ok: false, findings: ["feature is required"], scenarios: [] };

  const lifecycleTags = feature.tags.filter(({ name }) => LIFECYCLES.has(name));
  const scenarios = scenariosUnder(feature);
  const outlineKeywords = dialects[feature.language]?.scenarioOutline ?? [];
  const findings = [
    ...lifecycleFindings(lifecycleTags.length),
    ...scenarioSurfaceFindings(scenarios),
    ...requiredFeatureFindings(
      lifecycleTags[0]?.name,
      scenarios,
      outlineKeywords,
    ),
  ];

  return {
    ok: findings.length === 0,
    findings,
    ...(lifecycleTags.length === 1
      ? { lifecycle: lifecycleTags[0]?.name as "@wip" | "@required" }
      : {}),
    scenarios: scenarios.map((scenario) => ({
      executableCaseCount: executableCaseCount(scenario, outlineKeywords),
      name: scenario.name,
      stepCount: scenario.steps.length,
    })),
  };
}

export function compileFeatureContracts(source: string): Result {
  const { ok, findings } = compileFeature(source);
  return { ok, findings };
}

export function compileFeatureContractSet(
  sources: readonly string[],
  options: {
    readonly paths?: readonly string[];
    readonly required?: boolean;
  } = {},
): Result {
  const compiled = sources.map(compileFeature);
  const findings = compiled.flatMap((feature, index) =>
    feature.findings.map((finding) =>
      options.paths?.[index] === undefined
        ? finding
        : `${options.paths[index]}: ${finding}`,
    ),
  );
  if (
    options.required === true &&
    !compiled.some(
      (feature) =>
        feature.lifecycle === "@required" &&
        feature.scenarios.some(
          ({ executableCaseCount }) => executableCaseCount > 0,
        ),
    )
  ) {
    findings.push(
      "required contract selection must include at least one scenario",
    );
  }
  return { ok: findings.length === 0, findings };
}

function filesUnder(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const child = join(path, entry.name);
      return entry.isDirectory()
        ? filesUnder(child)
        : extname(child) === ".feature"
          ? [child]
          : [];
    });
  } catch {
    return [];
  }
}

function main(): void {
  const files = filesUnder("features");
  const findings = compileFeatureContractSet(
    files.map((file) => readFileSync(file, "utf8")),
    {
      paths: files,
      required: process.argv.slice(2).includes("--required"),
    },
  ).findings;
  if (findings.length > 0) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("check-features.mts")) main();
