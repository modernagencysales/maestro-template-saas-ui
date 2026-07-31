import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import {
  createLlmGateway,
  LlmDisabledError,
  LlmProviderConfigError,
} from "./llm";

describe("kill-switch-aware LLM gateway", () => {
  it("denies calls when LLM_DISABLED is true", async () => {
    const gateway = createLlmGateway({
      mode: "fake",
      env: { LLM_DISABLED: "true" },
    });

    const result = await Effect.runPromiseExit(
      gateway.complete({
        workspaceSlug: "acme-demo",
        prompt: "Summarize the approved source set.",
      }),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: { _tag: "LlmDisabledError" },
      },
    });
    const causeText = result._tag === "Failure" ? result.cause.toString() : "";

    expect(causeText).not.toContain("Summarize");
  });

  it("returns deterministic fake completions with spend metadata", async () => {
    const gateway = createLlmGateway({
      mode: "fake",
      env: {},
      now: () => "2026-07-01T00:00:00.000Z",
    });

    const result = await Effect.runPromise(
      gateway.complete({
        workspaceSlug: "acme-demo",
        prompt: "Summarize the approved source set.",
        idempotencyKey: "llm-001",
      }),
    );

    expect(result).toMatchObject({
      provider: "openrouter",
      mode: "fake",
      model: "fake/local-demo",
      text: expect.stringContaining("fake completion"),
      usage: {
        estimatedCents: expect.any(Number) as number,
      },
      receipt: {
        workspaceSlug: "acme-demo",
        idempotencyKey: "llm-001",
        generatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
  });

  it("uses request-scoped model and pricing", async () => {
    const gateway = createLlmGateway({ mode: "fake", env: {} });
    const result = await Effect.runPromise(
      gateway.complete({
        workspaceSlug: "public-evaluation",
        prompt: "Evaluate this idea.",
        model: "cheap/free-model",
        pricing: {
          inputCentsPerMillionTokens: 10,
          outputCentsPerMillionTokens: 40,
          minimumCents: 0,
        },
      }),
    );

    expect(result.model).toBe("cheap/free-model");
    expect(result.usage.estimatedCents).toBeLessThan(1);
  });

  it("rejects a request that exceeds its token ceiling before transport", async () => {
    let transportCalled = false;
    const gateway = createLlmGateway({
      mode: "live",
      env: { OPENROUTER_API_KEY: "test-key" },
      transport: () => {
        transportCalled = true;
        return Effect.succeed({ text: "should not happen" });
      },
    });
    const result = await Effect.runPromiseExit(
      gateway.complete({
        workspaceSlug: "public-evaluation",
        prompt: "x".repeat(100),
        limits: { maxInputTokens: 10, maxOutputTokens: 100 },
      }),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "LlmRequestLimitError" } },
    });
    expect(transportCalled).toBe(false);
  });

  it("rejects malformed idempotency keys before building LLM receipts", async () => {
    const gateway = createLlmGateway({
      mode: "fake",
      env: {},
      now: () => "2026-07-01T00:00:00.000Z",
    });

    const result = await Effect.runPromiseExit(
      gateway.complete({
        workspaceSlug: "acme-demo",
        prompt: "Summarize the approved source set.",
        idempotencyKey: " llm-001 ",
      }),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: {
          _tag: "LlmReceiptValidationError",
          field: "idempotencyKey",
          message:
            "idempotencyKey must not have leading or trailing whitespace.",
        },
      },
    });
  });

  it("reports live provider config errors without leaking env values", async () => {
    const gateway = createLlmGateway({
      mode: "live",
      env: { OPENROUTER_API_KEY: "" },
    });

    const result = await Effect.runPromiseExit(
      gateway.complete({
        workspaceSlug: "acme-demo",
        prompt: "Private client source text.",
      }),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: {
          _tag: "LlmProviderConfigError",
          missingEnv: ["OPENROUTER_API_KEY"],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("Private client source text");
  });

  it("redacts provider payload when live transport fails", async () => {
    const fakeProviderKey = `fake-openrouter-${"x".repeat(8)}`;
    const gateway = createLlmGateway({
      mode: "live",
      env: { OPENROUTER_API_KEY: fakeProviderKey },
      transport: () =>
        Effect.fail(
          new Error(
            `provider rejected apiKey=${fakeProviderKey} prompt=private`,
          ),
        ),
    });

    const result = await Effect.runPromiseExit(
      gateway.complete({
        workspaceSlug: "acme-demo",
        prompt: "private prompt",
      }),
    );

    expect(JSON.stringify(result)).not.toContain("secret-openrouter-key");
    expect(JSON.stringify(result)).not.toContain("private prompt");
    expect(result).toMatchObject({
      _tag: "Failure",
      cause: {
        _tag: "Fail",
        error: {
          _tag: "LlmProviderCallError",
          redactedPayload: {
            apiKey: "[redacted]",
            prompt: "[redacted]",
          },
        },
      },
    });
  });

  it("keeps telemetry failures non-fatal", async () => {
    const gateway = createLlmGateway({
      mode: "fake",
      env: {},
      captureTelemetry: () => {
        throw new Error("telemetry unavailable");
      },
    });

    await expect(
      Effect.runPromise(
        gateway.complete({
          workspaceSlug: "acme-demo",
          prompt: "Summarize the approved source set.",
        }),
      ),
    ).resolves.toMatchObject({
      provider: "openrouter",
      mode: "fake",
    });
  });

  it("exposes typed gateway errors for callers", () => {
    expect(new LlmDisabledError({ provider: "openrouter" })).toMatchObject({
      _tag: "LlmDisabledError",
    });
    expect(
      new LlmProviderConfigError({
        provider: "openrouter",
        missingEnv: ["OPENROUTER_API_KEY"],
      }),
    ).toMatchObject({
      _tag: "LlmProviderConfigError",
    });
  });
});
