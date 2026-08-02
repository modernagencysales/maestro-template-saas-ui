import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  EnvConfigError,
  killSwitchOn,
  loadTemplateRuntimeConfig,
  readOptionalEnv,
  readRequiredEnv,
  requireLiveEnv,
  runWithTemplateRuntimeConfig,
} from "../confect/shared/env";

describe("shared typed env access", () => {
  it("fails missing live secrets with a typed config error", () => {
    expect(() => readRequiredEnv("WORKOS_API_KEY", {})).toThrow(
      /Missing required env: WORKOS_API_KEY/,
    );
    expect(() =>
      Schema.decodeUnknownSync(EnvConfigError)({
        _tag: "EnvConfigError",
        name: "WORKOS_API_KEY",
        reason: "missing",
      }),
    ).not.toThrow();
  });

  it("fails whitespace live secrets", () => {
    expect(() =>
      readRequiredEnv("WORKOS_API_KEY", { WORKOS_API_KEY: "   " }),
    ).toThrow(/Blank required env: WORKOS_API_KEY/);
    expect(() =>
      Schema.decodeUnknownSync(EnvConfigError)({
        _tag: "EnvConfigError",
        name: "WORKOS_API_KEY",
        reason: "whitespace",
      }),
    ).not.toThrow();
    expect(() =>
      readRequiredEnv("WORKOS_API_KEY", { WORKOS_API_KEY: " test_key " }),
    ).toThrow(/Whitespace-contaminated required env: WORKOS_API_KEY/);
  });

  it("does not require live secrets in fake mode", () => {
    const result = requireLiveEnv(
      ["WORKOS_API_KEY", "OPENROUTER_API_KEY"],
      "fake",
      {},
    );

    expect(result).toEqual({});
  });

  it("returns trimmed optional values and exact required values", () => {
    expect(
      readOptionalEnv("OPTIONAL_URL", { OPTIONAL_URL: "  https://x.test " }),
    ).toBe("https://x.test");
    expect(
      readRequiredEnv("REQUIRED_URL", { REQUIRED_URL: "https://x.test" }),
    ).toBe("https://x.test");
  });

  it("requires live secrets outside fake mode", () => {
    expect(() =>
      requireLiveEnv(["WORKOS_API_KEY"], "live", {
        WORKOS_API_KEY: "",
      }),
    ).toThrow(/Blank required env: WORKOS_API_KEY/);

    expect(
      requireLiveEnv(["WORKOS_API_KEY"], "test", {
        WORKOS_API_KEY: "test_key",
      }),
    ).toEqual({ WORKOS_API_KEY: "test_key" });
  });

  it("enables the LLM kill switch only for true", () => {
    expect(killSwitchOn({ LLM_DISABLED: "true" })).toBe(true);
    expect(killSwitchOn({ LLM_DISABLED: "TRUE" })).toBe(true);
    expect(killSwitchOn({ LLM_DISABLED: "false" })).toBe(false);
    expect(killSwitchOn({})).toBe(false);
  });
});

describe("TemplateRuntimeConfig", () => {
  it("loads fake localhost defaults when no provider values are set", async () => {
    const previousRuntimeMode = process.env.TEMPLATE_RUNTIME_MODE;
    const previousPublicBaseUrl = process.env.TEMPLATE_PUBLIC_BASE_URL;

    try {
      delete process.env.TEMPLATE_RUNTIME_MODE;
      delete process.env.TEMPLATE_PUBLIC_BASE_URL;

      await expect(
        Effect.runPromise(
          runWithTemplateRuntimeConfig(loadTemplateRuntimeConfig),
        ),
      ).resolves.toEqual({
        runtimeMode: "fake",
        publicBaseUrl: "http://localhost:5173",
      });
    } finally {
      if (previousRuntimeMode === undefined) {
        delete process.env.TEMPLATE_RUNTIME_MODE;
      } else {
        process.env.TEMPLATE_RUNTIME_MODE = previousRuntimeMode;
      }

      if (previousPublicBaseUrl === undefined) {
        delete process.env.TEMPLATE_PUBLIC_BASE_URL;
      } else {
        process.env.TEMPLATE_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
    }
  });

  it("loads ambient process env when no provider is supplied", async () => {
    const previousRuntimeMode = process.env.TEMPLATE_RUNTIME_MODE;
    const previousPublicBaseUrl = process.env.TEMPLATE_PUBLIC_BASE_URL;

    try {
      process.env.TEMPLATE_RUNTIME_MODE = "live";
      process.env.TEMPLATE_PUBLIC_BASE_URL = "https://ambient.example";

      await expect(
        Effect.runPromise(
          runWithTemplateRuntimeConfig(loadTemplateRuntimeConfig),
        ),
      ).resolves.toEqual({
        runtimeMode: "live",
        publicBaseUrl: "https://ambient.example",
      });
    } finally {
      if (previousRuntimeMode === undefined) {
        delete process.env.TEMPLATE_RUNTIME_MODE;
      } else {
        process.env.TEMPLATE_RUNTIME_MODE = previousRuntimeMode;
      }

      if (previousPublicBaseUrl === undefined) {
        delete process.env.TEMPLATE_PUBLIC_BASE_URL;
      } else {
        process.env.TEMPLATE_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
    }
  });

  it("loads provider overrides from the Effect config provider", async () => {
    const provider = ConfigProvider.fromUnknown({
      TEMPLATE_RUNTIME_MODE: "test",
      TEMPLATE_PUBLIC_BASE_URL: "https://client.example",
    });

    await expect(
      Effect.runPromise(
        runWithTemplateRuntimeConfig(loadTemplateRuntimeConfig, provider),
      ),
    ).resolves.toEqual({
      runtimeMode: "test",
      publicBaseUrl: "https://client.example",
    });
  });

  it("fails invalid runtime mode values as Effect config failures", async () => {
    const provider = ConfigProvider.fromUnknown({
      TEMPLATE_RUNTIME_MODE: "bad",
    });

    const result = await Effect.runPromise(
      Effect.result(
        runWithTemplateRuntimeConfig(loadTemplateRuntimeConfig, provider),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(Config.ConfigError);
      expect(String(result.failure)).toContain("TEMPLATE_RUNTIME_MODE");
    }
  });
});
