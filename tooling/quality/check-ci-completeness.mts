import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { descriptorFor } from "./src/check-definitions.mts";
import { isDirectRun } from "./src/direct-run.mts";
import { evaluateStaticCheck, type StaticCheckResult } from "./src/gate.mts";

export const descriptor = descriptorFor("ci-completeness");

const REQUIRED_HOST_VERIFY_TERMS = [
  "pnpm check:config-drift",
  "pnpm check:convex-ai-files",
  "pnpm check:agent-pack",
] as const;

const FOCUSED_ONLY_TERMS = [
  "pnpm test:tooling",
  "pnpm test:workflow",
  "pnpm test:pr-backlog",
  "pnpm evals",
  "pnpm check:app-map",
] as const;

export function validateRootVerifyHostTerms(input: unknown): readonly string[] {
  const root = record(input, "package.json");
  const scripts = record(root.scripts, "package.json scripts");
  if (typeof scripts.verify !== "string") {
    return ["package.json scripts.verify must be a string"];
  }
  const terms = scripts.verify.split("&&").map((term) => term.trim());
  const findings: string[] = [];
  if (terms.includes("pnpm check:product-journeys")) {
    findings.push(
      "package.json scripts.verify must not run pnpm check:product-journeys before repository adoption",
    );
  }
  if (terms.includes("pnpm check:qlty")) {
    findings.push(
      "package.json scripts.verify must keep pnpm check:qlty advisory outside the root verdict",
    );
  }
  findings.push(
    ...FOCUSED_ONLY_TERMS.filter((term) => terms.includes(term)).map(
      (term) =>
        `package.json scripts.verify must not rerun ${term} after root test`,
    ),
  );
  const indices = REQUIRED_HOST_VERIFY_TERMS.map((required) => {
    const matches = terms.flatMap((term, index) =>
      term === required ? [index] : [],
    );
    if (matches.length !== 1) {
      findings.push(
        `package.json scripts.verify must contain exactly one ${required} term`,
      );
    }
    return matches[0];
  });
  const [configDrift, convexAiFiles, agentPack] = indices;
  if (
    configDrift !== undefined &&
    convexAiFiles !== undefined &&
    agentPack !== undefined &&
    (convexAiFiles !== configDrift + 1 || agentPack !== convexAiFiles + 1)
  ) {
    findings.push(
      "package.json scripts.verify must run config drift, Convex AI files, and Agent Pack as adjacent ordered terms",
    );
  }
  return findings;
}

export async function evaluateCiCompleteness(
  repoRoot: string,
): Promise<StaticCheckResult> {
  const staticResult = await evaluateStaticCheck(repoRoot, descriptor);
  let verifyFindings: readonly string[];
  try {
    verifyFindings = validateRootVerifyHostTerms(
      JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")),
    );
  } catch {
    verifyFindings = ["package.json scripts.verify could not be parsed"];
  }
  const failures = [...staticResult.failures, ...verifyFindings];
  return { ok: failures.length === 0, failures };
}

function record(input: unknown, name: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${name} must be an object`);
  }
  return Object.fromEntries(Object.entries(input));
}

if (isDirectRun(import.meta.url)) {
  const result = await evaluateCiCompleteness(process.cwd());
  if (result.ok) console.log("check:ci-completeness: ok");
  else {
    for (const failure of result.failures) console.error(failure);
    process.exitCode = 1;
  }
}
