import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CUCUMBER_CONFIGURATION_SOURCE,
  validateCucumberConfigurationSource,
  validateCucumberPackageVersions,
} from "./check-contracts.mts";

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
