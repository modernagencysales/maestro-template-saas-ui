import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  buildProviderAdapters,
  createProviderAdapter,
  defaultProviderOperation,
  ProviderCallError,
  ProviderConfigError,
  providerConfigReport,
  providerDescriptors,
  redactProviderPayload,
  smokeProviderAdapter,
  validateProviderConfig,
} from "./index";

describe("provider adapter descriptors", () => {
  it("decodes persisted provider errors with Effect 4 schema exits", () => {
    const decode = Schema.decodeUnknownExit(ProviderConfigError);
    const valid = decode({
      _tag: "ProviderConfigError",
      provider: "dodo",
      missingEnv: ["DODO_WEBHOOK_SECRET"],
      invalidEnv: [],
    });
    const invalid = decode({
      _tag: "ProviderConfigError",
      provider: "dodo",
      missingEnv: "DODO_WEBHOOK_SECRET",
      invalidEnv: [],
    });

    expect(Exit.isSuccess(valid)).toBe(true);
    if (Exit.isSuccess(valid)) {
      expect(valid.value).toMatchObject({
        _tag: "ProviderConfigError",
        provider: "dodo",
        missingEnv: ["DODO_WEBHOOK_SECRET"],
      });
    }
    expect(Exit.isFailure(invalid)).toBe(true);
  });

  it("declares every required default provider family", () => {
    expect(providerDescriptors.map((provider) => provider.id)).toEqual([
      "workos",
      "posthog",
      "dodo",
      "email",
      "openrouter",
      "storage",
      "search",
      "flags",
    ]);
    expect(providerDescriptors.every((provider) => provider.fakeMode)).toBe(
      true,
    );
    expect(providerDescriptors.every((provider) => provider.liveMode)).toBe(
      true,
    );
  });

  it("allows fake mode without secrets", () => {
    expect(validateProviderConfig("workos", "fake", {})).toBe(true);
    expect(providerConfigReport("fake", {}).every((entry) => entry.ready)).toBe(
      true,
    );
  });

  it("reports missing live env names without secret values", () => {
    const result = validateProviderConfig("dodo", "live", {
      DODO_API_KEY: "secret-key",
    });

    expect(result).toMatchObject({
      _tag: "ProviderConfigError",
      provider: "dodo",
      missingEnv: ["DODO_WEBHOOK_SECRET"],
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("reports whitespace-contaminated live env names without secret values", () => {
    const result = validateProviderConfig("dodo", "live", {
      DODO_API_KEY: " dodo-secret ",
      DODO_WEBHOOK_SECRET: "webhook-secret",
    });

    expect(result).toMatchObject({
      _tag: "ProviderConfigError",
      provider: "dodo",
      missingEnv: [],
      invalidEnv: ["DODO_API_KEY"],
    });
    expect(JSON.stringify(result)).not.toContain("dodo-secret");
    expect(JSON.stringify(result)).not.toContain("webhook-secret");
  });

  it("redacts provider payload fields by descriptor", () => {
    expect(
      redactProviderPayload("openrouter", {
        apiKey: "secret",
        prompt: "source text",
        model: "example-model",
      }),
    ).toEqual({
      apiKey: "[redacted]",
      prompt: "[redacted]",
      model: "example-model",
    });
  });

  it("constructs fake and test adapters without live secrets", () => {
    const fakeAdapters = buildProviderAdapters("fake", {});
    const testAdapters = buildProviderAdapters("test", {});

    expect(fakeAdapters).toHaveLength(providerDescriptors.length);
    expect(testAdapters).toHaveLength(providerDescriptors.length);
    expect(
      fakeAdapters.every(
        (entry) => !(entry.adapter instanceof ProviderConfigError),
      ),
    ).toBe(true);
    expect(
      testAdapters.every(
        (entry) => !(entry.adapter instanceof ProviderConfigError),
      ),
    ).toBe(true);
  });

  it("constructs live adapters only after required env names are present", () => {
    expect(createProviderAdapter("email", "live", {})).toMatchObject({
      _tag: "ProviderConfigError",
      provider: "email",
      missingEnv: [
        "POSTMARK_SERVER_TOKEN",
        "EMAIL_TRANSACTIONAL_FROM",
        "EMAIL_MARKETING_FROM",
      ],
    });

    const adapter = createProviderAdapter("email", "live", {
      POSTMARK_SERVER_TOKEN: "secret",
      EMAIL_TRANSACTIONAL_FROM: "hello@example.test",
      EMAIL_MARKETING_FROM: "updates@example.test",
    });

    expect(adapter).toMatchObject({
      provider: "email",
      mode: "live",
    });
    expect(JSON.stringify(adapter)).not.toContain("secret");
  });

  it("refuses live adapters with whitespace-contaminated env values", () => {
    expect(
      createProviderAdapter("email", "live", {
        POSTMARK_SERVER_TOKEN: " postmark-secret ",
        EMAIL_TRANSACTIONAL_FROM: "hello@example.test",
        EMAIL_MARKETING_FROM: "updates@example.test",
      }),
    ).toMatchObject({
      _tag: "ProviderConfigError",
      provider: "email",
      missingEnv: [],
      invalidEnv: ["POSTMARK_SERVER_TOKEN"],
    });
  });

  it("runs provider calls through the Effect error channel", async () => {
    const adapter = createProviderAdapter("dodo", "fake", {});

    if (adapter instanceof ProviderConfigError) {
      throw new Error("Expected fake dodo adapter");
    }

    const result = await Effect.runPromise(
      adapter.call({
        operation: "billing.createCheckout",
        workspaceSlug: "acme-demo",
        idempotencyKey: "checkout-001",
        payload: {
          apiKey: "secret",
          customerEmail: "client@example.test",
          plan: "template-plan",
        },
      }),
    );

    expect(result).toEqual({
      provider: "dodo",
      mode: "fake",
      operation: "billing.createCheckout",
      delivery: "fake",
      receiptId: "dodo_fake_billing_createCheckout_001",
      redactedPayload: {
        apiKey: "[redacted]",
        customerEmail: "[redacted]",
        plan: "template-plan",
      },
    });
  });

  it("keeps provider validation failures typed and public-safe", async () => {
    const adapter = createProviderAdapter("dodo", "fake", {});

    if (adapter instanceof ProviderConfigError) {
      throw new Error("Expected fake dodo adapter");
    }

    const result = await Effect.runPromise(
      Effect.result(
        adapter.call({
          operation: "billing.createCheckout",
          workspaceSlug: "acme-demo",
          payload: { customerEmail: "client@example.test" },
        }),
      ),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "ProviderCallError",
        provider: "dodo",
        publicMessage:
          "idempotencyKey is required for billing checkout operations.",
        retryable: false,
      },
    });
  });

  it("rejects malformed billing checkout idempotency keys", async () => {
    const adapter = createProviderAdapter("dodo", "fake", {});

    if (adapter instanceof ProviderConfigError) {
      throw new Error("Expected fake dodo adapter");
    }

    const result = await Effect.runPromise(
      Effect.result(
        adapter.call({
          operation: "billing.createCheckout",
          workspaceSlug: "acme-demo",
          idempotencyKey: " checkout-001 ",
          payload: { customerEmail: "client@example.test" },
        }),
      ),
    );

    expect(result).toMatchObject({
      _tag: "Failure",
      failure: {
        _tag: "ProviderCallError",
        provider: "dodo",
        publicMessage:
          "idempotencyKey must not have leading or trailing whitespace.",
        retryable: false,
      },
    });
  });

  it("smokes every fake provider adapter with redacted receipts", async () => {
    const receipts = await Promise.all(
      providerDescriptors.map((provider) =>
        smokeProviderAdapter(provider.id, "fake", {}),
      ),
    );

    expect(
      receipts.every((receipt) => !(receipt instanceof ProviderCallError)),
    ).toBe(true);
    expect(
      receipts.every((receipt) => !(receipt instanceof ProviderConfigError)),
    ).toBe(true);
    expect(JSON.stringify(receipts)).not.toContain("secret");
    expect(
      receipts.map((receipt) =>
        "operation" in receipt ? receipt.operation : undefined,
      ),
    ).toEqual(
      providerDescriptors.map((provider) =>
        defaultProviderOperation(provider.id),
      ),
    );
  });

  it("includes feature flags in the provider readiness report without live env", () => {
    expect(
      providerConfigReport("live", {}).find((entry) => entry.id === "flags"),
    ).toMatchObject({
      displayName: "Feature Flags",
      ready: true,
      missingEnv: [],
    });
    expect(defaultProviderOperation("flags")).toBe("flags.evaluate");
  });
});
