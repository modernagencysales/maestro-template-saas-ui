import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type EnvManifestVariable = {
  readonly name: string;
  readonly group: string;
  readonly services: readonly string[];
  readonly visibility:
    | "browser-public"
    | "public-config"
    | "server-config"
    | "server-secret"
    | "ci-secret";
  readonly requiredFor: readonly string[];
  readonly fakeExampleAllowed: boolean;
  readonly fakeExample?: string;
  readonly owner: string;
  readonly rotation: string;
  readonly notes: string;
};

type EnvManifest = {
  readonly schemaVersion: number;
  readonly variables: readonly EnvManifestVariable[];
};

type ProjectConfig = {
  readonly environments: Record<
    string,
    {
      readonly requiredSecrets?: readonly string[];
    }
  >;
};

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

const readText = (path: string): string =>
  readFileSync(resolve(repoRoot, path), "utf8");

const readJson = <T,>(path: string): T =>
  JSON.parse(readText(path)) as unknown as T;

const envExampleNames = (): readonly string[] =>
  readText(".env.example")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split("=")[0])
    .filter((name): name is string => Boolean(name));

const quotedEnvNames = (source: string): readonly string[] =>
  Array.from(source.matchAll(/"([A-Z][A-Z0-9_]+)"/g), (match) => match[1])
    .filter((name): name is string => Boolean(name))
    .filter((name) => name.includes("_"));

const providerRequiredEnvNames = (): readonly string[] => {
  const source = readText("packages/integrations/src/index.ts");
  const names = new Set<string>();

  for (const match of source.matchAll(/requiredEnv:\s*\[([\s\S]*?)\]/g)) {
    for (const name of quotedEnvNames(match[1] ?? "")) {
      names.add(name);
    }
  }

  return [...names].sort();
};

const projectConfigRequiredSecretNames = (): readonly string[] => {
  const config = readJson<ProjectConfig>("project.config.json");
  const names = new Set<string>();

  for (const environment of Object.values(config.environments)) {
    for (const name of environment.requiredSecrets ?? []) {
      names.add(name);
    }
  }

  return [...names].sort();
};

const convexConfigEnvNames = (): readonly string[] => {
  const source = readText("packages/convex/convex/convex.config.ts");

  return Array.from(
    source.matchAll(/([A-Z][A-Z0-9_]+):\s*v\.(?:optional\()?string/g),
    (match) => match[1],
  )
    .filter((name): name is string => Boolean(name))
    .sort();
};

const setupSurfaceEnvNames = (): readonly string[] => {
  const source = readText("apps/web/src/features/setup/setup-surface.ts");
  const section = source.match(
    /export const requiredLiveProviderEnv = \[([\s\S]*?)\] as const;/s,
  )?.[1];

  return quotedEnvNames(section ?? "").sort();
};

const envExampleValues = (): ReadonlyMap<string, string> =>
  new Map(
    readText(".env.example")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");

        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      }),
  );

const liveSecretPattern =
  /(sk_live|sk-[A-Za-z0-9]{20,}|whsec_|rk_live|pk_live|ghp_|xox[baprs]-|eyJ[A-Za-z0-9_-]{20,})/;

describe("environment manifest", () => {
  const manifest = readJson<EnvManifest>("docs/template/env-manifest.json");
  const entries = manifest.variables;
  const manifestNames = new Set(entries.map((entry) => entry.name));

  it("is a structured source of truth with unique env names", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(entries.length).toBeGreaterThan(40);
    expect(manifestNames.size).toBe(entries.length);

    for (const entry of entries) {
      expect(entry.group).toMatch(/^[a-z0-9-]+$/);
      expect(entry.services.length).toBeGreaterThan(0);
      expect(entry.requiredFor.length).toBeGreaterThan(0);
      expect(entry.owner).not.toHaveLength(0);
      expect(entry.rotation).not.toHaveLength(0);
      expect(entry.notes).not.toHaveLength(0);

      if (entry.fakeExampleAllowed) {
        expect(entry.fakeExample).toBeTypeOf("string");
      } else {
        expect(entry.fakeExample).toBeUndefined();
      }
    }
  });

  it("covers every value in .env.example", () => {
    for (const name of envExampleNames()) {
      expect(manifestNames, `${name} must be in env-manifest.json`).toContain(
        name,
      );
    }
  });

  it("covers provider descriptors, Convex component env, setup UI, and deploy config", () => {
    const requiredNames = new Set([
      ...providerRequiredEnvNames(),
      ...projectConfigRequiredSecretNames(),
      ...convexConfigEnvNames(),
      ...setupSurfaceEnvNames(),
    ]);

    for (const name of requiredNames) {
      expect(manifestNames, `${name} must be in env-manifest.json`).toContain(
        name,
      );
    }
  });

  it("keeps generators reading the manifest instead of maintaining a parallel provider env list", () => {
    const source = readText("tooling/generators/src/index.ts");

    expect(source).toContain("docs/template/env-manifest.json");
    expect(source).toContain("requiredEnvNamesForProvider");
    expect(source).toContain('email: "mailersend"');
    expect(source).toContain('llm: "openrouter"');
    expect(source).not.toContain("requiredSecretNamesByProvider");
  });

  it("keeps PostHog and storage env names consistent across surfaces", () => {
    const setupEnv = setupSurfaceEnvNames();
    const providerEnv = providerRequiredEnvNames();

    expect(setupEnv).toContain("POSTHOG_PROJECT_TOKEN");
    expect(setupEnv).not.toContain("POSTHOG_API_KEY");
    expect(providerEnv).toEqual(expect.arrayContaining(setupEnv));
    expect(providerEnv).toContain("STORAGE_PUBLIC_BASE_URL");
    expect(providerEnv).toContain("STORAGE_ACCESS_KEY_ID");
    expect(providerEnv).toContain("STORAGE_SECRET_ACCESS_KEY");
    expect(providerEnv).not.toContain("STORAGE_SIGNING_SECRET");
  });

  it("keeps fake examples fake-safe", () => {
    for (const [name, value] of envExampleValues()) {
      expect(
        value,
        `${name} in .env.example must not look like a live secret`,
      ).not.toMatch(liveSecretPattern);
    }

    for (const entry of entries) {
      if (entry.fakeExample) {
        expect(
          entry.fakeExample,
          `${entry.name} fakeExample must not look like a live secret`,
        ).not.toMatch(liveSecretPattern);
      }
    }
  });

  it("links the prose manifest to the machine-readable manifest", () => {
    const docs = readText("docs/template/env-manifest.md");

    expect(docs).toContain("env-manifest.json");
    expect(docs).toContain("machine-readable");
  });

  it("keeps deploy authority trust public and signing authority runtime-only", () => {
    const endpoint = entries.find(
      (entry) => entry.name === "PROMOTION_AUTHORITY_ENDPOINT",
    );
    const trustedRoot = entries.find(
      (entry) => entry.name === "TRUSTED_DEPLOY_ROOT_SHA256",
    );
    const authorityMode = entries.find(
      (entry) => entry.name === "PROMOTION_AUTHORITY_MODE",
    );
    const authorityPrivateKey = entries.find(
      (entry) =>
        entry.name === "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL",
    );
    expect(endpoint).toMatchObject({
      group: "buildkite",
      services: expect.arrayContaining(["ci", "deploy"]),
      visibility: "server-config",
      requiredFor: expect.arrayContaining(["deploy"]),
      fakeExampleAllowed: false,
    });
    expect(trustedRoot).toMatchObject({
      group: "buildkite",
      services: expect.arrayContaining(["ci", "deploy"]),
      visibility: "server-config",
      requiredFor: expect.arrayContaining(["deploy"]),
      fakeExampleAllowed: false,
    });
    expect(authorityMode).toMatchObject({
      group: "deployment-authority",
      services: expect.arrayContaining(["convex", "authority-runtime"]),
      visibility: "server-config",
      requiredFor: ["authority"],
      fakeExampleAllowed: false,
    });
    expect(authorityPrivateKey).toMatchObject({
      group: "deployment-authority",
      services: expect.arrayContaining(["convex", "authority-runtime"]),
      visibility: "server-secret",
      requiredFor: ["authority"],
      fakeExampleAllowed: false,
    });

    const convexConfig = readText("packages/convex/convex/convex.config.ts");
    expect(convexConfig).toContain(
      'PROMOTION_AUTHORITY_MODE: v.optional(v.literal("authority"))',
    );
    expect(convexConfig).toContain(
      "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL: v.optional(v.string())",
    );

    const runbook = readText("docs/template/operations-runbook.md");
    const manifestDocs = readText("docs/template/env-manifest.md");
    for (const docs of [runbook, manifestDocs]) {
      expect(docs).toContain("PROMOTION_AUTHORITY_MODE");
      expect(docs).toContain("PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL");
      expect(docs).toContain("authority");
    }

    const pipeline = readText(".buildkite/pipeline.yml");
    expect(pipeline).not.toContain(
      "PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL",
    );
    expect(pipeline).not.toContain("PROMOTION_AUTHORITY_MODE");
  });
});
