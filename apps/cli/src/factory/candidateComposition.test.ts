import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildSaasApplicationTargetPlan } from "@maestro-template/generators";
import { afterEach, describe, expect, it } from "vitest";
import { buildCustomerOwnershipInventory } from "../../../../tooling/release/src/customerTarget/ownership";
import {
  ALPHA_2_SOURCE,
  createCustomerCreateComposition,
  type CustomerCompositionSource,
} from "./createComposition";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const temporaryRoots: string[] = [];
const offlinePnpmBin = "/private/tmp/maestro-pnpm-10-bin";
const installedStoreDir = readFileSync(
  join(repositoryRoot, "node_modules/.modules.yaml"),
  "utf8",
).match(/^storeDir: (.+)$/m)?.[1];

const hash = (bytes: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const candidateEnvironment = (): NodeJS.ProcessEnv => ({
  ...process.env,
  PATH: `${offlinePnpmBin}:${process.env.PATH ?? ""}`,
  TMPDIR: "/private/tmp",
  npm_config_store_dir: installedStoreDir,
});

const writeJson = (path: string, value: unknown): Buffer => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes);
  return bytes;
};

const git = (repository: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", repository, ...args], {
    maxBuffer: 512 * 1024 * 1024,
  });

const buildCandidateReleaseFixture = (input: {
  readonly name: string;
  readonly outcome: string;
}) => {
  const parent = mkdtempSync(join(tmpdir(), "maestro-candidate-composition-"));
  temporaryRoots.push(parent);
  const candidateRoot = join(parent, "candidate");
  const targetRoot = join(parent, "customer");
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--shared",
      "--no-tags",
      repositoryRoot,
      candidateRoot,
    ],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const authorityRoot = join(candidateRoot, ".candidate-authority");
  appendFileSync(
    join(candidateRoot, ".git/info/exclude"),
    "\n.candidate-authority/\n",
  );
  mkdirSync(authorityRoot, { recursive: true });
  const sourceCommit = git(candidateRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  const tag = "maestro-template-v0.2.0-alpha.3";

  const sourcePaths = git(candidateRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    sourceCommit,
  ])
    .toString("utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  const plan = buildSaasApplicationTargetPlan({
    name: input.name,
    firstOutcome: input.outcome,
  });
  const blueprintOwnedPaths = new Set(
    plan.entries
      .filter((entry) => entry.replaces === undefined)
      .map((entry) => entry.path),
  );
  const paths = [
    ...buildCustomerOwnershipInventory(sourcePaths).map((entry) =>
      blueprintOwnedPaths.has(entry.path)
        ? {
            path: entry.path,
            match: "exact" as const,
            ownership: "factory-only" as const,
            action: "omit" as const,
            upgrade: "remove" as const,
          }
        : entry,
    ),
    {
      path: "template-instance.json",
      match: "exact" as const,
      ownership: "generated" as const,
      action: "generate" as const,
      upgrade: "regenerate" as const,
    },
  ];
  const expectedHashes = Object.fromEntries(
    paths
      .filter((entry) => entry.action === "copy" && entry.match === "exact")
      .map((entry) => [
        entry.path,
        hash(readFileSync(join(candidateRoot, entry.path))),
      ]),
  );
  const manifest = {
    $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
    schemaVersion: 1,
    materializationStatus: "materializable",
    release: {
      version: "0.2.0-alpha.3",
      tag,
      sourceCommit,
      sourceChecksum: hash(
        git(candidateRoot, ["archive", "--format=tar", sourceCommit]),
      ),
    },
    compatibility: { cli: "0.2.x", agentPack: "0.2.x" },
    paths,
    expectedHashes,
    extensionSeams: paths
      .filter((entry) => entry.ownership === "customer-extension")
      .map((entry) => ({
        path: entry.path,
        description: "Candidate customer extension seam.",
      })),
  };
  const manifestPath = join(authorityRoot, "manifest.json");
  const manifestBytes = writeJson(manifestPath, manifest);

  const blueprint = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
    parameterizedEntries: plan.parameterizedEntries,
    entries: plan.entries.map(({ content: _content, ...entry }) => entry),
  };
  const blueprintManifestPath = join(authorityRoot, "blueprint.json");
  const blueprintManifestBytes = writeJson(blueprintManifestPath, blueprint);
  const blueprintAuthorityManifestPath = join(
    authorityRoot,
    "blueprint-authority.json",
  );
  const blueprintAuthorityManifestBytes = writeJson(
    blueprintAuthorityManifestPath,
    blueprint,
  );
  git(candidateRoot, ["add", "--force", ".candidate-authority"]);
  git(candidateRoot, [
    "-c",
    "user.name=Maestro Candidate Fixture",
    "-c",
    "user.email=maestro-candidate-fixture@example.invalid",
    "commit",
    "--quiet",
    "--no-verify",
    "-m",
    "test: seal candidate authority",
  ]);
  const taggedCommit = git(candidateRoot, ["rev-parse", "HEAD"])
    .toString("utf8")
    .trim();
  git(candidateRoot, ["tag", tag, taggedCommit]);
  const taggedManifest = git(candidateRoot, [
    "show",
    `${taggedCommit}:.candidate-authority/manifest.json`,
  ]);
  if (!taggedManifest.equals(manifestBytes))
    throw new Error("Candidate fixture tag does not contain manifest bytes.");
  const manifestRelative = relative(
    realpathSync(candidateRoot),
    realpathSync(manifestPath),
  )
    .split(sep)
    .join("/");
  const resolvedTagCommit = git(candidateRoot, ["rev-list", "-n", "1", tag])
    .toString("utf8")
    .trim();
  if (resolvedTagCommit !== taggedCommit)
    throw new Error("Candidate fixture tag resolves to the wrong commit.");
  if (
    !git(candidateRoot, [
      "show",
      `${resolvedTagCommit}:${manifestRelative}`,
    ]).equals(manifestBytes)
  )
    throw new Error("Candidate fixture manifest relative path is not tagged.");
  if (
    !git(realpathSync(candidateRoot), [
      "show",
      `${resolvedTagCommit}:${manifestRelative}`,
    ]).equals(manifestBytes)
  )
    throw new Error("Canonical candidate fixture path cannot read the tag.");
  const source: CustomerCompositionSource = {
    repositoryRoot: candidateRoot,
    manifestPath,
    ownershipManifestChecksum: hash(manifestBytes),
    tag,
    sourceCommit,
    blueprintManifestPath,
    blueprintManifestChecksum: hash(blueprintManifestBytes),
    blueprintAuthorityManifestPath,
    blueprintAuthorityManifestChecksum: hash(blueprintAuthorityManifestBytes),
  };
  return {
    candidateRoot,
    source,
    reviewedSourceCommit: sourceCommit,
    tag,
    taggedCommit,
    targetRoot,
  };
};

const runCandidatePnpm = async (
  targetRoot: string,
  args: readonly string[],
): Promise<void> => {
  try {
    await execFileAsync("pnpm", args, {
      cwd: targetRoot,
      env: candidateEnvironment(),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch (error) {
    const failure = error as Error & {
      readonly stdout?: string;
      readonly stderr?: string;
    };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter((value): value is string => Boolean(value))
        .join("\n"),
    );
  }
};

const listFiles = (root: string): readonly string[] =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort();

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("candidate customer composition", () => {
  it("materializes and verifies an untouched Confect 10 and Effect 4 candidate", async () => {
    expect(installedStoreDir).toBeTruthy();
    expect(
      execFileSync("pnpm", ["--version"], {
        env: candidateEnvironment(),
        encoding: "utf8",
      }).trim(),
    ).toBe("10.12.1");
    const name = "Candidate Validation";
    const outcome = "Validate the exact candidate customer artifact";
    const fixture = buildCandidateReleaseFixture({ name, outcome });
    const create = createCustomerCreateComposition(fixture.source);
    const result = await create.run(
      [
        "create",
        fixture.targetRoot,
        "--name",
        name,
        "--outcome",
        outcome,
        "--demo-only",
        "--write",
        "--privacy-reviewed",
        "--json",
      ],
      fixture.candidateRoot,
    );
    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

    const instance = JSON.parse(
      readFileSync(join(fixture.targetRoot, "template-instance.json"), "utf8"),
    ) as {
      readonly release: {
        readonly version: string;
        readonly tag: string;
        readonly sourceCommit: string;
      };
    };
    expect(instance.release).toEqual({
      version: "0.2.0-alpha.3",
      tag: fixture.tag,
      sourceCommit: fixture.reviewedSourceCommit,
      sourceChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    expect(fixture.source.sourceCommit).toBe(fixture.reviewedSourceCommit);
    expect(fixture.taggedCommit).not.toBe(fixture.reviewedSourceCommit);
    const customerPackage = JSON.parse(
      readFileSync(join(fixture.targetRoot, "package.json"), "utf8"),
    ) as {
      readonly packageManager: string;
      readonly scripts: Readonly<Record<string, string>>;
    };
    const convexPackage = JSON.parse(
      readFileSync(
        join(fixture.targetRoot, "packages/convex/package.json"),
        "utf8",
      ),
    ) as { readonly dependencies: Readonly<Record<string, string>> };
    expect(customerPackage.packageManager).toBe("pnpm@10.12.1");
    expect(customerPackage.scripts).toHaveProperty(
      "check:confect-effect-compat",
    );
    expect(customerPackage.scripts).not.toHaveProperty("check:confect-v9");
    expect(convexPackage.dependencies).toMatchObject({
      "@confect/core": "10.0.0-next.9",
      "@confect/server": "10.0.0-next.9",
      effect: "4.0.0-beta.102",
    });
    const files = listFiles(fixture.targetRoot);
    expect(
      files.some((path) => path === "repos" || path.startsWith("repos/")),
    ).toBe(false);
    expect(files).toContain(
      "tooling/effectified-api-proof/confect-effect-compat-proof.ts",
    );
    expect(files).not.toContain(
      "tooling/effectified-api-proof/confect-v9-proof.ts",
    );

    await runCandidatePnpm(fixture.targetRoot, [
      "install",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    await runCandidatePnpm(fixture.targetRoot, ["check:confect-effect-compat"]);
    await runCandidatePnpm(fixture.targetRoot, ["check:confect-contracts"]);
    await runCandidatePnpm(fixture.targetRoot, ["check:confect-manifest"]);
    await runCandidatePnpm(fixture.targetRoot, [
      "--dir",
      "packages/convex",
      "typecheck",
    ]);
    await runCandidatePnpm(fixture.targetRoot, [
      "--dir",
      "packages/convex",
      "confect:codegen",
    ]);
  }, 180_000);

  it("keeps the zero-argument production composition on immutable alpha.2", () => {
    expect(ALPHA_2_SOURCE).toMatchObject({
      tag: "maestro-template-v0.2.0-alpha.2",
      sourceCommit: "3aefd456354b344b9595bddc44fc0782240e2b7d",
      manifestPath: expect.stringMatching(
        /releases\/v0\.2\.0-alpha\.2\/manifest\.json$/u,
      ),
    });
    expect(createCustomerCreateComposition().command).toBe("create");
  });
});
