import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readWeb = (path: string) => readFileSync(`${webRoot}/${path}`, "utf8");
const readRepository = (path: string) =>
  readFileSync(`${repositoryRoot}/${path}`, "utf8");
const readCatalog = () =>
  readRepository("docs/template/saas-ui-pattern-catalog.md")
    .toLowerCase()
    .replace(/\s+/gu, " ");

describe("Saas UI pattern source", () => {
  it("configures the pinned CLI for app-local source", () => {
    const config = JSON.parse(readWeb("components.json")) as {
      aliases: Record<string, string>;
      rsc: boolean;
      system: string;
      tsx: boolean;
    };

    expect(config).toMatchObject({ system: "chakra", rsc: false, tsx: true });
    expect(config.aliases).toEqual({
      components: "@/components",
      hooks: "@/hooks",
      lib: "@/lib",
      ui: "@/components/ui",
      utils: "@/lib/utils",
    });
  });

  it("resolves the same app-local alias in TypeScript and Vite", () => {
    const tsconfig = JSON.parse(readWeb("tsconfig.json")) as {
      compilerOptions: { baseUrl: string; paths: Record<string, string[]> };
    };
    const viteConfig = readWeb("vite.config.ts");

    expect(tsconfig.compilerOptions.baseUrl).toBe(".");
    expect(tsconfig.compilerOptions.paths).toEqual({ "@/*": ["./src/*"] });
    expect(viteConfig).toContain('"@": fileURLToPath(new URL("./src/"');
  });

  it("pins complete provenance and the closed disposition vocabulary", () => {
    const catalog = readCatalog();

    expect(catalog).toContain("ac3a40c8dc05e403f9d501a87c092646891d3c40");
    expect(catalog).toContain("b76cb4514b9ab47f7db87901cb9b593b4adc3129");
    for (const field of [
      "disposition",
      "source repo",
      "commit",
      "source path",
      "selected variant",
      "adapter / replacement",
      "dependency disposition",
    ]) {
      expect(catalog).toContain(field);
    }
    for (const disposition of [
      "live default",
      "ready source",
      "reference-only",
      "rejected",
    ]) {
      expect(catalog).toContain(disposition);
    }
  });

  it("rejects starter product authorities and documents the registry fallback", () => {
    const catalog = readCatalog();

    for (const rejected of [
      "starter backends",
      "mocks",
      "seed data",
      "demo metrics",
      "incomplete handlers",
      "duplicate primitives",
    ]) {
      expect(catalog).toContain(rejected);
    }
    expect(catalog).toContain("@saas-ui/cli@0.0.2");
    expect(catalog).toContain("pinned purchased source");
    expect(catalog).toContain("do not hand-roll");
  });
});
