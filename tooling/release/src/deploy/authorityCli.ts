import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requestDurableDeployAuthorization,
  validatePromotionAuthorityEndpoint,
} from "./durableAuthority.js";

export const runDurableDeployAuthorityPreflight = async (
  args: readonly string[],
  dependencies: {
    readonly endpoint: string | undefined;
    readonly publicKeyPem: string;
    readonly nowMs: () => number;
    readonly fetch: typeof fetch;
  },
): Promise<void> => {
  const [environment, commitSha, targetId, targetConvexUrl] = args;
  if (
    (environment !== "staging" && environment !== "production") ||
    !commitSha ||
    !targetId ||
    !targetConvexUrl
  ) {
    throw new Error(
      "Usage: authorityCli <staging|production> <commit> <target> <target-convex-url>",
    );
  }
  const endpoint = validatePromotionAuthorityEndpoint(
    dependencies.endpoint,
    targetConvexUrl,
  );
  await requestDurableDeployAuthorization(
    { environment, commitSha, targetId, action: "preflight" },
    { ...dependencies, endpoint },
  );
};

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const publicKeyPem = readFileSync(
    resolve(
      process.cwd(),
      "tooling/release/keys/deploy-authority-public-key.pem",
    ),
    "utf8",
  );
  await runDurableDeployAuthorityPreflight(process.argv.slice(2), {
    endpoint: process.env.PROMOTION_AUTHORITY_ENDPOINT,
    publicKeyPem,
    nowMs: Date.now,
    fetch,
  });
  process.stdout.write("Durable deploy authority preflight passed.\n");
}
