import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requestDurableDeployAuthorization } from "./durableAuthority.js";

const [environment, commitSha, targetId] = process.argv.slice(2);
if (
  (environment !== "staging" && environment !== "production") ||
  !commitSha ||
  !targetId
) {
  throw new Error("Usage: authorityCli <staging|production> <commit> <target>");
}
const publicKeyPem = readFileSync(
  resolve(
    process.cwd(),
    "tooling/release/keys/deploy-authority-public-key.pem",
  ),
  "utf8",
);
await requestDurableDeployAuthorization(
  { environment, commitSha, targetId, action: "preflight" },
  {
    endpoint: process.env.PROMOTION_AUTHORITY_ENDPOINT,
    publicKeyPem,
    nowMs: Date.now,
    fetch,
  },
);
process.stdout.write("Durable deploy authority preflight passed.\n");
