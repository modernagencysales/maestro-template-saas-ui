import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("ESLint generated path ownership", () => {
  it("ignores canonical Convex codegen at every supported depth", async () => {
    const eslint = new ESLint({ cwd: repositoryRoot });

    await expect(
      eslint.isPathIgnored(
        "packages/convex/convex/components/workflowAdmission/_generated/component.ts",
      ),
    ).resolves.toBe(true);
    await expect(
      eslint.isPathIgnored("packages/convex/convex/_generated/server.d.ts"),
    ).resolves.toBe(true);
    await expect(
      eslint.isPathIgnored(
        "packages/convex/convex/components/workflowAdmission/convex.config.ts",
      ),
    ).resolves.toBe(false);
  });
});
