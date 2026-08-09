import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkAgentPack } from "./check-agent-pack.mts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("check:agent-pack", () => {
  it("accepts exact root Maestro projections without MCP configuration", async () => {
    const fixtureRoot = await integratedFixture();
    const findings = await checkAgentPack(fixtureRoot);
    expect(
      findings.filter((finding) => finding.startsWith("factory-wiring:")),
    ).toEqual([]);
  });

  it("rejects drift in both root skill projections", async () => {
    const fixtureRoot = await integratedFixture();
    for (const skill of ["maestro", "maestro-convex"]) {
      const target = join(fixtureRoot, ".agents/skills", skill, "SKILL.md");
      await writeFile(target, `${await readFile(target, "utf8")}drift\n`);
    }

    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "drift:.agents/skills/maestro/SKILL.md",
        "drift:.agents/skills/maestro-convex/SKILL.md",
      ]),
    );
  });

  it("rejects root MCP configuration beyond the exact Maestro projection", async () => {
    const fixtureRoot = await integratedFixture();
    await writeFile(join(fixtureRoot, ".mcp.json"), "{}\n");
    await writeFile(
      join(fixtureRoot, ".codex/config.toml"),
      `${await readFile(join(fixtureRoot, ".codex/config.toml"), "utf8")}\n[mcp_servers.convex]\ncommand = "convex"\n`,
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "forbidden-mcp-config:.mcp.json",
        "forbidden-mcp-config:.codex/config.toml",
      ]),
    );
  });

  it("rejects drift in the canonical factory invocation", async () => {
    const fixtureRoot = await integratedFixture();
    const rootPackagePath = join(fixtureRoot, "package.json");
    const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
    rootPackage.scripts.maestro = "tsx tooling/generators/src/index.ts";
    await writeFile(rootPackagePath, JSON.stringify(rootPackage));

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:root-maestro-script",
    );
  });

  it("rejects reintroduced Just and stack authorities", async () => {
    const fixtureRoot = await integratedFixture();
    const cliPackagePath = join(fixtureRoot, "apps/cli/package.json");
    const cliPackage = JSON.parse(await readFile(cliPackagePath, "utf8"));
    cliPackage.dependencies["@maestro-template/stack-tooling"] = "workspace:*";
    await writeFile(cliPackagePath, JSON.stringify(cliPackage));
    await writeFile(
      join(fixtureRoot, "Justfile"),
      "verify:\n    pnpm verify\n",
    );
    await mkdir(join(fixtureRoot, "tooling/stack"), { recursive: true });
    await writeFile(join(fixtureRoot, "tooling/stack/package.json"), "{}\n");

    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "factory-wiring:cli-agent-pack-dependency",
        "factory-wiring:obsolete-just-authority",
        "factory-wiring:obsolete-stack-authority",
      ]),
    );
  });

  it("rejects a factory adapter that bypasses the shared executor", async () => {
    const fixtureRoot = await integratedFixture();
    await writeFile(
      join(fixtureRoot, "apps/cli/src/factory/router.ts"),
      "export const dispatchFactoryCliCommand = async () => undefined;\n",
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects a CLI index that bypasses the singleton handler registry", async () => {
    const fixtureRoot = await integratedFixture();
    const indexPath = join(fixtureRoot, "apps/cli/src/index.ts");
    await writeFile(
      indexPath,
      (await readFile(indexPath, "utf8")).replace(
        "factoryCliComposition.handlers,",
        "[],",
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects duplicate factory composition construction", async () => {
    const fixtureRoot = await integratedFixture();
    const indexPath = join(fixtureRoot, "apps/cli/src/index.ts");
    await writeFile(
      indexPath,
      (await readFile(indexPath, "utf8")).replace(
        "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
        [
          "const factoryCliComposition = createFactoryCliComposition(() => process.env);",
          "const duplicateFactoryCliComposition = createFactoryCliComposition(() => process.env);",
        ].join("\n"),
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects an unshared factory composition construction", async () => {
    const fixtureRoot = await integratedFixture();
    const indexPath = join(fixtureRoot, "apps/cli/src/index.ts");
    await writeFile(
      indexPath,
      (await readFile(indexPath, "utf8")).replace(
        "factoryCliComposition.handlers,",
        "createFactoryCliComposition(() => process.env).handlers,",
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects ambient environment access inside composition", async () => {
    const fixtureRoot = await integratedFixture();
    const compositionPath = join(
      fixtureRoot,
      "apps/cli/src/factory/composition.ts",
    );
    await writeFile(
      compositionPath,
      `${await readFile(compositionPath, "utf8")}\nconst ambientEnvironment = process.env;\n`,
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects a composition that omits the canonical diagnostic registry", async () => {
    const fixtureRoot = await integratedFixture();
    const compositionPath = join(
      fixtureRoot,
      "apps/cli/src/factory/composition.ts",
    );
    await writeFile(
      compositionPath,
      (await readFile(compositionPath, "utf8")).replace(
        "const descriptors = defineQualityDiagnosticRegistryProjection(\n  defineDiagnosticRegistryProjection,\n);",
        "const descriptors = [];",
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects a start handler that bypasses its JSON-safe output boundary", async () => {
    const fixtureRoot = await integratedFixture();
    const compositionPath = join(
      fixtureRoot,
      "apps/cli/src/factory/composition.ts",
    );
    await writeFile(
      compositionPath,
      (await readFile(compositionPath, "utf8")).replace(
        "createStartCliHandler(start, startOutput)",
        "createStartCliHandler(start)",
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects duplicate composed start construction", async () => {
    const fixtureRoot = await integratedFixture();
    const compositionPath = join(
      fixtureRoot,
      "apps/cli/src/factory/composition.ts",
    );
    await writeFile(
      compositionPath,
      (await readFile(compositionPath, "utf8")).replace(
        "const start = createComposedStartCommand({",
        "const duplicateStart = createComposedStartCommand({} as never);\n  const start = createComposedStartCommand({",
      ),
    );

    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:shared-executor-adapter",
    );
  });

  it("rejects a barrel that omits the readiness and verification APIs", async () => {
    const fixtureRoot = await integratedFixture();
    await writeFile(
      join(fixtureRoot, "tooling/agent-pack/src/index.ts"),
      [
        'export * from "./contracts.js";',
        'export * from "./exitCodes.js";',
        'export * from "./repoContext.js";',
      ].join("\n"),
    );
    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "factory-wiring:agent-pack-barrel",
    );
  });
  it("validates receipt schema versions, examples, and their meaning", async () => {
    const fixtureRoot = await integratedFixture();
    const schemaPath = join(
      fixtureRoot,
      "schemas/maestro-verification-receipt.schema.json",
    );
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    schema.properties.schemaVersion.const = 2;
    await writeFile(schemaPath, JSON.stringify(schema));
    const passPath = join(
      fixtureRoot,
      "docs/template/examples/receipts/pass.json",
    );
    const pass = JSON.parse(await readFile(passPath, "utf8"));
    pass.gates[0].status = "fail";
    await writeFile(passPath, JSON.stringify(pass));
    await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
      expect.arrayContaining([
        "verification-receipt:schema-version",
        expect.stringContaining(
          "verification-receipt:invalid-example:pass.json",
        ),
      ]),
    );
  });
  it("enforces closed discriminated verification receipt scopes", async () => {
    for (const scope of [
      { kind: "full", changedPaths: [], partial: false },
      {
        kind: "focused",
        changedPaths: ["tooling/agent-pack/src/receipt.ts"],
        partial: true,
      },
    ]) {
      const fixtureRoot = await integratedFixture();
      const passPath = join(
        fixtureRoot,
        "docs/template/examples/receipts/pass.json",
      );
      const pass = JSON.parse(await readFile(passPath, "utf8"));
      pass.scope = scope;
      await writeFile(passPath, JSON.stringify(pass));

      await expect(checkAgentPack(fixtureRoot)).resolves.not.toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "verification-receipt:invalid-example:pass.json",
          ),
        ]),
      );
    }

    for (const scope of [
      { kind: "full", changedPaths: [], partial: true },
      { kind: "focused", changedPaths: [], partial: false },
      {
        kind: "full",
        changedPaths: ["tooling/agent-pack/src/receipt.ts"],
        partial: false,
      },
      { kind: "full", changedPaths: [], partial: false, extra: true },
    ]) {
      const fixtureRoot = await integratedFixture();
      const passPath = join(
        fixtureRoot,
        "docs/template/examples/receipts/pass.json",
      );
      const pass = JSON.parse(await readFile(passPath, "utf8"));
      pass.scope = scope;
      await writeFile(passPath, JSON.stringify(pass));

      await expect(checkAgentPack(fixtureRoot)).resolves.toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "verification-receipt:invalid-example:pass.json",
          ),
        ]),
      );
    }
  });
  it("requires onboarding and operator docs to link canonical guidance", async () => {
    const fixtureRoot = await integratedFixture();
    const quickstartPath = join(fixtureRoot, "docs/template/quickstart.md");
    await writeFile(
      quickstartPath,
      (await readFile(quickstartPath, "utf8")).replace("./preflight.md", "#"),
    );
    await expect(checkAgentPack(fixtureRoot)).resolves.toContain(
      "agent-pack-doc-link:docs/template/quickstart.md:./preflight.md",
    );
  });
});

async function integratedFixture(): Promise<string> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "maestro-pack-check-"));
  await cp(join(repoRoot, "agent-pack"), join(fixtureRoot, "agent-pack"), {
    recursive: true,
  });
  await mkdir(join(fixtureRoot, ".agents/skills"), { recursive: true });
  await cp(
    join(fixtureRoot, "agent-pack/skills/maestro"),
    join(fixtureRoot, ".agents/skills/maestro"),
    { recursive: true },
  );
  await cp(
    join(
      fixtureRoot,
      "agent-pack/plugins/maestro-convex/skills/maestro-convex",
    ),
    join(fixtureRoot, ".agents/skills/maestro-convex"),
    { recursive: true },
  );
  await cp(join(repoRoot, "package.json"), join(fixtureRoot, "package.json"));
  await mkdir(join(fixtureRoot, ".codex"), { recursive: true });
  await cp(
    join(repoRoot, ".codex/config.toml"),
    join(fixtureRoot, ".codex/config.toml"),
  );
  await mkdir(join(fixtureRoot, "apps/cli/src/factory"), { recursive: true });
  await cp(
    join(repoRoot, "apps/cli/package.json"),
    join(fixtureRoot, "apps/cli/package.json"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/index.ts"),
    join(fixtureRoot, "apps/cli/src/index.ts"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/factory/router.ts"),
    join(fixtureRoot, "apps/cli/src/factory/router.ts"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/factory/composition.ts"),
    join(fixtureRoot, "apps/cli/src/factory/composition.ts"),
  );
  await cp(
    join(repoRoot, "apps/cli/src/factory/start.ts"),
    join(fixtureRoot, "apps/cli/src/factory/start.ts"),
  );
  await mkdir(join(fixtureRoot, "tooling/agent-pack/src"), { recursive: true });
  await cp(
    join(repoRoot, "tooling/agent-pack/package.json"),
    join(fixtureRoot, "tooling/agent-pack/package.json"),
  );
  await cp(
    join(repoRoot, "tooling/agent-pack/src/index.ts"),
    join(fixtureRoot, "tooling/agent-pack/src/index.ts"),
  );
  await mkdir(join(fixtureRoot, "schemas"), { recursive: true });
  await cp(
    join(repoRoot, "schemas/maestro-verification-receipt.schema.json"),
    join(fixtureRoot, "schemas/maestro-verification-receipt.schema.json"),
  );
  await mkdir(join(fixtureRoot, "docs/template"), { recursive: true });
  for (const doc of [
    "quickstart.md",
    "claude-code-setup.md",
    "codex-setup.md",
    "repo-map.md",
    "reviewer-guide.md",
    "operations-runbook.md",
  ]) {
    await cp(
      join(repoRoot, "docs/template", doc),
      join(fixtureRoot, "docs/template", doc),
    );
  }
  await cp(
    join(repoRoot, "docs/template/examples"),
    join(fixtureRoot, "docs/template/examples"),
    { recursive: true },
  );
  return fixtureRoot;
}
