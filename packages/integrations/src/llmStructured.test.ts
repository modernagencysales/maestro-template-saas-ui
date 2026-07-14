import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  createStructuredLlmGateway,
  ModelTimeout,
  ProviderRateLimited,
} from "./llmStructured";

const Decision = Schema.Struct({
  decision: Schema.Literal("capture", "direct", "abstain"),
  confidence: Schema.Number,
});

const baseRequest = {
  workspaceSlug: "acme-demo",
  trustedInstructionVersion: "classify-v1",
  toolSchemaVersion: "routing-v1",
  immutableContentManifest: {
    sourceHash: "sha256:source-001",
    contentHashes: ["sha256:item-001"],
  },
  outputSchema: Decision,
  modelPolicy: {
    provider: "openrouter" as const,
    model: "openrouter/fake-structured",
    region: "us" as const,
    allowedProviders: ["openrouter" as const],
    allowedModels: ["openrouter/fake-structured"],
    allowedRegions: ["us" as const],
    maxInputTokens: 200,
    maxOutputTokens: 100,
    maxSpendCents: 10,
    currentSpendCents: 0,
    retention: "none" as const,
    training: "disabled" as const,
  },
  attemptKey: "attempt-001",
};

describe("structured provider-neutral LLM gateway", () => {
  it("returns schema-decoded fake output with immutable hashes and no prompt text", async () => {
    const gateway = createStructuredLlmGateway({
      mode: "fake",
      env: {},
      now: () => "2026-07-01T00:00:00.000Z",
      fakeStructuredOutput: { decision: "capture", confidence: 0.91 },
    });

    const result = await Effect.runPromise(gateway.generate(baseRequest));

    expect(result).toMatchObject({
      provider: "openrouter",
      model: "openrouter/fake-structured",
      output: { decision: "capture", confidence: 0.91 },
      receipt: {
        attemptKey: "attempt-001",
        state: "succeeded",
        requestHash: expect.stringMatching(/^sha256:/) as string,
        responseHash: expect.stringMatching(/^sha256:/) as string,
        sourceHash: "sha256:source-001",
        generatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(JSON.stringify(result)).not.toContain("Private client source text");
  });

  it("rejects malformed JSON and schema-invalid structured output", async () => {
    const malformed = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: (input) =>
        Effect.succeed({
          provider: input.provider,
          model: input.model,
          region: input.region,
          requestHash: input.requestHash,
          sourceHash: input.sourceHash,
          text: "not json",
          usage: { inputTokens: 5, outputTokens: 5, costCents: 1 },
        }),
    });

    const malformedExit = await Effect.runPromiseExit(
      malformed.generate(baseRequest),
    );
    expect(malformedExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "MalformedModelOutput" } },
    });

    const wrongShape = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: (input) =>
        Effect.succeed({
          provider: input.provider,
          model: input.model,
          region: input.region,
          requestHash: input.requestHash,
          sourceHash: input.sourceHash,
          text: JSON.stringify({ decision: "unknown", confidence: 1 }),
          usage: { inputTokens: 5, outputTokens: 5, costCents: 1 },
        }),
    });

    const wrongShapeExit = await Effect.runPromiseExit(
      wrongShape.generate(baseRequest),
    );
    expect(wrongShapeExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "MalformedModelOutput" } },
    });
  });

  it("rejects receipt mismatches, duplicate responses, timeout, and rate limit as typed errors", async () => {
    const mismatch = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: (input) =>
        Effect.succeed({
          provider: input.provider,
          model: input.model,
          region: input.region,
          requestHash: "sha256:wrong",
          sourceHash: input.sourceHash,
          text: JSON.stringify({ decision: "capture", confidence: 1 }),
          usage: { inputTokens: 5, outputTokens: 5, costCents: 1 },
        }),
    });

    const mismatchExit = await Effect.runPromiseExit(
      mismatch.generate(baseRequest),
    );
    expect(mismatchExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelReceiptMismatch" } },
    });

    const seenAttemptKeys = new Set<string>();
    const duplicate = createStructuredLlmGateway({
      mode: "fake",
      env: {},
      seenAttemptKeys,
      fakeStructuredOutput: { decision: "capture", confidence: 1 },
    });

    await Effect.runPromise(duplicate.generate(baseRequest));
    const duplicateExit = await Effect.runPromiseExit(
      duplicate.generate(baseRequest),
    );
    expect(duplicateExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelReceiptMismatch" } },
    });

    const timeout = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: () =>
        Effect.fail(
          new ModelTimeout({ provider: "openrouter", timeoutMs: 1000 }),
        ),
    });
    const timeoutExit = await Effect.runPromiseExit(
      timeout.generate(baseRequest),
    );
    expect(timeoutExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelTimeout" } },
    });

    const limited = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: () =>
        Effect.fail(
          new ProviderRateLimited({
            provider: "openrouter",
            retryAfterMs: 1000,
          }),
        ),
    });
    const limitedExit = await Effect.runPromiseExit(
      limited.generate(baseRequest),
    );
    expect(limitedExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ProviderRateLimited" } },
    });
  });

  it("enforces spend, token, provider, model, region, and no-retention policy before transport", async () => {
    let calls = 0;
    const gateway = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: () => {
        calls += 1;
        return Effect.die("transport must not run");
      },
    });

    const inputTooLargeExit = await Effect.runPromiseExit(
      gateway.generate({
        ...baseRequest,
        modelPolicy: { ...baseRequest.modelPolicy, maxInputTokens: 1 },
      }),
    );
    expect(inputTooLargeExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelInputTooLarge" } },
    });

    const budgetExit = await Effect.runPromiseExit(
      gateway.generate({
        ...baseRequest,
        modelPolicy: { ...baseRequest.modelPolicy, currentSpendCents: 10 },
      }),
    );
    expect(budgetExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelBudgetExceeded" } },
    });

    const modelDeniedExit = await Effect.runPromiseExit(
      gateway.generate({
        ...baseRequest,
        modelPolicy: {
          ...baseRequest.modelPolicy,
          allowedModels: ["other/model"],
        },
      }),
    );
    expect(modelDeniedExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelPolicyDenied" } },
    });

    const retentionDeniedExit = await Effect.runPromiseExit(
      gateway.generate({
        ...baseRequest,
        modelPolicy: {
          ...baseRequest.modelPolicy,
          retention: "provider-default",
        },
      }),
    );
    expect(retentionDeniedExit).toMatchObject({
      _tag: "Failure",
      cause: { _tag: "Fail", error: { _tag: "ModelPolicyDenied" } },
    });

    expect(calls).toBe(0);
  });

  it("keeps logging canaries redacted from all typed failures", async () => {
    const gateway = createStructuredLlmGateway({
      mode: "test",
      env: {},
      transport: () =>
        Effect.fail(new Error("provider saw Private client source text")),
    });

    const result = await Effect.runPromiseExit(
      gateway.generate({
        ...baseRequest,
        immutableContentManifest: {
          sourceHash: "sha256:source-001",
          contentHashes: ["sha256:item-001"],
          canary: "Private client source text",
        },
      }),
    );

    expect(JSON.stringify(result)).not.toContain("Private client source text");
  });
});
