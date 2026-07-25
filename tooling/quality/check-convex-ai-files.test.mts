import { describe, expect, it } from "vitest";
import { checkConvexAiFiles } from "./check-convex-ai-files.mts";

describe("check:convex-ai-files", () => {
  it("accepts the pinned committed official bundle", async () => {
    await expect(checkConvexAiFiles(process.cwd())).resolves.toEqual([]);
  });
});
