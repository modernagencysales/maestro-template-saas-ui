import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  budgetText,
  buildReviewPrompt,
  callContractJudge,
  contractReviewVerdictExitCode,
  formatContractVerdict,
  infrastructureBlockedVerdict,
  isContractReviewProviderQuotaOutput,
  parseContractVerdict,
  prioritizeReviewFiles,
  reviewFilesFromDiff,
  selectContractReviewProvider,
  sourceFilesFromDiff,
} from "./contract-review.mts";
import type { ContractInputs } from "./contract-review.mts";
import { hasMode } from "./src/script-mode.mts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function runContractScript(
  args: readonly string[],
  env: Record<string, string>,
): SpawnSyncReturns<string> {
  return spawnSync(
    "pnpm",
    ["exec", "tsx", "tooling/quality/contract-review.mts", ...args],
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
    CONTRACT_REVIEW_PROVIDER: "",
    CONTRACT_REVIEW_OPENAI_MODEL: "",
    CONTRACT_REVIEW_OPENROUTER_MODEL: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...env })) {
    vi.stubEnv(key, value);
  }
}

const VALID_FINDING = {
  severity: "red",
  path: "packages/convex/schema.ts",
  line: 42,
  issue: "Schema imports a capability.",
  contract: "layer law",
  fix: "Move the dependency below schema.",
  clause: "LAYER_LAW",
  confidence: "high",
  mechanicalGateCandidate: "depcruise",
  applyability: "exact",
} as const;

function contractInputs(overrides: Partial<ContractInputs>): ContractInputs {
  return {
    agents: "agents contract",
    architecture: "architecture notes",
    rubric: "rubric",
    diff: "diff",
    changedFiles: [],
    currentFiles: "",
    gateConfig: "gate config",
    ...overrides,
  };
}

describe("contract-review mode flag", () => {
  it("supports fake mode", () => {
    expect(hasMode("fake", ["node", "script", "--mode", "fake"])).toBe(true);
  });

  it("rejects missing fake mode", () => {
    expect(hasMode("fake", ["node", "script"])).toBe(false);
  });
});

describe("contract verdict parsing", () => {
  it("parses a clean pass verdict", () => {
    const verdict = parseContractVerdict('{"verdict":"pass","findings":[]}');
    expect(verdict.verdict).toBe("pass");
    expect(verdict.findings).toHaveLength(0);
  });

  it("parses a blocking verdict with full finding metadata", () => {
    const verdict = parseContractVerdict(
      JSON.stringify({ verdict: "block", findings: [VALID_FINDING] }),
    );
    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]).toEqual(VALID_FINDING);
  });

  it("blocks a pass verdict that still carries findings", () => {
    const verdict = parseContractVerdict(
      JSON.stringify({ verdict: "pass", findings: [VALID_FINDING] }),
    );
    expect(verdict.verdict).toBe("block");
  });

  it("fails closed on findings missing required metadata", () => {
    const verdict = parseContractVerdict(
      JSON.stringify({
        verdict: "block",
        findings: [{ severity: "red", path: "a.ts", line: 1, issue: "x" }],
      }),
    );
    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]?.clause).toBe("JUDGE_OUTPUT");
    expect(verdict.findings[0]?.issue).toMatch(/missing required metadata/);
  });

  it("classifies empty judge output as infrastructure-blocked", () => {
    const verdict = parseContractVerdict("");
    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]?.clause).toBe("CONTRACT_REVIEW_INFRASTRUCTURE");
    expect(verdict.findings[0]?.issue).toMatch(/returned no output/);
  });

  it("classifies truncated JSON as infrastructure-blocked", () => {
    const verdict = parseContractVerdict('{"verdict":"pass","findings":[');
    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]?.issue).toMatch(/truncated JSON/);
  });

  it("unwraps doubled outer braces from sloppy judge output", () => {
    const verdict = parseContractVerdict('{{"verdict":"pass","findings":[]}}');
    expect(verdict.verdict).toBe("pass");
  });

  it("repairs single-quoted and unquoted-key judge JSON", () => {
    const verdict = parseContractVerdict("{verdict: 'pass', findings: []}");
    expect(verdict.verdict).toBe("pass");
  });

  it("strips json code fences before parsing", () => {
    const verdict = parseContractVerdict(
      '```json\n{"verdict":"pass","findings":[]}\n```',
    );
    expect(verdict.verdict).toBe("pass");
  });

  it("fails closed on prose that never becomes JSON", () => {
    const verdict = parseContractVerdict("looks good to me!");
    expect(verdict.verdict).toBe("block");
    expect(verdict.findings[0]?.clause).toBe("JUDGE_OUTPUT");
  });
});

describe("contract verdict exit codes", () => {
  it("exits 0 only for pass verdicts", () => {
    expect(
      contractReviewVerdictExitCode({ verdict: "pass", findings: [] }),
    ).toBe(0);
    expect(
      contractReviewVerdictExitCode({
        verdict: "block",
        findings: [VALID_FINDING],
      }),
    ).toBe(1);
  });

  it("fails closed even for provider infrastructure blocks", () => {
    const verdict = infrastructureBlockedVerdict(
      "OpenRouter provider quota or rate limit prevented contract-review from judging the PR.",
      "Restore the key and rerun.",
    );
    expect(contractReviewVerdictExitCode(verdict)).toBe(1);
  });
});

describe("contract provider quota classification", () => {
  it("classifies provider quota output as infrastructure", () => {
    expect(
      isContractReviewProviderQuotaOutput(
        'OpenRouter 402: {"error":{"message":"Insufficient credits"}}',
      ),
    ).toBe(true);
    expect(
      isContractReviewProviderQuotaOutput(
        'OpenAI 429: {"error":{"code":"insufficient_quota"}}',
      ),
    ).toBe(true);
    expect(
      isContractReviewProviderQuotaOutput('{"verdict":"pass","findings":[]}'),
    ).toBe(false);
  });
});

describe("contract provider selection", () => {
  it("prefers OpenRouter and honors model env overrides", () => {
    expect(
      selectContractReviewProvider({
        OPENROUTER_API_KEY: "openrouter-token",
        OPENAI_API_KEY: "openai-token",
      }),
    ).toEqual({ kind: "openrouter", model: "deepseek/deepseek-v4-pro" });
    expect(
      selectContractReviewProvider({
        OPENROUTER_API_KEY: "openrouter-token",
        CONTRACT_REVIEW_OPENROUTER_MODEL: "vendor/contract-model",
      }),
    ).toEqual({ kind: "openrouter", model: "vendor/contract-model" });
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is present", () => {
    expect(
      selectContractReviewProvider({ OPENAI_API_KEY: "openai-token" }),
    ).toEqual({ kind: "openai", model: "gpt-5.5" });
  });

  it("fails closed for an overridden provider without its key", () => {
    expect(
      selectContractReviewProvider({
        OPENAI_API_KEY: "openai-token",
        CONTRACT_REVIEW_PROVIDER: "openrouter",
      }),
    ).toBeNull();
    expect(selectContractReviewProvider({})).toBeNull();
  });
});

describe("contract review lanes", () => {
  it("keeps only non-test product source files", () => {
    expect(
      sourceFilesFromDiff([
        "packages/convex/domain/score.ts",
        "packages/convex/domain/score.test.ts",
        "apps/web/app/page.tsx",
        "docs/template/coding-standards.md",
        "packages/convex/_generated/api.ts",
      ]),
    ).toEqual(["packages/convex/domain/score.ts", "apps/web/app/page.tsx"]);
  });

  it("labels changed files by review lane", () => {
    expect(
      reviewFilesFromDiff([
        "packages/convex/domain/score.ts",
        "packages/convex/domain/score.test.ts",
        "tooling/quality/contract-review.mts",
        "tooling/ci/taste.sh",
        "AGENTS.md",
        "docs/template/coding-standards.md",
        "README.txt",
      ]),
    ).toEqual([
      "product: packages/convex/domain/score.ts",
      "test: packages/convex/domain/score.test.ts",
      "meta-gate: tooling/quality/contract-review.mts",
      "meta-gate: tooling/ci/taste.sh",
      "contract-doc: AGENTS.md",
      "contract-doc: docs/template/coding-standards.md",
    ]);
  });

  it("prioritizes reviewer self-changes and CI scripts first", () => {
    expect(
      prioritizeReviewFiles([
        "contract-doc: AGENTS.md",
        "test: apps/web/app/page.test.tsx",
        "product: apps/web/app/page.tsx",
        "meta-gate: tooling/ci/taste.sh",
        "meta-gate: tooling/quality/contract-review.mts",
      ]),
    ).toEqual([
      "meta-gate: tooling/quality/contract-review.mts",
      "meta-gate: tooling/ci/taste.sh",
      "product: apps/web/app/page.tsx",
      "test: apps/web/app/page.test.tsx",
      "contract-doc: AGENTS.md",
    ]);
  });
});

describe("contract packet budgeting", () => {
  it("returns short values unchanged", () => {
    expect(budgetText("label", "short", 100)).toBe("short");
  });

  it("keeps head and tail evidence with a truncation marker", () => {
    const value = `${"a".repeat(600)}${"z".repeat(600)}`;
    const budgeted = budgetText("PR diff", value, 400);
    expect(budgeted.length).toBeLessThanOrEqual(400);
    expect(budgeted).toContain("[PR diff truncated:");
    expect(budgeted.startsWith("a")).toBe(true);
    expect(budgeted.endsWith("z")).toBe(true);
  });

  it("builds a review prompt containing every packet section", () => {
    const prompt = buildReviewPrompt(
      contractInputs({
        agents: "AGENTS CONTRACT BODY",
        rubric: "RUBRIC BODY",
        diff: "DIFF BODY",
        changedFiles: ["product: apps/web/app/page.tsx"],
        currentFiles: "## apps/web/app/page.tsx\ncontent",
        gateConfig: "GATE CONFIG BODY",
      }),
    );

    expect(prompt).toContain("AGENTS CONTRACT BODY");
    expect(prompt).toContain("RUBRIC BODY");
    expect(prompt).toContain("DIFF BODY");
    expect(prompt).toContain("- product: apps/web/app/page.tsx");
    expect(prompt).toContain("GATE CONFIG BODY");
    expect(prompt).toContain('{"verdict":"pass"|"block"');
    expect(prompt).toContain("untrusted data");
  });

  it("budgets oversized packet sections inside the prompt", () => {
    const prompt = buildReviewPrompt(
      contractInputs({ diff: "d".repeat(50_000) }),
    );
    expect(prompt).toContain("[PR diff truncated:");
    expect(prompt.length).toBeLessThan(60_000);
  });
});

describe("contract judge calls", () => {
  it("uses OpenRouter and falls back to OpenAI on quota blocks", async () => {
    stubProviderEnv({
      OPENROUTER_API_KEY: "openrouter-token",
      OPENAI_API_KEY: "openai-token",
    });
    const urls: string[] = [];
    vi.stubGlobal("fetch", (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("openrouter.ai")) {
        return new Response(
          '{"error":{"message":"Insufficient credits","code":402}}',
          { status: 402 },
        );
      }
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      return Response.json({
        choices: [{ message: { content: '{"verdict":"pass","findings":[]}' } }],
      });
    }) as typeof fetch);

    const raw = await callContractJudge("packet");

    expect(parseContractVerdict(raw).verdict).toBe("pass");
    expect(urls).toEqual([
      "https://openrouter.ai/api/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ]);
  });

  it("fails closed when no provider is configured", async () => {
    stubProviderEnv({});
    await expect(callContractJudge("packet")).rejects.toThrow(/not configured/);
  });
});

describe("contract-review CLI fail-closed behavior", () => {
  it(
    "emits a blocking JSON marker and exits 1 in CI without provider keys",
    { timeout: 120_000 },
    () => {
      const result = runContractScript([], {
        CI: "true",
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "",
        CONTRACT_REVIEW_PROVIDER: "",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toMatch(/^CONTRACT_VERDICT_JSON=/m);
      expect(result.stdout).toMatch(/"verdict":"block"/);
      expect(result.stderr).toMatch(/no AI provider is configured/);
    },
  );

  it(
    "emits a deterministic parseable pass verdict in fake mode",
    { timeout: 120_000 },
    () => {
      const result = runContractScript(["--mode", "fake"], {
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "",
        CONTRACT_REVIEW_PROVIDER: "",
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "contract-review: verdict=pass reason=fake-mode",
      );
      expect(result.stdout).toMatch(
        /^CONTRACT_VERDICT_JSON=\{"verdict":"pass","findings":\[\]\}$/m,
      );
    },
  );

  it("formats verdicts as single-line JSON for the log marker", () => {
    expect(formatContractVerdict({ verdict: "pass", findings: [] })).toBe(
      '{"verdict":"pass","findings":[]}',
    );
  });
});
