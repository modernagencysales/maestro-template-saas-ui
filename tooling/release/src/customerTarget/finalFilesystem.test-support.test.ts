import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPrerenderRetryCompatibility,
  retryTransientPrerenderStartup,
} from "./finalFilesystem.test-support.js";

describe("final filesystem prerender startup retry", () => {
  it("enables the installed TanStack retry before customer compilation", () => {
    const root = mkdtempSync(join(tmpdir(), "prerender-compat-"));
    const path = join(
      root,
      "node_modules/.pnpm/@tanstack+start-plugin-core@1.171.18_fixture/node_modules/@tanstack/start-plugin-core/dist/esm/prerender.js",
    );
    const vitePath = join(path, "../vite/prerender.js");
    mkdirSync(join(path, ".."), { recursive: true });
    mkdirSync(join(vitePath, ".."), { recursive: true });
    writeFileSync(
      path,
      [
        "if (retries < (prerenderOptions.retryCount ?? 0)) {",
        "const retryDelay = normalizeRetryDelay(prerenderOptions.retryDelay);",
        "logger.warn(`Encountered error, retrying: ${page.path} in ${retryDelay}ms`);\n\t\t\t\t\t\tawait new Promise",
      ].join("\n"),
    );
    writeFileSync(
      vitePath,
      [
        "return await vite.preview({",
        "\t\t\tconfigFile: viteConfig.configFile,",
        "\t\t\tpreview: {",
        "\t\t\t\tport: 0,",
        "\t\t\t\topen: false",
        "\t\t\t}",
        "\t\t});",
      ].join("\n"),
    );

    applyPrerenderRetryCompatibility(root);

    const source = readFileSync(path, "utf8");
    expect(source).toContain("seen.delete(page.path)");
    expect(readFileSync(vitePath, "utf8")).toContain(
      'previewServer.httpServer.once("listening", resolve)',
    );
    expect(readFileSync(vitePath, "utf8")).toContain(
      "await fetch(previewServer.resolvedUrls.local[0]",
    );
  });
  it("retries bounded loopback startup refusals until the build succeeds", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const result = await retryTransientPrerenderStartup(
      async () => {
        attempts += 1;
        if (attempts < 3)
          throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
        return "built";
      },
      4,
      async (delayMs) => {
        waits.push(delayMs);
      },
    );

    expect(result).toBe("built");
    expect(attempts).toBe(3);
    expect(waits).toEqual([1_000, 1_000]);
  });

  it("does not retry unrelated build failures", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("TypeScript compilation failed");
      }),
    ).rejects.toThrow("TypeScript compilation failed");

    expect(attempts).toBe(1);
  });

  it("fails after the bounded startup attempt budget", async () => {
    let attempts = 0;
    await expect(
      retryTransientPrerenderStartup(async () => {
        attempts += 1;
        throw new Error("connect ECONNREFUSED 127.0.0.1:41731");
      }, 3),
    ).rejects.toThrow("ECONNREFUSED");

    expect(attempts).toBe(3);
  });
});
