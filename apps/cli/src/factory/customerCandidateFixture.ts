import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import {
  buildSaasApplicationTargetPlan,
  createTemplateInstanceMigration,
  isRecordsOnlyWorkflowProvenancePath,
  isWorkflowAutomationPath,
} from "@maestro-template/generators";
import { buildCustomerOwnershipInventory } from "@maestro-template/release-tooling/customer-ownership";
import { createReleaseTemplateInstanceConsumer } from "@maestro-template/release-tooling/customer-create";
import { templateInstanceSchemaProvider } from "@maestro-template/template-core/templateInstance";
import {
  loadCustomerCreateComposition,
  type CustomerCompositionSource,
} from "./createComposition";

const hash = (bytes: string | Buffer): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const git = (repository: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-C", repository, ...args], {
    maxBuffer: 512 * 1024 * 1024,
  });

const writeJson = (path: string, value: unknown): Buffer => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes);
  return bytes;
};

const entryIdentity = (
  entry: ReturnType<typeof buildSaasApplicationTargetPlan>["entries"][number],
) => ({
  path: entry.path,
  ownership: entry.ownership,
  action: entry.action,
  upgrade: entry.upgrade,
  sha256: entry.sha256,
  ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
});

export type SaasPlanBuilder = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}) => ReturnType<typeof buildSaasApplicationTargetPlan>;

type CandidateAuthority = "alpha.1" | "alpha.3";

const buildRecordsPlan: SaasPlanBuilder = (options) =>
  buildSaasApplicationTargetPlan({
    ...options,
    patterns: ["records-example"],
  });

const authorityDetails = (authority: CandidateAuthority) =>
  authority === "alpha.1"
    ? {
        version: "0.2.0-alpha.1",
        tag: "maestro-template-v0.2.0-alpha.1",
        relativeRoot: "releases/v0.2.0-alpha.1",
        blueprintRelativePath: "blueprints/saas-application.json",
        compatibility: {
          cli: ">=0.1.0-alpha.1 <0.2.0",
          agentPack: ">=0.1.0-alpha.1 <0.2.0",
        },
      }
    : {
        version: "0.2.0-alpha.3",
        tag: "maestro-template-v0.2.0-alpha.3",
        relativeRoot: ".candidate-authority",
        blueprintRelativePath: "blueprint.json",
        compatibility: { cli: "0.2.x", agentPack: "0.2.x" },
      };

export const buildCandidateReleaseFixture = (input: {
  readonly repoRoot: string;
  readonly name: string;
  readonly outcome: string;
  readonly buildPlan: SaasPlanBuilder;
  readonly authority: CandidateAuthority;
}) => {
  const parent = mkdtempSync(
    join(
      tmpdir(),
      input.authority === "alpha.1"
        ? "maestro-records-customer-"
        : "maestro-candidate-composition-",
    ),
  );
  const candidateRoot = join(parent, "candidate");
  const targetRoot = join(parent, "customer");
  const details = authorityDetails(input.authority);
  try {
    execFileSync(
      "git",
      [
        "clone",
        "--quiet",
        "--shared",
        "--no-tags",
        input.repoRoot,
        candidateRoot,
      ],
      { maxBuffer: 512 * 1024 * 1024 },
    );
    const authorityRoot = join(candidateRoot, details.relativeRoot);
    if (input.authority === "alpha.3")
      appendFileSync(
        join(candidateRoot, ".git/info/exclude"),
        "\n.candidate-authority/\n",
      );
    mkdirSync(join(authorityRoot, "blueprints"), { recursive: true });
    const sourceCommit = git(candidateRoot, ["rev-parse", "HEAD"])
      .toString("utf8")
      .trim();
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
    const plan = input.buildPlan({
      name: input.name,
      firstOutcome: input.outcome,
    });
    const materializedPaths = new Set(plan.entries.map((entry) => entry.path));
    const optionalPatternPaths = new Set(
      buildSaasApplicationTargetPlan({
        name: input.name,
        firstOutcome: input.outcome,
        patterns: ["records-example", "workflow-automation"],
      }).entries.map((entry) => entry.path),
    );
    const workflowSelected = materializedPaths.has(
      "tooling/workflow/package.json",
    );
    const blueprintOwnedPaths = new Set(
      plan.entries
        .filter((entry) => entry.replaces === undefined)
        .map((entry) => entry.path),
    );
    const paths = [
      ...buildCustomerOwnershipInventory(sourcePaths).map((entry) =>
        blueprintOwnedPaths.has(entry.path) ||
        (optionalPatternPaths.has(entry.path) &&
          !materializedPaths.has(entry.path)) ||
        (!workflowSelected &&
          (isWorkflowAutomationPath(entry.path) ||
            isRecordsOnlyWorkflowProvenancePath(entry.path)))
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
      ...plan.entries
        .filter((entry) => !sourcePaths.includes(entry.path))
        .map((entry) => ({
          path: entry.path,
          match: "exact" as const,
          ownership: "factory-only" as const,
          action: "omit" as const,
          upgrade: "remove" as const,
        })),
    ];
    const manifestPath = join(authorityRoot, "manifest.json");
    const manifestBytes = writeJson(manifestPath, {
      $schema: "../../schemas/maestro-customer-release-manifest.schema.json",
      schemaVersion: 1,
      materializationStatus: "materializable",
      release: {
        version: details.version,
        tag: details.tag,
        sourceCommit,
        sourceChecksum: hash(
          git(candidateRoot, ["archive", "--format=tar", sourceCommit]),
        ),
      },
      compatibility: details.compatibility,
      paths,
      expectedHashes: Object.fromEntries(
        paths
          .filter((entry) => entry.action === "copy" && entry.match === "exact")
          .map((entry) => [
            entry.path,
            hash(readFileSync(join(candidateRoot, entry.path))),
          ]),
      ),
      extensionSeams: paths
        .filter((entry) => entry.ownership === "customer-extension")
        .map((entry) => ({
          path: entry.path,
          description: "Candidate customer extension seam.",
        })),
    });
    const blueprint = {
      schemaVersion: plan.schemaVersion,
      id: plan.id,
      provenance: plan.provenance,
      registrations: plan.registrations,
      parameterizedEntries: plan.parameterizedEntries,
      entries: plan.entries.map(entryIdentity),
    };
    const blueprintManifestPath = join(
      authorityRoot,
      details.blueprintRelativePath,
    );
    const blueprintManifestBytes = writeJson(blueprintManifestPath, blueprint);
    const blueprintAuthorityManifestPath =
      input.authority === "alpha.1"
        ? blueprintManifestPath
        : join(authorityRoot, "blueprint-authority.json");
    const blueprintAuthorityManifestBytes =
      input.authority === "alpha.1"
        ? blueprintManifestBytes
        : writeJson(blueprintAuthorityManifestPath, blueprint);
    const authorityPath = details.relativeRoot;
    git(candidateRoot, [
      "add",
      ...(input.authority === "alpha.3" ? ["--force"] : []),
      authorityPath,
    ]);
    git(candidateRoot, [
      "-c",
      "user.name=Maestro Acceptance",
      "-c",
      "user.email=acceptance@maestro.local",
      "commit",
      "--quiet",
      "--no-verify",
      "-m",
      "test: seal candidate authority",
    ]);
    const taggedCommit = git(candidateRoot, ["rev-parse", "HEAD"])
      .toString("utf8")
      .trim();
    git(candidateRoot, ["tag", details.tag, taggedCommit]);
    const manifestRelative = relative(candidateRoot, manifestPath)
      .split(sep)
      .join("/");
    const resolvedTagCommit = git(candidateRoot, [
      "rev-list",
      "-n",
      "1",
      details.tag,
    ])
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
      throw new Error(
        "Candidate fixture manifest relative path is not tagged.",
      );
    const source: CustomerCompositionSource = {
      repositoryRoot: candidateRoot,
      manifestPath,
      ownershipManifestChecksum: hash(manifestBytes),
      tag: details.tag,
      sourceCommit,
      blueprintManifestPath,
      blueprintManifestChecksum: hash(blueprintManifestBytes),
      blueprintAuthorityManifestPath,
      blueprintAuthorityManifestChecksum: hash(blueprintAuthorityManifestBytes),
    };
    return {
      parent,
      candidateRoot,
      source,
      reviewedSourceCommit: sourceCommit,
      tag: details.tag,
      taggedCommit,
      targetRoot,
    };
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
};

/** Test-only release fixture that exercises the customer-create composition. */
export const withMaterializedRecordsCustomer = async <Value>(
  repoRoot: string,
  operation: (targetRoot: string) => Promise<Value>,
): Promise<Value> => {
  const fixture = buildCandidateReleaseFixture({
    repoRoot,
    name: "Records Customer",
    outcome: "Manage shared records",
    buildPlan: buildRecordsPlan,
    authority: "alpha.1",
  });
  try {
    const create = loadCustomerCreateComposition(
      fixture.source,
      buildRecordsPlan,
      createReleaseTemplateInstanceConsumer(
        templateInstanceSchemaProvider,
        createTemplateInstanceMigration(templateInstanceSchemaProvider),
      ),
    );
    const result = await create.run(
      [
        "create",
        fixture.targetRoot,
        "--name",
        "Records Customer",
        "--outcome",
        "Manage shared records",
        "--demo-only",
        "--write",
        "--json",
      ],
      fixture.candidateRoot,
    );
    if (result.exitCode !== 0)
      throw new Error(`${result.stdout}\n${result.stderr}`);
    const materialized = readFileSync(
      join(fixture.targetRoot, "template-instance.json"),
      "utf8",
    );
    const canonical = templateInstanceSchemaProvider.serialize(
      templateInstanceSchemaProvider.parseText(materialized),
    );
    if (canonical !== materialized)
      throw new Error("Records customer template instance is not canonical.");
    git(fixture.targetRoot, ["init", "-b", "main"]);
    git(fixture.targetRoot, ["add", "."]);
    git(fixture.targetRoot, [
      "-c",
      "user.name=Maestro Acceptance",
      "-c",
      "user.email=acceptance@maestro.local",
      "commit",
      "--quiet",
      "--no-verify",
      "-m",
      "materialize Records customer",
    ]);
    if (
      git(fixture.targetRoot, ["status", "--short"]).toString("utf8").trim() !==
      ""
    )
      throw new Error("materialized customer checkout is dirty");
    return await operation(fixture.targetRoot);
  } finally {
    rmSync(fixture.parent, { recursive: true, force: true });
  }
};
