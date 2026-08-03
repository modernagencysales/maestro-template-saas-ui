import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callTasteJudge,
  changedLinesBlock,
  formatTasteVerdict,
  infrastructureBlockedTasteVerdict,
  isLineInRanges,
  isTasteProviderQuotaOutput,
  parseChangedLineRanges,
  parseVerdict,
  reviewTasteFiles,
  scopeVerdictToChangedLines,
  selectTasteReviewProvider,
  tasteReviewConcurrency,
} from "./taste-review.mts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function runTasteScript(
  args: readonly string[],
  env: Record<string, string>,
): SpawnSyncReturns<string> {
  return spawnSync(
    "pnpm",
    ["exec", "tsx", "tooling/quality/taste.mts", ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubProviderEnv(env: Record<string, string>): void {
  const defaults: Record<string, string> = {
    OPENROUTER_API_KEY: "",
    OPENAI_API_KEY: "",
    OPENROUTER_BASE_URL: "",
    OPENROUTER_MODEL: "",
    OPENAI_MODEL: "",
    TASTE_PROVIDER: "",
    TASTE_OPENAI_MODEL: "",
    TASTE_OPENROUTER_MODEL: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...env })) {
    vi.stubEnv(key, value);
  }
}

describe("taste verdict formatting", () => {
  it("formats an explicit pass verdict for no source files", () => {
    expect(formatTasteVerdict({ verdict: "pass", files: [] })).toBe(
      '{"verdict":"pass","files":[]}',
    );
  });

  it("formats provider failures as blocking verdicts for PR feedback", () => {
    const verdict = infrastructureBlockedTasteVerdict(
      "OpenRouter provider quota or rate limit prevented taste from judging code.",
      "Restore the OpenRouter token and rerun the taste gate.",
    );

    expect(verdict.verdict).toBe("block");
    expect(verdict.files[0]?.file).toBe("tooling/quality/taste-review.mts");
    expect(verdict.files[0]?.verdict.verdict).toBe("block");
    expect(verdict.files[0]?.verdict.findings[0]?.severity).toBe("block");
    expect(formatTasteVerdict(verdict)).toMatch(/OpenRouter token/);
  });
});

describe("taste verdict parsing", () => {
  it("parses model verdicts that use backtick string values", () => {
    const verdict = parseVerdict(
      '{"verdict":"block","findings":[{"line":7,"severity":"block","issue":`The inline helper hides multiple responsibilities`,"fix":`Extract named functions`}]}',
    );

    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]?.line).toBe(7);
    expect(verdict.findings[0]?.severity).toBe("block");
    expect(verdict.findings[0]?.issue).toBe(
      "The inline helper hides multiple responsibilities",
    );
    expect(verdict.findings[0]?.fix).toBe("Extract named functions");
  });

  it("parses model verdicts with backticks inside double-quoted strings", () => {
    const verdict = parseVerdict(
      '{"verdict":"block","findings":[{"line":42,"severity":"block","issue":"The method `ramp` handles too many concerns","fix":`Split into smaller functions`}]}',
    );

    expect(verdict.verdict).toBe("block");
    expect(verdict.findings).toHaveLength(1);
    expect(verdict.findings[0]?.issue).toBe(
      "The method `ramp` handles too many concerns",
    );
    expect(verdict.findings[0]?.fix).toBe("Split into smaller functions");
  });

  it("strips json code fences before parsing", () => {
    const verdict = parseVerdict(
      '```json\n{"verdict":"pass","findings":[]}\n```',
    );
    expect(verdict.verdict).toBe("pass");
    expect(verdict.findings).toHaveLength(0);
  });
});

describe("taste provider quota classification", () => {
  it("classifies OpenRouter quota output as infrastructure-blocked", () => {
    expect(
      isTasteProviderQuotaOutput(
        'OpenRouter 429: {"error":{"message":"insufficient_quota"}}',
      ),
    ).toBe(true);
    expect(
      isTasteProviderQuotaOutput(
        'OpenRouter 402: {"error":{"message":"Insufficient credits. Add more using the provider console","code":402}}',
      ),
    ).toBe(true);
  });

  it("classifies OpenAI quota output as infrastructure-blocked", () => {
    expect(
      isTasteProviderQuotaOutput(
        'OpenAI 429: {"error":{"code":"insufficient_quota"}}',
      ),
    ).toBe(true);
  });

  it("does not classify ordinary taste verdicts as quota exhaustion", () => {
    expect(
      isTasteProviderQuotaOutput(
        '{"verdict":"block","findings":[{"line":4,"severity":"block","issue":"god function","fix":"split responsibilities"}]}',
      ),
    ).toBe(false);
  });
});

describe("taste provider selection", () => {
  it("prefers OpenRouter when both provider keys are present", () => {
    expect(
      selectTasteReviewProvider({
        OPENROUTER_API_KEY: "openrouter-token",
        OPENAI_API_KEY: "openai-token",
      }),
    ).toEqual({ kind: "openrouter", model: "deepseek/deepseek-v4-pro" });
  });

  it("honors OPENROUTER_MODEL and TASTE_OPENROUTER_MODEL overrides", () => {
    expect(
      selectTasteReviewProvider({
        OPENROUTER_API_KEY: "openrouter-token",
        OPENROUTER_MODEL: "vendor/general-model",
      }),
    ).toEqual({ kind: "openrouter", model: "vendor/general-model" });
    expect(
      selectTasteReviewProvider({
        OPENROUTER_API_KEY: "openrouter-token",
        OPENROUTER_MODEL: "vendor/general-model",
        TASTE_OPENROUTER_MODEL: "vendor/taste-model",
      }),
    ).toEqual({ kind: "openrouter", model: "vendor/taste-model" });
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is present", () => {
    expect(
      selectTasteReviewProvider({ OPENAI_API_KEY: "openai-token" }),
    ).toEqual({ kind: "openai", model: "gpt-5.5" });
  });

  it("fails closed when the overridden provider has no key", () => {
    expect(
      selectTasteReviewProvider({
        OPENAI_API_KEY: "openai-token",
        TASTE_PROVIDER: "openrouter",
      }),
    ).toBeNull();
    expect(selectTasteReviewProvider({ TASTE_PROVIDER: "unknown" })).toBeNull();
  });

  it("returns null when no provider key is configured", () => {
    expect(selectTasteReviewProvider({})).toBeNull();
  });
});

describe("taste judge calls", () => {
  it("uses the OpenRouter chat-completions API when its key is present", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "openrouter-token",
      OPENAI_API_KEY: "openai-token",
    });
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      urls.push(url);
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as {
        max_tokens: number;
        model: string;
      };
      expect(body.model).toBe("deepseek/deepseek-v4-pro");
      expect(body.max_tokens).toBe(4096);
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
    expect(urls).toEqual(["https://openrouter.ai/api/v1/chat/completions"]);
  });

  it("uses OPENROUTER_BASE_URL for OpenRouter taste calls", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "proxy-token",
      OPENROUTER_BASE_URL: "http://127.0.0.1:43210/api/v1/",
    });
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      urls.push(url);
      expect(url).toBe("http://127.0.0.1:43210/api/v1/chat/completions");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer proxy-token",
      );
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
    expect(urls).toEqual(["http://127.0.0.1:43210/api/v1/chat/completions"]);
  });

  it("falls back to OpenAI when OpenRouter quota blocks taste-review", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "openrouter-token",
      OPENAI_API_KEY: "openai-token",
    });
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("openrouter.ai")) {
        return new Response(
          '{"error":{"message":"Insufficient credits","code":402}}',
          { status: 402 },
        );
      }
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as {
        max_completion_tokens?: number;
        max_tokens?: number;
        seed?: number;
        temperature?: number;
        model: string;
      };
      expect(body.model).toBe("gpt-5.5");
      expect(body.max_completion_tokens).toBe(4096);
      expect(body.max_tokens).toBeUndefined();
      expect(body.seed).toBe(0);
      expect(body.temperature).toBeUndefined();
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
    expect(urls).toEqual([
      "https://openrouter.ai/api/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ]);
  });

  it("fails closed when OpenRouter is quota-blocked and no OpenAI key exists", async () => {
    stubProviderEnv({ OPENROUTER_API_KEY: "openrouter-token" });
    vi.stubGlobal(
      "fetch",
      (async () =>
        new Response(
          '{"error":{"message":"Insufficient credits","code":402}}',
          {
            status: 402,
          },
        )) as typeof fetch,
    );

    await expect(
      callTasteJudge("packages/example.ts", "export const ok = true;"),
    ).rejects.toThrow(/quota or rate limit/);
  });

  it("sends zero temperature to OpenAI fallback models that support it", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "openrouter-token",
      OPENAI_API_KEY: "openai-token",
      TASTE_OPENAI_MODEL: "gpt-4o",
    });
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      if (url.includes("openrouter.ai")) {
        return new Response(
          '{"error":{"message":"Insufficient credits","code":402}}',
          { status: 402 },
        );
      }
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as {
        temperature?: number;
        model: string;
      };
      expect(body.model).toBe("gpt-4o");
      expect(body.temperature).toBe(0);
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
  });

  it("retries an empty judge response before parsing the verdict", async () => {
    stubProviderEnv({ OPENROUTER_API_KEY: "openrouter-token" });
    const responses = ["", '{"verdict":"pass","findings":[]}'];
    vi.stubGlobal("fetch", (async () =>
      Response.json({
        choices: [{ message: { content: responses.shift() ?? "" } }],
      })) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
    expect(responses).toHaveLength(0);
  });

  it("falls back to OpenAI after repeated malformed OpenRouter verdicts", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "openrouter-token",
      OPENAI_API_KEY: "openai-token",
    });
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("openrouter.ai")) {
        return Response.json({ choices: [{ message: { content: "" } }] });
      }
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body)) as { model: string };
      expect(body.model).toBe("gpt-5.5");
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const verdict = await callTasteJudge(
      "packages/example.ts",
      "export const ok = true;",
    );

    expect(verdict.verdict).toBe("pass");
    expect(urls.filter((url) => url.includes("openrouter.ai"))).toHaveLength(3);
    expect(urls.filter((url) => url.includes("api.openai.com"))).toHaveLength(
      1,
    );
  });
});

describe("taste review concurrency", () => {
  it("bounds taste file review concurrency while preserving result order", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await reviewTasteFiles(
      ["a.ts", "b.ts", "c.ts", "d.ts"],
      async (file) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolveSleep) => setTimeout(resolveSleep, 10));
        active -= 1;
        return {
          verdict: file === "c.ts" ? "block" : "pass",
          findings: [],
        };
      },
      { concurrency: 2 },
    );

    expect(results.map((result) => result.file)).toEqual([
      "a.ts",
      "b.ts",
      "c.ts",
      "d.ts",
    ]);
    expect(results[2]?.verdict.verdict).toBe("block");
    expect(maxActive).toBe(2);
  });

  it("defaults taste review concurrency to a small bounded worker pool", () => {
    expect(tasteReviewConcurrency({})).toBe(1);
    expect(tasteReviewConcurrency({ TASTE_REVIEW_CONCURRENCY: "2" })).toBe(2);
    expect(tasteReviewConcurrency({ TASTE_REVIEW_CONCURRENCY: "0" })).toBe(1);
    expect(tasteReviewConcurrency({ TASTE_REVIEW_CONCURRENCY: "99" })).toBe(25);
  });
});

describe("taste diff scoping", () => {
  it("renders changed-line metadata without imperative reviewer instructions", () => {
    const block = changedLinesBlock([
      { start: 5, end: 10 },
      { start: 42, end: 42 },
    ]);

    expect(block).toContain("<changed-lines>");
    expect(block).toContain("5-10, 42");
    expect(block).not.toMatch(/review only|ignore|return pass/i);
  });

  it("parses new-side line ranges from unified hunk headers", () => {
    const diff = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -10,3 +12,5 @@ context",
      " keep",
      "+added",
      "+added",
      "@@ -40 +50 @@",
      "-old",
      "+new",
    ].join("\n");
    expect(parseChangedLineRanges(diff)).toEqual([
      { start: 12, end: 16 },
      { start: 50, end: 50 },
    ]);
  });

  it("treats a pure deletion hunk (+c,0) as no new-side scope", () => {
    const diff = "@@ -10,4 +9,0 @@\n-gone\n-gone";
    expect(parseChangedLineRanges(diff)).toEqual([]);
  });

  it("keeps only findings that fall inside a changed range", () => {
    const verdict = {
      verdict: "block",
      findings: [
        { line: 13, severity: "block", issue: "in scope", fix: "" },
        { line: 99, severity: "block", issue: "pre-existing", fix: "" },
      ],
    };
    const scoped = scopeVerdictToChangedLines(verdict, [
      { start: 12, end: 16 },
    ]);
    expect(scoped.findings).toHaveLength(1);
    expect(scoped.findings[0]?.issue).toBe("in scope");
    expect(scoped.verdict).toBe("block");
  });

  it("downgrades to pass when every block finding is outside the diff", () => {
    const verdict = {
      verdict: "block",
      findings: [{ line: 99, severity: "block", issue: "old code", fix: "" }],
    };
    expect(scopeVerdictToChangedLines(verdict, [{ start: 1, end: 5 }])).toEqual(
      {
        verdict: "pass",
        findings: [],
      },
    );
  });

  it("fails open to the full verdict when ranges cannot be computed", () => {
    const verdict = {
      verdict: "block",
      findings: [{ line: 99, severity: "block", issue: "keep", fix: "" }],
    };
    expect(scopeVerdictToChangedLines(verdict, null)).toBe(verdict);
  });

  it("matches lines against inclusive range bounds", () => {
    const ranges = [{ start: 12, end: 16 }];
    expect(isLineInRanges(12, ranges)).toBe(true);
    expect(isLineInRanges(16, ranges)).toBe(true);
    expect(isLineInRanges(11, ranges)).toBe(false);
    expect(isLineInRanges(17, ranges)).toBe(false);
  });
});

describe("taste CLI fail-closed behavior", () => {
  it(
    "emits a blocking JSON marker and exits 1 in CI without provider keys",
    { timeout: 120_000 },
    () => {
      const result = runTasteScript([], {
        CI: "true",
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "",
        TASTE_PROVIDER: "",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toMatch(/^TASTE_VERDICT_JSON=/m);
      expect(result.stdout).toMatch(/"verdict":"block"/);
      expect(result.stderr).toMatch(/no AI provider is configured/);
    },
  );

  it(
    "emits a deterministic parseable pass verdict in fake mode",
    { timeout: 120_000 },
    () => {
      const result = runTasteScript(["--mode", "fake"], {
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "",
        TASTE_PROVIDER: "",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("taste: verdict=pass reason=fake-mode");
      expect(result.stdout).toMatch(
        /^TASTE_VERDICT_JSON=\{"verdict":"pass","files":\[\]\}$/m,
      );
    },
  );
});
