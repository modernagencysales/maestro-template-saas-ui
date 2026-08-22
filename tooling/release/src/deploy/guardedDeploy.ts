import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  requestDurableDeployAuthorization,
  type DeployAuthorityAction,
} from "./durableAuthority.js";

const [action] = process.argv.slice(2) as [DeployAuthorityAction | undefined];
const environment = process.env.DEPLOY_ENVIRONMENT;
const commitSha = process.env.CI_COMMIT_SHA;
const targetId = process.env.PROMOTION_TARGET_ID;
if (
  (action !== "convex" && action !== "cloudflare") ||
  (environment !== "staging" && environment !== "production") ||
  !commitSha ||
  !targetId
) {
  throw new Error(
    "Guarded deploy requires action and exact environment, commit, and target scope.",
  );
}
const publicKeyPem = readFileSync(
  resolve(
    process.cwd(),
    "tooling/release/keys/deploy-authority-public-key.pem",
  ),
  "utf8",
);
await requestDurableDeployAuthorization(
  { environment, commitSha, targetId, action },
  {
    endpoint: process.env.PROMOTION_AUTHORITY_ENDPOINT,
    publicKeyPem,
    nowMs: Date.now,
    fetch,
  },
);
const command =
  action === "convex"
    ? ([
        "pnpm",
        ["--dir", "packages/convex", "exec", "convex", "deploy", "-y"],
      ] as const)
    : ([
        "pnpm",
        [
          "dlx",
          "wrangler@latest",
          "pages",
          "deploy",
          "apps/web/dist/client",
          "--project-name",
          process.env.CLOUDFLARE_PAGES_PROJECT ?? "maestro-template",
          "--branch",
          process.env.CLOUDFLARE_PAGES_BRANCH ?? "main",
          "--commit-dirty=true",
        ],
      ] as const);
const result = spawnSync(command[0], command[1], {
  stdio: "inherit",
  env: process.env,
});
if (result.status !== 0)
  throw new Error(`Guarded ${action} deployment failed.`);
