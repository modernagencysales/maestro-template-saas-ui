import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  AstBuilder,
  GherkinClassicTokenMatcher,
  Parser,
} from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";

type Journey = { readonly id: string; readonly lifecycle: string };
type Result = {
  readonly ok: boolean;
  readonly journeys: readonly Journey[];
  readonly findings: readonly string[];
};
const LIFECYCLES = new Set(["@assembling", "@admitted", "@suspended"]);
const IMPLEMENTATION =
  /(?:\b(?:database table|shell command|function named)\b|(?:^|\s)[./][\w/-]+\.[a-z]+\b)/iu;

export function compileFeatureContracts(
  source: string,
  publicSurfaces: readonly string[],
): Result {
  const findings: string[] = [];
  let document;
  try {
    document = new Parser(
      new AstBuilder(IdGenerator.incrementing()),
      new GherkinClassicTokenMatcher(),
    ).parse(source);
  } catch (error) {
    return {
      ok: false,
      journeys: [],
      findings: [
        `invalid Gherkin: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  const feature = document.feature;
  if (feature === undefined)
    return { ok: false, journeys: [], findings: ["feature is required"] };
  const tags = feature.tags.map(({ name }) => name);
  const journeyTags = tags.filter((tag) => tag.startsWith("@journey_"));
  const lifecycleTags = tags.filter((tag) => LIFECYCLES.has(tag));
  findings.push(
    ...tagFindings(tags, journeyTags, lifecycleTags, publicSurfaces),
  );
  findings.push(
    ...scenarioFindings(
      feature.children.flatMap((child) =>
        child.scenario === undefined ? [] : [child.scenario],
      ),
    ),
  );
  const journey = journeyTags[0];
  const lifecycle = lifecycleTags[0];
  const journeys =
    journey !== undefined && lifecycle !== undefined
      ? [
          {
            id: journey.slice("@journey_".length),
            lifecycle: lifecycle.slice(1),
          },
        ]
      : [];
  return { ok: findings.length === 0, journeys, findings };
}

function tagFindings(
  tags: readonly string[],
  journeyTags: readonly string[],
  lifecycleTags: readonly string[],
  publicSurfaces: readonly string[],
): string[] {
  const findings: string[] = [];
  if (journeyTags.length !== 1)
    findings.push("feature requires exactly one @journey_<kebab-id> tag");
  if (lifecycleTags.length !== 1)
    findings.push("feature requires exactly one lifecycle tag");
  for (const tag of tags.filter((item) => item.startsWith("@covers_"))) {
    if (!publicSurfaces.includes(tag.slice("@covers_".length)))
      findings.push(`${tag} names an unknown public surface`);
  }
  const known = tags.filter(
    (tag) =>
      !tag.startsWith("@journey_") &&
      !LIFECYCLES.has(tag) &&
      !tag.startsWith("@covers_") &&
      !/^@(transport|auth|denial)_/u.test(tag),
  );
  if (known.length > 0)
    findings.push(`unknown feature tags: ${known.join(", ")}`);
  return findings;
}

function scenarioFindings(
  scenarios: readonly {
    readonly steps: readonly {
      readonly keyword: string;
      readonly text: string;
    }[];
  }[],
): string[] {
  const findings: string[] = [];
  if (
    !scenarios.some((scenario) =>
      scenario.steps.some((step) => step.keyword.trim() === "Then"),
    )
  )
    findings.push("feature requires at least one observable scenario");
  for (const step of scenarios.flatMap((scenario) => scenario.steps)) {
    if (IMPLEMENTATION.test(step.text))
      findings.push(
        `implementation instruction is forbidden in step: ${step.text}`,
      );
  }
  return findings;
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
  const topology = JSON.parse(
    readFileSync("docs/template/product-topology.json", "utf8"),
  ) as {
    resources: Array<{ id: string; kind: string; surfaces: string[] }>;
  };
  const surfaces = topology.resources
    .filter(
      (resource) =>
        resource.kind === "route" && resource.surfaces.includes("web"),
    )
    .map((resource) => resource.id.replace(/^route:/u, ""));
  const findings = filesUnder("features").flatMap((file) =>
    compileFeatureContracts(readFileSync(file, "utf8"), surfaces).findings.map(
      (finding) => `${file}: ${finding}`,
    ),
  );
  if (findings.length > 0) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("check-features.mts")) main();
