/**
 * post-ai-gate-comment — upserts a sticky PR comment carrying an AI gate
 * verdict (taste or contract-review) so gate feedback is PR-visible. One
 * marker comment per gate; reruns update the existing comment instead of
 * stacking new ones.
 */
import { readFileSync } from "node:fs";
import process from "node:process";

import { isDirectRun } from "./src/direct-run.mts";

const GITHUB_API = "https://api.github.com";
const MAX_FIELD_LENGTH = 500;
const MAX_JSON_LENGTH = 20_000;

export type Gate = "taste" | "contract-review";

export type GateCommentInput = {
  readonly gate: Gate;
  readonly verdict: unknown;
  readonly repo: string;
  readonly prNumber: number;
  readonly sha: string;
  readonly buildUrl: string | null;
};

type GitHubComment = {
  readonly id: number;
  readonly body: string;
};

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function truncate(value: unknown, max = MAX_FIELD_LENGTH): string {
  const raw = text(value, "(not provided)").replace(/\s+/g, " ").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 15)}... [truncated]`;
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value === undefined || value.trim() === "" ? null : value;
}

function parseGate(raw: string | null): Gate {
  if (raw === "taste" || raw === "contract-review") return raw;
  throw new Error(`Invalid --gate "${raw ?? ""}".`);
}

function parsePositiveInteger(
  raw: string | null,
  label: string,
): number | null {
  if (raw === null || raw === "false") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label} "${raw}".`);
  }
  return value;
}

function repoParts(repo: string): {
  readonly owner: string;
  readonly name: string;
} {
  const [owner, name] = repo.split("/");
  if (
    owner === undefined ||
    name === undefined ||
    owner === "" ||
    name === ""
  ) {
    throw new Error(`Invalid repository "${repo}"; expected owner/name.`);
  }
  return { owner, name };
}

function verdictValue(verdict: unknown): "pass" | "block" {
  return object(verdict).verdict === "block" ? "block" : "pass";
}

export function markerFor(gate: Gate): string {
  return `<!-- ai-gate:${gate} -->`;
}

function gateTitle(gate: Gate): string {
  return gate === "contract-review" ? "Contract review" : "Taste review";
}

function metadataKey(gate: Gate): string {
  return gate === "contract-review"
    ? "contract-review-verdict"
    : "taste-verdict";
}

function shortSha(sha: string): string {
  return sha.length > 12 ? sha.slice(0, 12) : sha;
}

function contractFindingLines(verdict: unknown): readonly string[] {
  const findings = list(object(verdict).findings);
  if (findings.length === 0) return ["- No finding details were emitted."];

  return findings.slice(0, 25).flatMap((finding, index) => {
    const row = object(finding);
    const path = text(row.path, "(unknown path)");
    const line = integer(row.line) ?? 1;
    const issue = truncate(row.issue);
    const fix = truncate(row.fix);
    const clause = truncate(row.clause, 120);
    const confidence = truncate(row.confidence, 80);
    const gate = truncate(row.mechanicalGateCandidate, 120);
    return [
      `${String(index + 1)}. \`${path}:${String(line)}\` - ${issue}`,
      `   Fix: ${fix}`,
      `   Clause: \`${clause}\` | Confidence: \`${confidence}\` | Mechanical gate: \`${gate}\``,
    ];
  });
}

function tasteFindingLines(
  verdict: unknown,
  severities: readonly string[],
): readonly string[] {
  const files = list(object(verdict).files);
  const lines: string[] = [];
  let index = 1;

  for (const fileVerdict of files) {
    const row = object(fileVerdict);
    const file = text(row.file, "(unknown file)");
    const findings = list(object(row.verdict).findings);
    for (const finding of findings) {
      const item = object(finding);
      if (!severities.includes(text(item.severity))) continue;
      lines.push(
        `${String(index)}. \`${file}:${String(integer(item.line) ?? 1)}\` - ${truncate(item.issue)}`,
        `   Fix: ${truncate(item.fix)}`,
      );
      index += 1;
      if (index > 25) break;
    }
    if (index > 25) break;
  }

  return lines;
}

function verdictJson(verdict: unknown): string {
  const pretty = JSON.stringify(verdict, null, 2);
  if (pretty.length <= MAX_JSON_LENGTH) return pretty;
  return `${pretty.slice(0, MAX_JSON_LENGTH)}\n... [truncated]`;
}

export function formatGateComment(input: GateCommentInput): string {
  const verdict = verdictValue(input.verdict);
  const blocked = verdict === "block";
  const title = `${gateTitle(input.gate)} ${blocked ? "blocked" : "passed"}`;
  const lines = [
    markerFor(input.gate),
    `### ${title}`,
    "",
    `- Gate: \`${input.gate}\``,
    `- Verdict: \`${verdict}\``,
    `- Commit: \`${shortSha(input.sha)}\``,
    `- Machine-readable verdict: CI metadata \`${metadataKey(input.gate)}\``,
  ];

  if (input.buildUrl !== null) {
    lines.push(`- Build: ${input.buildUrl}`);
  }

  const blockingFindingLines =
    input.gate === "contract-review"
      ? contractFindingLines(input.verdict)
      : tasteFindingLines(input.verdict, ["block"]);
  const nonBlockingFindingLines =
    input.gate === "taste" ? tasteFindingLines(input.verdict, ["nit"]) : [];

  lines.push("");
  if (blocked) {
    lines.push("Blocking findings:");
    lines.push(
      ...(blockingFindingLines.length > 0
        ? blockingFindingLines
        : ["- No finding details were emitted."]),
    );
  } else {
    lines.push("No blocking findings for this commit.");
  }

  if (nonBlockingFindingLines.length > 0) {
    lines.push("", "Non-blocking findings:");
    lines.push(...nonBlockingFindingLines);
  }

  lines.push(
    "",
    "<details>",
    "<summary>Machine-readable verdict JSON</summary>",
    "",
    "```json",
    verdictJson(input.verdict),
    "```",
    "</details>",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function commentsFrom(payload: unknown): readonly GitHubComment[] {
  return list(payload)
    .map(object)
    .map((comment) => ({
      id: integer(comment.id),
      body: text(comment.body),
    }))
    .filter(
      (comment): comment is GitHubComment =>
        comment.id !== null && comment.body !== "",
    );
}

async function githubJson(input: {
  readonly token: string;
  readonly method: "GET" | "POST" | "PATCH";
  readonly path: string;
  readonly body?: unknown;
}): Promise<unknown> {
  const response = await fetch(`${GITHUB_API}${input.path}`, {
    method: input.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
      "User-Agent": "template-quality-ci",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitHub ${input.method} ${input.path} failed with ${String(response.status)}: ${bodyText.slice(0, 500)}`,
    );
  }
  return bodyText.trim() === "" ? null : JSON.parse(bodyText);
}

async function issueComments(input: {
  readonly token: string;
  readonly owner: string;
  readonly name: string;
  readonly prNumber: number;
}): Promise<readonly GitHubComment[]> {
  const comments: GitHubComment[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
    });
    const payload = await githubJson({
      token: input.token,
      method: "GET",
      path: `/repos/${input.owner}/${input.name}/issues/${String(input.prNumber)}/comments?${params}`,
    });
    const pageComments = commentsFrom(payload);
    comments.push(...pageComments);
    if (pageComments.length < 100) return comments;
  }
}

export async function upsertGateComment(input: {
  readonly token: string;
  readonly comment: GateCommentInput;
}): Promise<"created" | "updated"> {
  const { owner, name } = repoParts(input.comment.repo);
  const body = formatGateComment(input.comment);
  const marker = markerFor(input.comment.gate);
  const existing = (
    await issueComments({
      token: input.token,
      owner,
      name,
      prNumber: input.comment.prNumber,
    })
  ).find((comment) => comment.body.includes(marker));

  if (existing === undefined) {
    await githubJson({
      token: input.token,
      method: "POST",
      path: `/repos/${owner}/${name}/issues/${String(input.comment.prNumber)}/comments`,
      body: { body },
    });
    return "created";
  }

  await githubJson({
    token: input.token,
    method: "PATCH",
    path: `/repos/${owner}/${name}/issues/comments/${String(existing.id)}`,
    body: { body },
  });
  return "updated";
}

async function main(): Promise<void> {
  const gate = parseGate(option("--gate"));
  const verdictFile = option("--verdict-file");
  if (verdictFile === null) throw new Error("--verdict-file is required.");

  const token = process.env.GITHUB_TOKEN ?? "";
  if (token.trim() === "") {
    console.log("post-ai-gate-comment: skipped because GITHUB_TOKEN is unset.");
    return;
  }

  const prNumber = parsePositiveInteger(
    option("--pr") ?? process.env.CI_COMMIT_PULL_REQUEST ?? null,
    "PR number",
  );
  if (prNumber === null) {
    console.log(
      "post-ai-gate-comment: skipped because this is not a PR build.",
    );
    return;
  }

  const repo =
    option("--repo") ??
    process.env.GITHUB_REPO ??
    process.env.GITHUB_REPOSITORY ??
    null;
  if (repo === null) {
    console.log(
      "post-ai-gate-comment: skipped because no repository is configured (pass --repo or set GITHUB_REPO/GITHUB_REPOSITORY).",
    );
    return;
  }

  const sha =
    option("--sha") ??
    process.env.CI_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "";
  const buildUrl = option("--build-url") ?? process.env.CI_PIPELINE_URL ?? null;
  const verdict: unknown = JSON.parse(readFileSync(verdictFile, "utf8"));

  const result = await upsertGateComment({
    token,
    comment: {
      gate,
      verdict,
      repo,
      prNumber,
      sha,
      buildUrl,
    },
  });
  console.log(
    `post-ai-gate-comment: ${result} ${gate} comment on #${String(prNumber)}.`,
  );
}

if (isDirectRun(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`post-ai-gate-comment: ${message}`);
    process.exit(1);
  });
}
