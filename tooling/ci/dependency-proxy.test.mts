import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeArchiveEntry,
  assertSafeRegistryUrl,
  validateAllowlistedArtifact,
} from "./dependency-proxy.mts";

const allowlist = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "dependency-allowlist.json"),
    "utf8",
  ),
) as { artifacts: Array<{ package: string; url: string; integrity: string }> };

describe("protected dependency proxy", () => {
  it("pins the three C1 roots to exact registry artifacts", () => {
    expect(allowlist.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          package: "@cucumber/cucumber@13.2.0",
          url: "https://registry.npmjs.org/@cucumber/cucumber/-/cucumber-13.2.0.tgz",
          integrity:
            "sha512-QjhTG6FWVdG66qkj1BGONecAIqEIDx4g+ZnTdaQVmhECDfGPYyfEcBX3k71p/h1YKvWEUWmhol77Y7FZ36pARA==",
        }),
        expect.objectContaining({ package: "@cucumber/gherkin@41.0.0" }),
        expect.objectContaining({ package: "@cucumber/messages@34.0.1" }),
      ]),
    );
  });

  it("rejects credentials, redirects, private destinations and unsafe archives", () => {
    expect(() =>
      assertSafeRegistryUrl("https://user:pass@registry.npmjs.org/x"),
    ).toThrow();
    expect(() => assertSafeRegistryUrl("http://127.0.0.1/x")).toThrow();
    expect(() => assertSafeRegistryUrl("https://example.com/x")).toThrow();
    expect(() => assertSafeArchiveEntry("../controller/secret")).toThrow();
    expect(() =>
      assertSafeArchiveEntry("package/device", "character-device"),
    ).toThrow();
  });

  it("does not let candidate metadata widen the reviewed allowlist", () => {
    expect(() =>
      validateAllowlistedArtifact(allowlist, {
        url: "https://registry.npmjs.org/evil/-/evil-1.0.0.tgz",
        integrity: "sha512-evil",
      }),
    ).toThrow(/not present/u);
  });
});
