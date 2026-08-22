import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ForwardScenarioId } from "../scenarios/forward.js";
import { EvaluationError } from "../walking-skeleton/contract.js";

const execFileAsync = promisify(execFile);
const releaseVersion = "0.2.0-alpha.1";
const releaseTag = `maestro-template-v${releaseVersion}`;
const releaseManifest = `releases/v${releaseVersion}/manifest.json`;
const exactCommit = /^[0-9a-f]{40}$/u;

export type DisposableReleaseTagResult =
  | { readonly status: "not-required" }
  | {
      readonly status: "created" | "already-present";
      readonly tag: typeof releaseTag;
      readonly sourceCommit: string;
      readonly candidateSha: string;
    };

/**
 * Supplies release authority only inside the disposable forward-eval clone.
 * The source repository is deliberately not accepted as an input.
 */
export async function provisionDisposableReleaseTag(input: {
  readonly workspace: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
}): Promise<DisposableReleaseTagResult> {
  if (input.scenarioId !== "greenfield-tagged-customer") {
    return { status: "not-required" };
  }
  if (!exactCommit.test(input.candidateSha)) {
    throw provenanceError(
      "Forward release candidate must be an exact Git commit.",
    );
  }
  const manifest = await readReleaseBinding(input.workspace);
  let head: string;
  try {
    head = await git(input.workspace, ["rev-parse", "HEAD"]);
  } catch {
    throw provenanceError("Disposable workspace HEAD could not be resolved.");
  }
  if (head !== input.candidateSha) {
    throw provenanceError(
      "Disposable workspace HEAD does not match the candidate.",
    );
  }
  try {
    await git(input.workspace, [
      "merge-base",
      "--is-ancestor",
      manifest.sourceCommit,
      input.candidateSha,
    ]);
  } catch {
    throw provenanceError(
      "Release manifest sourceCommit must be an ancestor of the candidate.",
    );
  }

  const existing = await optionalGit(input.workspace, [
    "rev-parse",
    "--verify",
    `refs/tags/${releaseTag}`,
  ]);
  if (existing !== undefined) {
    if (existing !== input.candidateSha) {
      throw provenanceError(
        "Disposable release tag already exists at a different commit.",
      );
    }
    return {
      status: "already-present",
      tag: releaseTag,
      sourceCommit: manifest.sourceCommit,
      candidateSha: input.candidateSha,
    };
  }

  try {
    await git(input.workspace, [
      "tag",
      "--no-sign",
      releaseTag,
      input.candidateSha,
    ]);
  } catch {
    throw provenanceError("Disposable release tag could not be provisioned.");
  }
  return {
    status: "created",
    tag: releaseTag,
    sourceCommit: manifest.sourceCommit,
    candidateSha: input.candidateSha,
  };
}

export async function assertDisposableReleaseTag(input: {
  readonly workspace: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
}): Promise<void> {
  if (input.scenarioId !== "greenfield-tagged-customer") return;
  const resolved = await optionalGit(input.workspace, [
    "rev-parse",
    "--verify",
    `refs/tags/${releaseTag}`,
  ]);
  if (resolved !== input.candidateSha) {
    throw provenanceError(
      "Evaluator-provisioned release tag changed during the scenario.",
    );
  }
}

async function readReleaseBinding(workspace: string): Promise<{
  readonly sourceCommit: string;
}> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(join(workspace, releaseManifest), "utf8"),
    );
  } catch {
    throw manifestError(
      `Disposable release manifest is invalid: ${releaseManifest}`,
    );
  }
  if (!isRecord(parsed) || !isRecord(parsed.release)) {
    throw manifestError(
      "Disposable release manifest is missing release metadata.",
    );
  }
  if (
    parsed.release.version !== releaseVersion ||
    parsed.release.tag !== releaseTag
  ) {
    throw manifestError(
      `Disposable release tag must be ${releaseTag} for version ${releaseVersion}.`,
    );
  }
  if (
    typeof parsed.release.sourceCommit !== "string" ||
    !exactCommit.test(parsed.release.sourceCommit)
  ) {
    throw manifestError(
      "Disposable release sourceCommit must be an exact Git commit.",
    );
  }
  return { sourceCommit: parsed.release.sourceCommit };
}

async function git(
  workspace: string,
  args: readonly string[],
): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", workspace, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return String(stdout).trim();
}

async function optionalGit(
  workspace: string,
  args: readonly string[],
): Promise<string | undefined> {
  try {
    return await git(workspace, args);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function manifestError(message: string): EvaluationError {
  return new EvaluationError("EVAL_MANIFEST_INVALID", message);
}

function provenanceError(message: string): EvaluationError {
  return new EvaluationError("EVAL_PROVENANCE_CHANGED", message);
}
