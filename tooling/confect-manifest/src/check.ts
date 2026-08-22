import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(
  "packages/template-core/src/generated/confectManifest.ts",
);
const before = readFileSync(target);

execFileSync("pnpm", ["confect:manifest"], { stdio: "inherit" });

const after = readFileSync(target);
if (!before.equals(after)) {
  throw new Error(
    "Generated Confect manifest was stale and has been refreshed. Review the change, then rerun pnpm check:confect-manifest.",
  );
}

console.log("check:confect-manifest: generated output is fresh");
