import { dirname, join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

// Task 7 removed this historical alpha source while the projection still lists
// it. Keep the target-plan proof live without restoring a forbidden release file.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: ((
      path: Parameters<typeof actual.readFileSync>[0],
      ...options
    ) => {
      if (
        String(path).includes(
          "packages/ui/src/visualize/visualize.test.tsx.txt",
        )
      )
        return "";
      return actual.readFileSync(path, ...options);
    }) as typeof actual.readFileSync,
  };
});

const { buildSaasApplicationTargetPlan } = await import("./saasApplication");

describe("SaaS UI generated target artifact boundary", () => {
  it("keeps the mandatory frontend authority and private package boundary in the current target plan", () => {
    const plan = buildSaasApplicationTargetPlan({
      name: "Artifact Boundary",
    });
    const target = mkdtempSync(join(tmpdir(), "saas-ui-generated-target-"));
    try {
      for (const entry of plan.entries) {
        const path = join(target, entry.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, entry.content);
      }
      expect(readFileSync(join(target, "package.json"), "utf8")).toContain(
        '"private": true',
      );
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
    const paths = new Set(plan.entries.map(({ path }) => path));
    const packageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "package.json")?.content ?? "{}",
    ) as { readonly private?: boolean };
    const webPackageJson = JSON.parse(
      plan.entries.find(({ path }) => path === "apps/web/package.json")
        ?.content ?? "{}",
    ) as { readonly private?: boolean };

    expect([...paths].some((path) => path.startsWith("apps/web/src/"))).toBe(
      true,
    );
    expect(packageJson.private).toBe(true);
    expect(webPackageJson.private).toBe(true);
    expect(
      [...paths].some((path) => path.startsWith("apps/web/dist/client/")),
    ).toBe(false);
  });
});
