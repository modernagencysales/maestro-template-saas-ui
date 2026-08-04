import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CUCUMBER_CONFIGURATION_SOURCE,
  resolveAcceptanceRun,
  verifyProtectedBaseFixture,
  validateCucumberConfigurationSource,
  validateCucumberPackageVersions,
  synchronizeAdmittedJourneys,
} from "./check-contracts.mts";

const protectedBaseSha = "a8405dd187645d6e2fa38f52a3ddc4aad15d72f3";
const protectedPolicyPath =
  "packages/convex/confect/capabilities/_kit/authPolicies.ts";

const writeProtectedBaseFixture = async (
  root: string,
  fixture: Record<string, unknown>,
): Promise<void> => {
  const directory = join(root, "tooling/acceptance/fixtures/auth-policy");
  await mkdir(directory, { recursive: true });
  const bytes = `${JSON.stringify(fixture, null, 2)}\n`;
  await Promise.all([
    writeFile(join(directory, "protected-base.json"), bytes),
    writeFile(
      join(directory, "protected-base.digest"),
      `${createHash("sha256").update(bytes).digest("hex")}  protected-base.json\n`,
    ),
  ]);
};

const validConfig = {
  requireModule: ["tsx/cjs"],
  require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
  retry: 0,
  parallel: 0,
} as const;

const addProfileEntry = (entry: string): string =>
  CUCUMBER_CONFIGURATION_SOURCE.replace(
    "    retry: 0,",
    `    ${entry},\n    retry: 0,`,
  );

describe("validateCucumberConfigurationSource", () => {
  it("accepts only the exact protected four-key profile", () => {
    expect(
      validateCucumberConfigurationSource(CUCUMBER_CONFIGURATION_SOURCE),
    ).toEqual({ ok: true, value: validConfig });
  });

  it.each([
    [
      "broad support glob",
      CUCUMBER_CONFIGURATION_SOURCE.replace(
        '"features/support/**/*.ts", "features/step_definitions/**/*.ts"',
        '"features/**/*.ts", "features/step_definitions/**/*.ts"',
      ),
      "features/**/*.ts",
    ],
    [
      "test support glob",
      CUCUMBER_CONFIGURATION_SOURCE.replace(
        '"features/support/**/*.ts", "features/step_definitions/**/*.ts"',
        '"features/support/**/*.ts", "features/**/*.test.ts"',
      ),
      "features/**/*.test.ts",
    ],
    ["paths", addProfileEntry('paths: ["features/selected.feature"]'), "paths"],
    ["tags", addProfileEntry('tags: "@focus"'), "tags"],
    ["name", addProfileEntry('name: "focused"'), "name"],
    ["format", addProfileEntry('format: ["progress"]'), "format"],
    [
      "loader",
      CUCUMBER_CONFIGURATION_SOURCE.replace('"tsx/cjs"', '"ts-node/register"'),
      "ts-node/register",
    ],
    [
      "retry",
      CUCUMBER_CONFIGURATION_SOURCE.replace("retry: 0", "retry: 1"),
      "retry: 1",
    ],
    [
      "parallel",
      CUCUMBER_CONFIGURATION_SOURCE.replace("parallel: 0", "parallel: 1"),
      "parallel: 1",
    ],
  ])("rejects %s with the offending source", (_name, source, offending) => {
    expect(validateCucumberConfigurationSource(source)).toMatchObject({
      ok: false,
      findings: [expect.stringContaining(offending)],
    });
  });

  it.each([
    ["worldParameters", '{ tenant: "candidate" }'],
    ["order", '"random"'],
    ["shard", '"1/2"'],
    ["__proto__", '{ paths: ["candidate.feature"] }'],
    ["madeUp", "true"],
  ])("rejects unknown key %s and reports its value", (key, value) => {
    const result = validateCucumberConfigurationSource(
      addProfileEntry(`${key}: ${value}`),
    );
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("expected configuration rejection");
    expect(result.findings[0]).toContain(key);
    expect(result.findings[0]).toContain(value);
  });

  it.each([
    [
      "comments",
      CUCUMBER_CONFIGURATION_SOURCE.replace(
        "module.exports",
        "// reviewed\nmodule.exports",
      ),
    ],
    [
      "extra executable code",
      `${CUCUMBER_CONFIGURATION_SOURCE}process.exitCode = 0;\n`,
    ],
    [
      "inherited profile",
      CUCUMBER_CONFIGURATION_SOURCE.replace(
        "default: {",
        'default: Object.assign(Object.create({ tags: "@candidate" }), {',
      ).replace("  },\n};", "  }),\n};"),
    ],
  ])("rejects %s without evaluating source", (_name, source) => {
    expect(validateCucumberConfigurationSource(source)).toMatchObject({
      ok: false,
    });
  });
});

describe("validateCucumberPackageVersions", () => {
  const dependencySections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const;
  const root = {
    devDependencies: { "@cucumber/cucumber": "13.2.0" },
  };
  const templateCore = {
    dependencies: {
      "@cucumber/gherkin": "41.0.0",
      "@cucumber/messages": "34.0.1",
    },
  };

  it("accepts the exact runner and compiler package versions in their owners", () => {
    expect(validateCucumberPackageVersions(root, templateCore)).toEqual({
      ok: true,
      versions: {
        "@cucumber/cucumber": "13.2.0",
        "@cucumber/gherkin": "41.0.0",
        "@cucumber/messages": "34.0.1",
      },
    });
  });

  const owners = {
    "@cucumber/cucumber": ["root", "devDependencies"],
    "@cucumber/gherkin": ["template-core", "dependencies"],
    "@cucumber/messages": ["template-core", "dependencies"],
  } as const;
  const versions = {
    "@cucumber/cucumber": "13.2.0",
    "@cucumber/gherkin": "41.0.0",
    "@cucumber/messages": "34.0.1",
  } as const;
  const nonOwningDeclarations = Object.entries(owners).flatMap(
    ([name, [owningManifest, owningSection]]) =>
      (["root", "template-core"] as const).flatMap((manifest) =>
        dependencySections
          .filter(
            (section) =>
              manifest !== owningManifest || section !== owningSection,
          )
          .map((section) => ({
            name: name as keyof typeof versions,
            manifest,
            section,
          })),
      ),
  );
  const addDeclaration = (
    manifest: Record<string, unknown>,
    section: (typeof dependencySections)[number],
    name: keyof typeof versions,
  ): Record<string, unknown> => ({
    ...manifest,
    [section]: {
      ...((manifest[section] as Record<string, unknown> | undefined) ?? {}),
      [name]: versions[name],
    },
  });

  it.each(nonOwningDeclarations)(
    "rejects duplicate $name at $manifest/$section",
    ({ name, manifest, section }) => {
      const rootManifest =
        manifest === "root" ? addDeclaration(root, section, name) : root;
      const coreManifest =
        manifest === "template-core"
          ? addDeclaration(templateCore, section, name)
          : templateCore;
      const result = validateCucumberPackageVersions(
        rootManifest,
        coreManifest,
      );
      expect(result).toMatchObject({ ok: false });
      if (result.ok)
        throw new Error("expected duplicate declaration rejection");
      expect(result.findings.join("\n")).toContain(
        `${manifest}.${section}.${name}`,
      );
    },
  );

  it.each([
    [
      "runner",
      {},
      { ...templateCore, devDependencies: { "@cucumber/cucumber": "13.2.0" } },
      "template-core.devDependencies.@cucumber/cucumber",
    ],
    [
      "gherkin",
      { ...root, optionalDependencies: { "@cucumber/gherkin": "41.0.0" } },
      { dependencies: { "@cucumber/messages": "34.0.1" } },
      "root.optionalDependencies.@cucumber/gherkin",
    ],
    [
      "messages",
      { ...root, peerDependencies: { "@cucumber/messages": "34.0.1" } },
      { dependencies: { "@cucumber/gherkin": "41.0.0" } },
      "root.peerDependencies.@cucumber/messages",
    ],
  ])(
    "rejects %s declared only by a non-owner",
    (_name, rootManifest, coreManifest, finding) => {
      const result = validateCucumberPackageVersions(
        rootManifest,
        coreManifest,
      );
      expect(result).toMatchObject({ ok: false });
      if (result.ok) throw new Error("expected wrong owner rejection");
      expect(result.findings.join("\n")).toContain(finding);
    },
  );

  it.each([
    [
      "runner range",
      { devDependencies: { "@cucumber/cucumber": "^13.2.0" } },
      templateCore,
      "^13.2.0",
    ],
    [
      "runner wrong owner",
      {},
      {
        ...templateCore,
        dependencies: {
          ...templateCore.dependencies,
          "@cucumber/cucumber": "13.2.0",
        },
      },
      "@cucumber/cucumber",
    ],
    [
      "gherkin range",
      root,
      {
        dependencies: {
          ...templateCore.dependencies,
          "@cucumber/gherkin": "~41.0.0",
        },
      },
      "~41.0.0",
    ],
    [
      "messages missing",
      root,
      { dependencies: { "@cucumber/gherkin": "41.0.0" } },
      "@cucumber/messages",
    ],
  ])("rejects %s", (_name, rootManifest, coreManifest, finding) => {
    const result = validateCucumberPackageVersions(rootManifest, coreManifest);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("expected package version rejection");
    expect(result.findings.join("\n")).toContain(finding);
  });
});

const workspaceRoot = join(import.meta.dirname, "../..");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it("keeps configured support when CLI require is additive and never loads candidate support", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".cucumber-resolution-"),
  );
  temporaryRoots.push(fixtureRoot);
  const runRoot = join(fixtureRoot, "controller-run");
  const candidateRoot = join(fixtureRoot, "candidate");
  const configuredMarker = join(fixtureRoot, "configured.marker");
  const additiveMarker = join(fixtureRoot, "additive.marker");
  const stolenMarker = join(fixtureRoot, "stolen.marker");

  await Promise.all([
    mkdir(join(runRoot, "features/support"), { recursive: true }),
    mkdir(join(runRoot, "features/step_definitions"), { recursive: true }),
    mkdir(join(candidateRoot, "features/support"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(runRoot, "cucumber.cjs"), CUCUMBER_CONFIGURATION_SOURCE),
    writeFile(
      join(runRoot, "features/runtime.feature"),
      "Feature: protected resolution\n  Scenario: trusted support only\n    Given trusted support runs\n",
    ),
    writeFile(
      join(runRoot, "features/support/world.ts"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(configuredMarker)}, "loaded");\n`,
    ),
    writeFile(
      join(runRoot, "features/step_definitions/runtime.ts"),
      'import { Given } from "@cucumber/cucumber"; Given("trusted support runs", function () {});\n',
    ),
    writeFile(
      join(runRoot, "additive.ts"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(additiveMarker)}, "loaded");\n`,
    ),
    writeFile(
      join(candidateRoot, "features/support/steal.ts"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(stolenMarker)}, "loaded");\n`,
    ),
  ]);

  const cucumber = join(
    workspaceRoot,
    "node_modules/@cucumber/cucumber/bin/cucumber-js",
  );
  const run = spawnSync(
    process.execPath,
    [cucumber, "--require", "additive.ts", "features/runtime.feature"],
    {
      cwd: runRoot,
      encoding: "utf8",
    },
  );

  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  expect(existsSync(configuredMarker)).toBe(true);
  expect(existsSync(additiveMarker)).toBe(true);
  expect(existsSync(stolenMarker)).toBe(false);
});

it("writes only the byte-exact admitted-journey projection and rejects drift without --write", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".contract-projection-"),
  );
  temporaryRoots.push(fixtureRoot);
  await Promise.all([
    mkdir(join(fixtureRoot, "features"), { recursive: true }),
    mkdir(join(fixtureRoot, "packages/template-core/src/generated"), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeFile(
      join(fixtureRoot, "features/draft.feature"),
      "@journey_draft @assembling\nFeature: Draft\n  @ui @covers_future\n  Scenario: Draft\n    When it runs\n    Then it works\n",
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/public-surfaces.generated.json",
      ),
      '{"surfaces":[]}\n',
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/activation-registration-manifest.json",
      ),
      '{"schemaVersion":1,"registrations":[]}\n',
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/admittedJourneys.ts",
      ),
      "stale\n",
    ),
  ]);

  await expect(
    synchronizeAdmittedJourneys({ root: fixtureRoot, write: false }),
  ).rejects.toThrow(/projection drift/u);
  const first = await synchronizeAdmittedJourneys({
    root: fixtureRoot,
    write: true,
  });
  const path = join(
    fixtureRoot,
    "packages/template-core/src/generated/admittedJourneys.ts",
  );
  const bytes = await readFile(path, "utf8");
  const second = await synchronizeAdmittedJourneys({
    root: fixtureRoot,
    write: true,
  });

  expect(first).toEqual({
    status: "no-admitted-contracts",
    admittedPickles: 0,
    wrote: true,
  });
  expect(second).toEqual(first);
  expect(await readFile(path, "utf8")).toBe(bytes);
  expect(bytes).toContain('"journey_draft": false');
});

it("fails closed when the no-admitted projection has no registration inventory", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".contract-registration-"),
  );
  temporaryRoots.push(fixtureRoot);
  await Promise.all([
    mkdir(join(fixtureRoot, "features"), { recursive: true }),
    mkdir(join(fixtureRoot, "packages/template-core/src/generated"), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeFile(
      join(fixtureRoot, "features/draft.feature"),
      "@journey_draft @assembling\nFeature: Draft\n  @ui @covers_future\n  Scenario: Draft\n    When it runs\n    Then it works\n",
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/public-surfaces.generated.json",
      ),
      '{"surfaces":[]}\n',
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/admittedJourneys.ts",
      ),
      "stale\n",
    ),
  ]);

  await expect(
    synchronizeAdmittedJourneys({ root: fixtureRoot, write: true }),
  ).rejects.toThrow(/registration inventory/u);
});

it("rejects an undeclared activation-owned generated registration", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".contract-registration-mutation-"),
  );
  temporaryRoots.push(fixtureRoot);
  await Promise.all([
    mkdir(join(fixtureRoot, "features"), { recursive: true }),
    mkdir(join(fixtureRoot, "packages/template-core/src/generated"), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    writeFile(
      join(fixtureRoot, "features/draft.feature"),
      "@journey_draft @assembling\nFeature: Draft\n  @ui @covers_draft\n  Scenario: Draft\n    When it runs\n    Then it works\n",
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/public-surfaces.generated.json",
      ),
      JSON.stringify({
        surfaces: [
          {
            id: "draft_ui",
            transport: "ui",
            coverageTag: "@covers_draft",
            activationJourneyId: "journey_draft",
            authPolicyId: "auth_deny_all",
            authority: { kind: "ui-action", registrationLocator: "draft" },
          },
        ],
      }),
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/activation-registration-manifest.json",
      ),
      '{"schemaVersion":1,"registrations":[]}\n',
    ),
    writeFile(
      join(
        fixtureRoot,
        "packages/template-core/src/generated/admittedJourneys.ts",
      ),
      "stale\n",
    ),
  ]);

  await expect(
    synchronizeAdmittedJourneys({ root: fixtureRoot, write: true }),
  ).rejects.toThrow(/registration inventory drift/u);
});

it("accepts an attested immutable base and rejects candidate environment bases", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".controller-attestation-"),
  );
  temporaryRoots.push(fixtureRoot);
  const attestationPath = join(fixtureRoot, "attestation.json");
  const baseSha = "a".repeat(40);
  const key = "controller-test-key";
  await writeFile(join(fixtureRoot, "attestation.key"), key, { mode: 0o600 });
  const issuedAt = Date.now();
  const unsigned = {
    baseSha,
    origin: "protected-controller" as const,
    nonce: "controller-nonce",
    issuedAt,
    expiresAt: issuedAt + 60_000,
  };
  await writeFile(
    attestationPath,
    JSON.stringify({
      ...unsigned,
      signature: createHmac("sha256", key)
        .update(
          JSON.stringify({
            baseSha,
            candidateCommit: null,
            expiresAt: unsigned.expiresAt,
            issuedAt,
            nonce: "controller-nonce",
            origin: "protected-controller",
          }),
        )
        .digest("hex"),
    }),
    { mode: 0o600 },
  );
  const original = {
    attestation: process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE,
    base: process.env.PROTECTED_BASE_SHA,
    origin: process.env.PROTECTED_CONTROLLER_ORIGIN,
  };
  const spoofPath = join(fixtureRoot, "..", "spoof-attestation.json");
  process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE = attestationPath;
  delete process.env.PROTECTED_BASE_SHA;
  delete process.env.PROTECTED_CONTROLLER_ORIGIN;
  try {
    expect(resolveAcceptanceRun(fixtureRoot, fixtureRoot)).toEqual({
      root: fixtureRoot,
      protectedBaseSha: baseSha,
      mode: "authoritative",
    });
    process.env.PROTECTED_BASE_SHA = "origin/main";
    expect(() => resolveAcceptanceRun(fixtureRoot, fixtureRoot)).toThrow(
      /candidate environment/u,
    );
    await writeFile(spoofPath, JSON.stringify({ ...unsigned, signature: "x" }));
    process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE = spoofPath;
    delete process.env.PROTECTED_BASE_SHA;
    expect(() => resolveAcceptanceRun(fixtureRoot, fixtureRoot)).toThrow(
      /unreadable|trusted root/u,
    );
  } finally {
    await rm(spoofPath, { force: true });
    if (original.attestation === undefined)
      delete process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE;
    else
      process.env.PROTECTED_CONTROLLER_ATTESTATION_FILE = original.attestation;
    if (original.base === undefined) delete process.env.PROTECTED_BASE_SHA;
    else process.env.PROTECTED_BASE_SHA = original.base;
    if (original.origin === undefined)
      delete process.env.PROTECTED_CONTROLLER_ORIGIN;
    else process.env.PROTECTED_CONTROLLER_ORIGIN = original.origin;
  }
});

it("rejects a candidate-mutated protected-base fixture path", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".protected-base-path-"),
  );
  temporaryRoots.push(fixtureRoot);
  await writeProtectedBaseFixture(fixtureRoot, {
    schemaVersion: 1,
    baseCommit: protectedBaseSha,
    path: "package.json",
    sha256: "1351ac4a0787d0a814e23644a5c980e985b9f123d1719b7387a8219d3f8a0eb5",
  });

  await expect(
    verifyProtectedBaseFixture(fixtureRoot, protectedBaseSha),
  ).rejects.toThrow(/path|auth-policy material/u);
});

it("rejects a candidate-mutated protected-base fixture SHA", async () => {
  const fixtureRoot = await mkdtemp(
    join(workspaceRoot, ".protected-base-sha-"),
  );
  temporaryRoots.push(fixtureRoot);
  await writeProtectedBaseFixture(fixtureRoot, {
    schemaVersion: 1,
    baseCommit: protectedBaseSha,
    path: protectedPolicyPath,
    sha256: "0".repeat(64),
  });

  await expect(
    verifyProtectedBaseFixture(fixtureRoot, protectedBaseSha),
  ).rejects.toThrow(/digest|auth-policy material/u);
});
