import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";
import {
  createLlmGateway,
  LlmDisabledError,
  LlmProviderConfigError,
} from "./llm";

const expectFailure = <E>(exit: Exit.Exit<unknown, E>): E => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected Effect failure");
  }

  const error = Cause.findError(exit.cause);
  expect(Result.isSuccess(error)).toBe(true);
  if (Result.isFailure(error)) {
    throw new Error("Expected typed failure in Effect cause");
  }

  return error.success;
};

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

    expect(expectFailure(result)).toMatchObject({ _tag: "LlmDisabledError" });
    const causeText = Exit.isFailure(result) ? Cause.pretty(result.cause) : "";

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

    expect(expectFailure(result)).toMatchObject({
      _tag: "LlmReceiptValidationError",
      field: "idempotencyKey",
      message: "idempotencyKey must not have leading or trailing whitespace.",
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

    expect(expectFailure(result)).toMatchObject({
      _tag: "LlmProviderConfigError",
      missingEnv: ["OPENROUTER_API_KEY"],
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
    expect(expectFailure(result)).toMatchObject({
      _tag: "LlmProviderCallError",
      redactedPayload: {
        apiKey: "[redacted]",
        prompt: "[redacted]",
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
