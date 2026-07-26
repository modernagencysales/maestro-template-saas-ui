import process from "node:process";
import {
  validateInstalledOfficialConvexTargets,
  validateOfficialConvexBundle,
} from "../agent-pack/src/officialConvex.js";

export async function checkConvexAiFiles(
  repoRoot: string,
): Promise<readonly string[]> {
  const [bundle, installed] = await Promise.all([
    validateOfficialConvexBundle(repoRoot),
    validateInstalledOfficialConvexTargets(repoRoot),
  ]);
  return [...bundle, ...installed];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = await checkConvexAiFiles(process.cwd());
  if (findings.length > 0) {
    console.error(
      `Convex AI file drift:\n${findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("Convex AI files match the pinned offline manifest.");
}
