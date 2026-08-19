import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("TanStack Start Cloudflare Worker contract", () => {
  it("uses the Cloudflare Vite SSR environment instead of the Node Nitro preset", () => {
    const viteConfig = read("apps/web/vite.config.ts");

    expect(viteConfig).toContain(
      'cloudflare({ viteEnvironment: { name: "ssr" } })',
    );
    expect(viteConfig.indexOf("cloudflare(")).toBeLessThan(
      viteConfig.indexOf("tanstackStart("),
    );
    expect(viteConfig).not.toContain("nitro(");
  });

  it("keeps the review Worker observable and free of checked-in auth values", () => {
    const json = read("apps/web/wrangler.jsonc").replace(/,\s*([}\]])/gu, "$1");
    const config = JSON.parse(json) as Record<string, unknown>;

    expect(config).toMatchObject({
      name: "maestro-template-saas-ui",
      main: "@tanstack/react-start/server-entry",
      compatibility_date: "2026-08-19",
      compatibility_flags: ["nodejs_compat"],
      observability: {
        enabled: true,
        head_sampling_rate: 1,
      },
    });
    expect(config).not.toHaveProperty("vars");
  });

  it("ships pinned Worker tooling and repeatable package scripts", () => {
    const packageJson = JSON.parse(read("apps/web/package.json")) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.devDependencies).toMatchObject({
      "@cloudflare/vite-plugin": "1.53.0",
      wrangler: "4.124.0",
    });
    expect(packageJson.scripts).toMatchObject({
      start: "vite preview",
      deploy: "pnpm build && wrangler deploy",
      "cf-typegen": "wrangler types",
    });
    expect(read(".gitignore")).toContain(".dev.vars");
  });
});
