import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const targets = [
  "packages/template-core/src/generated/confectManifest.ts",
  "packages/convex/confect/_generated/confectManifest.inventory.ts",
  "packages/convex/confect/_generated/confectManifest.inventory.digest.json",
].map((path) => resolve(path));
const before = new Map(targets.map((target) => [target, readFileSync(target)]));

execFileSync("pnpm", ["confect:manifest"], { stdio: "inherit" });

const stale = targets.filter(
  (target) => !before.get(target)?.equals(readFileSync(target)),
);
if (stale.length > 0) {
  throw new Error(
    `Generated Confect manifests were stale and have been refreshed: ${stale.join(", ")}. Review the change, then rerun pnpm check:confect-manifest.`,
  );
}

console.log("check:confect-manifest: runtime and inventory outputs are fresh");
