import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildForwardPrompt } from "./contract.js";
import {
  assertDisposableReleaseTag,
  provisionDisposableReleaseTag,
} from "./disposableReleaseTag.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("provisionDisposableReleaseTag", () => {
  it("creates the manifest tag at the candidate only in the disposable greenfield clone", async () => {
    const fixture = await createReleaseFixture();

    await expect(
      provisionDisposableReleaseTag({
        workspace: fixture.workspace,
        candidateSha: fixture.candidateSha,
        scenarioId: "greenfield-tagged-customer",
      }),
    ).resolves.toEqual({
      status: "created",
      tag: "maestro-template-v0.2.0-alpha.1",
      sourceCommit: fixture.sourceCommit,
      candidateSha: fixture.candidateSha,
    });

    expect(
      git(
        fixture.workspace,
        "rev-parse",
        "refs/tags/maestro-template-v0.2.0-alpha.1",
      ),
    ).toBe(fixture.candidateSha);
    expect(
      git(
        fixture.workspace,
        "cat-file",
        "-t",
        "refs/tags/maestro-template-v0.2.0-alpha.1",
      ),
    ).toBe("commit");
    expect(() =>
      git(
        fixture.sourceRoot,
        "rev-parse",
        "--verify",
        "refs/tags/maestro-template-v0.2.0-alpha.1",
      ),
    ).toThrow();
    await expect(
      assertDisposableReleaseTag({
        workspace: fixture.workspace,
        candidateSha: fixture.candidateSha,
        scenarioId: "greenfield-tagged-customer",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects deletion or movement of the evaluator-provisioned tag", async () => {
    const fixture = await createReleaseFixture();
    const input = {
      workspace: fixture.workspace,
      candidateSha: fixture.candidateSha,
      scenarioId: "greenfield-tagged-customer" as const,
    };
    await provisionDisposableReleaseTag(input);
    git(
      fixture.workspace,
      "tag",
      "--force",
      "maestro-template-v0.2.0-alpha.1",
      fixture.sourceCommit,
    );
    await expect(assertDisposableReleaseTag(input)).rejects.toMatchObject({
      code: "EVAL_PROVENANCE_CHANGED",
    });
    git(
      fixture.workspace,
      "tag",
      "--delete",
      "maestro-template-v0.2.0-alpha.1",
    );
    await expect(assertDisposableReleaseTag(input)).rejects.toMatchObject({
      code: "EVAL_PROVENANCE_CHANGED",
    });
  });

  it("does nothing for every non-greenfield scenario", async () => {
    const fixture = await createReleaseFixture();
    await writeFile(
      join(fixture.workspace, "releases/v0.2.0-alpha.1/manifest.json"),
      "not json",
    );

    await expect(
      provisionDisposableReleaseTag({
        workspace: fixture.workspace,
        candidateSha: fixture.candidateSha,
        scenarioId: "prototype-adoption",
      }),
    ).resolves.toEqual({ status: "not-required" });
    expect(git(fixture.workspace, "tag", "--list")).toBe("");
  });

  it("rejects a release tag that does not match the fixed release version", async () => {
    const fixture = await createReleaseFixture();
    const manifestPath = join(
      fixture.workspace,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      release: { tag: string };
    };
    manifest.release.tag = "maestro-template-v0.2.0-alpha.1-moved";
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

    await expect(
      provisionDisposableReleaseTag({
        workspace: fixture.workspace,
        candidateSha: fixture.candidateSha,
        scenarioId: "greenfield-tagged-customer",
      }),
    ).rejects.toMatchObject({
      code: "EVAL_MANIFEST_INVALID",
      message: expect.stringMatching(/release tag/i),
    });
  });

  it("rejects a manifest source commit that is not an ancestor of the candidate", async () => {
    const fixture = await createReleaseFixture();
    const unrelated = commitUnrelated(fixture.workspace, fixture.candidateSha);
    const manifestPath = join(
      fixture.workspace,
      "releases/v0.2.0-alpha.1/manifest.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      release: { sourceCommit: string };
    };
    manifest.release.sourceCommit = unrelated;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

    await expect(
      provisionDisposableReleaseTag({
        workspace: fixture.workspace,
        candidateSha: fixture.candidateSha,
        scenarioId: "greenfield-tagged-customer",
      }),
    ).rejects.toThrow(/ancestor/i);
  });
});

describe("buildForwardPrompt tag authority", () => {
  const common = {
    candidateSha: "a".repeat(40),
    host: "codex" as const,
    runId: "prompt-test",
    resultPath: ".maestro-eval/forward-result.json",
    artifactId: "greenfield-customer",
    command: {
      id: "verify-greenfield-customer",
      executable: "node",
      args: [
        "tooling/agent-pack/evals/forward/gate-launcher.mjs",
        "check:gates",
      ],
    },
  };

  it("allows only the evaluator-provisioned local release tag in greenfield", () => {
    const prompt = buildForwardPrompt({
      ...common,
      scenarioId: "greenfield-tagged-customer",
    });

    expect(prompt).toContain(
      "The evaluator has provisioned the required release tag locally in this disposable clone",
    );
    expect(prompt).toContain(
      "must never create, move, delete, or push any tag",
    );
  });

  it("does not claim a release tag was provisioned for other scenarios", () => {
    const prompt = buildForwardPrompt({
      ...common,
      scenarioId: "prototype-adoption",
    });

    expect(prompt).not.toContain("has provisioned the required release tag");
    expect(prompt).toContain(
      "must never create, move, delete, or push any tag",
    );
  });
});

async function createReleaseFixture(): Promise<{
  sourceRoot: string;
  workspace: string;
  sourceCommit: string;
  candidateSha: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "maestro-forward-tag-"));
  roots.push(root);
  const sourceRoot = join(root, "source");
  const workspace = join(root, "workspace");
  git(root, "init", "source");
  git(sourceRoot, "config", "user.email", "eval@example.test");
  git(sourceRoot, "config", "user.name", "Eval Fixture");
  await writeFile(join(sourceRoot, "source.txt"), "sealed source\n");
  git(sourceRoot, "add", "source.txt");
  git(sourceRoot, "commit", "-m", "source");
  const sourceCommit = git(sourceRoot, "rev-parse", "HEAD");
  await mkdir(join(sourceRoot, "releases/v0.2.0-alpha.1"), {
    recursive: true,
  });
  await writeFile(
    join(sourceRoot, "releases/v0.2.0-alpha.1/manifest.json"),
    `${JSON.stringify({
      release: {
        version: "0.2.0-alpha.1",
        tag: "maestro-template-v0.2.0-alpha.1",
        sourceCommit,
      },
    })}\n`,
  );
  git(sourceRoot, "add", "releases/v0.2.0-alpha.1/manifest.json");
  git(sourceRoot, "commit", "-m", "candidate");
  const candidateSha = git(sourceRoot, "rev-parse", "HEAD");
  git(root, "clone", "--quiet", "source", "workspace");
  git(workspace, "checkout", "--quiet", "--detach", candidateSha);
  return { sourceRoot, workspace, sourceCommit, candidateSha };
}

function commitUnrelated(repository: string, candidateSha: string): string {
  git(repository, "config", "user.email", "eval@example.test");
  git(repository, "config", "user.name", "Eval Fixture");
  return git(
    repository,
    "commit-tree",
    `${candidateSha}^{tree}`,
    "-m",
    "unrelated",
  );
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
