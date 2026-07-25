/**
 * stack:check — validate a StackPlan JSON deterministically (plan.mts). Run by
 * the agent AND always by stack:submit before any branch work, so the happy
 * path cannot skip the depth/order/completeness guardrails (spec §2.4).
 */
import { readdirSync, readFileSync } from "node:fs";
import process from "node:process";
import { validatePlan } from "./plan.mts";

const SOURCE_ROOT = new URL("../../", import.meta.url);
const ADR_DIRECTORY = "docs/template/adr/";

export function checkPlanFile(url: URL): string[] {
  let plan: unknown;
  try {
    plan = JSON.parse(readFileSync(url, "utf8"));
  } catch {
    return ["plan must be valid JSON"];
  }
  return validatePlan(plan, {
    reviewedAdrRefs: readReviewedAdrRefs(SOURCE_ROOT),
  });
}

export function readReviewedAdrRefs(sourceRoot: URL): ReadonlySet<string> {
  const adrDirectoryUrl = new URL(ADR_DIRECTORY, sourceRoot);
  const references = readdirSync(adrDirectoryUrl, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && /^\d{4}-[a-z0-9-]+\.md$/.test(entry.name),
    )
    .filter((entry) =>
      /^## Status\s+Accepted\.\s*$/m.test(
        readFileSync(new URL(entry.name, adrDirectoryUrl), "utf8"),
      ),
    )
    .map((entry) => `${ADR_DIRECTORY}${entry.name}`);
  return new Set(references);
}

// CLI: `tsx tooling/stack/check.mts <plan.json>`
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: stack:check <plan.json>");
    process.exit(2);
  }
  const errors = checkPlanFile(new URL(file, `file://${process.cwd()}/`));
  if (errors.length > 0) {
    console.error(
      `✗ stack plan invalid:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("✓ stack plan valid");
}
