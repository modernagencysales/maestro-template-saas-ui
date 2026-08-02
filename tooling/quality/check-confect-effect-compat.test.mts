import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { collectConfectEffectCompatibilityFindings } from "./check-confect-effect-compat.mts";

const writeJson = async (
  repoRoot: string,
  file: string,
  packageJson: Record<string, unknown>,
) => {
  await mkdir(join(repoRoot, file, ".."), { recursive: true });
  await writeFile(join(repoRoot, file), JSON.stringify(packageJson, null, 2));
};

const writeSource = async (repoRoot: string, file: string, source: string) => {
  await mkdir(join(repoRoot, file, ".."), { recursive: true });
  await writeFile(join(repoRoot, file), source);
};

const makeRepo = async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "confect-effect-compat-"));
  await writeJson(repoRoot, "package.json", {
    devDependencies: { "@effect/language-service": "0.87.1" },
  });
  await writeJson(repoRoot, "packages/convex/package.json", {
    dependencies: {
      "@confect/core": "10.0.0-next.9",
      "@confect/server": "10.0.0-next.9",
      "@confect/test": "10.0.0-next.9",
      "@confect/cli": "10.0.0-next.9",
      "@effect/platform-node": "4.0.0-beta.102",
      effect: "4.0.0-beta.102",
      ioredis: "5.11.1",
    },
  });
  await writeJson(repoRoot, "apps/web/package.json", {
    dependencies: {
      "@confect/react": "10.0.0-next.9",
      effect: "4.0.0-beta.102",
    },
  });
  await writeJson(repoRoot, "apps/cli/package.json", {
    dependencies: {
      "@confect/js": "10.0.0-next.9",
      effect: "4.0.0-beta.102",
    },
  });
  await writeJson(repoRoot, "tooling/effectified-api-proof/package.json", {
    dependencies: {
      "@confect/core": "10.0.0-next.9",
      "@confect/server": "10.0.0-next.9",
      "@confect/test": "10.0.0-next.9",
      effect: "4.0.0-beta.102",
    },
    devDependencies: {
      "@confect/cli": "10.0.0-next.9",
      "@effect/vitest": "4.0.0-beta.102",
    },
  });
  await writeSource(
    repoRoot,
    "packages/convex/confect/tables/pages.ts",
    `import { Table } from "@confect/server";
import * as Schema from "effect/Schema";

export default Table.make(() => Schema.Struct({ title: Schema.String }));
`,
  );
  await writeSource(
    repoRoot,
    "packages/convex/confect/brain/pages.spec.ts",
    `import { FunctionSpec, GroupSpec } from "@confect/server";
import * as Schema from "effect/Schema";

export default GroupSpec.make().addFunction("list", FunctionSpec.publicQuery({
  args: () => Schema.Struct({}),
  returns: () => Schema.Array(Schema.String),
  error: () => Schema.Never,
}));
`,
  );
  await writeSource(
    repoRoot,
    "packages/convex/confect/brain/pages.impl.ts",
    `import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Effect from "effect/Effect";
import databaseSchema from "../_generated/schema";
import spec from "./pages.spec";

const list = FunctionImpl.make(databaseSchema, spec.list, () => Effect.succeed([]));

export default GroupImpl.finalize(GroupImpl.make(databaseSchema, spec).addFunction("list", list));
`,
  );
  return repoRoot;
};

describe("check:confect-effect-compat", () => {
  it("accepts the exact Confect 10 and Effect 4 compatibility cohort", async () => {
    const repoRoot = await makeRepo();

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual([]);
  });

  it("reports package and source-shape violations", async () => {
    const repoRoot = await makeRepo();
    await writeJson(repoRoot, "apps/web/package.json", {
      dependencies: {
        "@confect/react": "10.0.0-next.8",
        effect: "3.21.4",
        "@effect/platform": "0.90.4",
      },
    });
    await writeSource(repoRoot, "packages/convex/confect/spec.ts", "");
    await writeSource(
      repoRoot,
      "packages/convex/confect/brain/pages.spec.ts",
      `import { FunctionSpec, GroupSpec } from "@confect/server";
import { Schema } from "effect";

export default GroupSpec.make("brain").addFunction("list", FunctionSpec.publicQuery({
  args: Schema.Struct({}),
  returns: Schema.Array(Schema.String),
}));
`,
    );
    await writeSource(
      repoRoot,
      "packages/convex/confect/brain/pages.impl.ts",
      `import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "../_generated/api";
import spec from "./pages.spec";

const list = FunctionImpl.make(api, spec.list, () => null);

export default GroupImpl.make(api, spec).addFunction("list", list);
`,
    );
    await writeSource(
      repoRoot,
      "packages/convex/confect/tables/pages.ts",
      `import { Table } from "@confect/server";

export default Table.make("pages", () => ({}));
`,
    );

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "package.json",
          message: expect.stringContaining(
            "All @confect/* packages must be exactly 10.0.0-next.9",
          ),
        }),
        expect.objectContaining({
          file: "apps/web/package.json",
          message: expect.stringContaining(
            "effect must be exactly 4.0.0-beta.102",
          ),
        }),
        expect.objectContaining({
          file: "apps/web/package.json",
          message: expect.stringContaining("@effect/platform must be removed"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/spec.ts",
          message: expect.stringContaining("root aggregate"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/pages.spec.ts",
          message: expect.stringContaining("effect barrel"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/pages.spec.ts",
          message: expect.stringContaining("GroupSpec.make"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/pages.spec.ts",
          message: expect.stringContaining("args schema"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/pages.impl.ts",
          message: expect.stringContaining("generated databaseSchema"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/pages.impl.ts",
          message: expect.stringContaining("GroupImpl.finalize"),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/tables/pages.ts",
          message: expect.stringContaining("Table.make(() =>"),
        }),
      ]),
    );
  });

  it("reports mismatched Effect companions and the ioredis peer", async () => {
    const repoRoot = await makeRepo();
    await writeJson(repoRoot, "packages/convex/package.json", {
      dependencies: {
        "@confect/core": "10.0.0-next.9",
        "@confect/server": "10.0.0-next.9",
        "@confect/test": "10.0.0-next.9",
        "@confect/cli": "10.0.0-next.9",
        "@effect/platform-node": "4.0.0-beta.101",
        effect: "4.0.0-beta.102",
      },
    });
    await writeJson(repoRoot, "tooling/effectified-api-proof/package.json", {
      dependencies: {
        "@confect/core": "10.0.0-next.9",
        "@confect/server": "10.0.0-next.9",
        "@confect/test": "10.0.0-next.9",
        effect: "4.0.0-beta.102",
      },
      devDependencies: {
        "@confect/cli": "10.0.0-next.9",
        "@effect/vitest": "4.0.0-beta.101",
      },
    });
    await writeJson(repoRoot, "package.json", {
      devDependencies: { "@effect/language-service": "0.86.3" },
    });

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "packages/convex/package.json",
          message: expect.stringContaining(
            "@effect/platform-node must be exactly 4.0.0-beta.102",
          ),
        }),
        expect.objectContaining({
          file: "packages/convex/package.json",
          message: expect.stringContaining("ioredis must be exactly 5.11.1"),
        }),
        expect.objectContaining({
          file: "tooling/effectified-api-proof/package.json",
          message: expect.stringContaining(
            "@effect/vitest must be exactly 4.0.0-beta.102",
          ),
        }),
        expect.objectContaining({
          file: "package.json",
          message: expect.stringContaining(
            "@effect/language-service must be exactly 0.87.1",
          ),
        }),
      ]),
    );
  });

  it("rejects obsolete packages, patch mappings, and repos imports", async () => {
    const repoRoot = await makeRepo();
    await writeJson(repoRoot, "apps/cli/package.json", {
      dependencies: {
        "@confect/js": "10.0.0-next.9",
        "@effect/cluster": "0.37.3",
        "@effect/platform-node": "4.0.0-beta.102",
        effect: "4.0.0-beta.102",
      },
    });
    await writeSource(
      repoRoot,
      "pnpm-workspace.yaml",
      `patchedDependencies:\n  "@confect/cli@9.1.5": patches/@confect__cli@9.1.5.patch\n`,
    );
    await writeSource(
      repoRoot,
      "packages/convex/confect/brain/invalid.ts",
      `import { Result } from "../../../../../repos/effect/packages/effect/src/Result";\nexport { Result };\n`,
    );

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "apps/cli/package.json",
          message: expect.stringContaining("@effect/cluster must be removed"),
        }),
        expect.objectContaining({
          file: "apps/cli/package.json",
          message: expect.stringContaining(
            "@effect/platform-node must be pinned only in packages/convex",
          ),
        }),
        expect.objectContaining({
          file: "pnpm-workspace.yaml",
          message: expect.stringContaining(
            "9.1.5 patch mapping must be removed",
          ),
        }),
        expect.objectContaining({
          file: "packages/convex/confect/brain/invalid.ts",
          message: expect.stringContaining("must not import from repos/*"),
        }),
      ]),
    );
  });

  it("rejects incompatible runtimes resolved only in the lockfile", async () => {
    const repoRoot = await makeRepo();
    await writeSource(
      repoRoot,
      "pnpm-lock.yaml",
      `lockfileVersion: '9.0'\npackages:\n  effect@3.21.4: {}\n  '@effect/platform@0.96.2': {}\n  '@effect/platform-node-shared@4.0.0-beta.101': {}\n`,
    );

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "pnpm-lock.yaml",
          message: expect.stringContaining("Effect 3 runtime"),
        }),
        expect.objectContaining({
          file: "pnpm-lock.yaml",
          message: expect.stringContaining("@effect/platform@"),
        }),
        expect.objectContaining({
          file: "pnpm-lock.yaml",
          message: expect.stringContaining(
            "@effect/platform-node-shared must resolve to 4.0.0-beta.102",
          ),
        }),
      ]),
    );
  });

  it("rejects stale compatibility vocabulary in active source and docs", async () => {
    const repoRoot = await makeRepo();
    await writeSource(
      repoRoot,
      "apps/web/src/stale.ts",
      'import * as Either from "effect/Either";\nexport { Either };\n',
    );
    await writeSource(
      repoRoot,
      "tooling/effectified-api-proof/confect-v9-proof.ts",
      "export const stale = true;\n",
    );
    await writeSource(
      repoRoot,
      "docs/template/confect-effect-guide.md",
      "Confect v9 uses 9.1.5 with Effect 3.21.4 and check:confect-v9.\n",
    );

    expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "apps/web/src/stale.ts",
          message: expect.stringContaining("removed Effect/Confect API"),
        }),
        expect.objectContaining({
          file: "tooling/effectified-api-proof/confect-v9-proof.ts",
          message: expect.stringContaining("version-neutral proof name"),
        }),
        expect.objectContaining({
          file: "docs/template/confect-effect-guide.md",
          message: expect.stringContaining("stale compatibility vocabulary"),
        }),
      ]),
    );
  });
});
