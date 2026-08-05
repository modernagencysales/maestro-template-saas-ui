import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
} from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";

type Result = {
  readonly ok: boolean;
  readonly findings: readonly string[];
};

const LIFECYCLES = new Set(["@wip", "@required"]);
const SURFACES = new Set(["@ui", "@cli", "@cross_surface"]);

export function compileFeatureContracts(source: string): Result {
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
    };
  }

  const feature = document.feature;
  if (feature === undefined)
    return { ok: false, findings: ["feature is required"] };

  const findings: string[] = [];
  const lifecycleTags = feature.tags.filter(({ name }) => LIFECYCLES.has(name));
  if (lifecycleTags.length !== 1) {
    findings.push("feature requires exactly one @wip or @required tag");
  }

  const scenarios = feature.children.flatMap((child) =>
    child.scenario !== undefined
      ? [child.scenario]
      : child.rule === undefined
        ? []
        : child.rule.children.flatMap((ruleChild) =>
            ruleChild.scenario === undefined ? [] : [ruleChild.scenario],
          ),
  );
  for (const scenario of scenarios) {
    const surfaceTags = scenario.tags.filter(({ name }) => SURFACES.has(name));
    if (surfaceTags.length !== 1) {
      findings.push(
        `scenario ${JSON.stringify(scenario.name)} requires exactly one @ui, @cli, or @cross_surface tag`,
      );
    }
  }

  if (
    lifecycleTags[0]?.name === "@required" &&
    !scenarios.some((scenario) =>
      scenario.tags.some(({ name }) => name === "@cross_surface"),
    )
  ) {
    findings.push("required feature requires a @cross_surface scenario");
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
  const findings = filesUnder("features").flatMap((file) =>
    compileFeatureContracts(readFileSync(file, "utf8")).findings.map(
      (finding) => `${file}: ${finding}`,
    ),
  );
  if (findings.length > 0) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("check-features.mts")) main();
