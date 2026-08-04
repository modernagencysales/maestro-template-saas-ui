import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export type ReviewFinding = {
  readonly gate: "taste" | "contract";
  readonly rubricVersion: string;
  readonly clause: string;
  readonly path: string;
  readonly line?: number;
  readonly issue: string;
};

export type FrozenFinding = ReviewFinding & { readonly fingerprint: string };
export type FrozenFindingSet = {
  readonly version: 1;
  readonly maxRepairRounds: 2;
  readonly findings: readonly FrozenFinding[];
};
const FREEZE_MARKER = "<!-- factory-ai-review:v1 -->";
const ROUND_MARKER = "<!-- factory-ai-review-round:v1 -->";
const execFileAsync = promisify(execFile);
type Resolution = {
  readonly fingerprint: string;
  readonly status: "resolved" | "unresolved" | "cannot_verify";
};
export type FrozenJudge = (findings: readonly FrozenFinding[]) => Promise<{
  readonly resolutions: readonly Resolution[];
  readonly followUpFindings: readonly ReviewFinding[];
}>;

export function readFrozenFiles(
  root: string,
  findings: readonly FrozenFinding[],
  read: (path: string) => string = (path) => readFileSync(path, "utf8"),
): string {
  const base = resolve(root);
  return [...new Set(findings.map(({ path }) => path))]
    .map((path) => {
      const target = resolve(base, path);
      const fromBase = relative(base, target);
      if (
        fromBase === "" ||
        fromBase === ".." ||
        fromBase.startsWith(`..${sep}`) ||
        isAbsolute(fromBase)
      ) {
        throw new Error(
          `frozen finding path is outside candidate root: ${path}`,
        );
      }
      return `## ${path}\n${read(target)}`;
    })
    .join("\n\n");
}

export function frozenVerificationPrompt(
  findings: readonly FrozenFinding[],
  currentFiles: string,
): string {
  return `Verify only the supplied frozen findings against the current file bytes. Do not discover or report blockers outside this list. Return only JSON: {"resolutions":[{"fingerprint":"...","status":"resolved|unresolved|cannot_verify"}]}. Every supplied fingerprint must appear exactly once.\n\n<frozen-findings>\n${JSON.stringify(findings)}\n</frozen-findings>\n\n<current-files>\n${currentFiles}\n</current-files>`;
}

export function parseFrozenJudgeOutput(raw: string): {
  readonly resolutions: readonly Resolution[];
  readonly followUpFindings: readonly ReviewFinding[];
} {
  const clean = raw.trim().replace(/^```json\s*|\s*```$/gu, "");
  const value = JSON.parse(clean) as { resolutions?: unknown };
  if (!Array.isArray(value.resolutions))
    throw new Error("frozen verifier omitted resolutions");
  const resolutions = value.resolutions.map((item) => {
    if (typeof item !== "object" || item === null)
      throw new Error("invalid frozen resolution");
    const row = item as Record<string, unknown>;
    if (
      typeof row.fingerprint !== "string" ||
      !["resolved", "unresolved", "cannot_verify"].includes(String(row.status))
    )
      throw new Error("invalid frozen resolution");
    return {
      fingerprint: row.fingerprint,
      status: row.status as Resolution["status"],
    };
  });
  return { resolutions, followUpFindings: [] };
}

const normalized = (value: string): string =>
  value.trim().replace(/\s+/gu, " ").toLowerCase();

export function findingFingerprint(finding: ReviewFinding): string {
  const identity = {
    gate: finding.gate,
    rubricVersion: finding.rubricVersion,
    clause: normalized(finding.clause),
    path: finding.path.replaceAll("\\", "/").replace(/^\.\//u, ""),
    issue: normalized(finding.issue),
  };
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function freezeFindingSet(
  findings: readonly ReviewFinding[],
): FrozenFindingSet {
  return {
    version: 1,
    maxRepairRounds: 2,
    findings: findings
      .map((finding) => ({
        ...finding,
        fingerprint: findingFingerprint(finding),
      }))
      .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint)),
  };
}

type FreezeRecord = {
  readonly prNumber: number;
  readonly headSha: string;
  readonly frozen: FrozenFindingSet;
};

export function formatFreezeComment(record: FreezeRecord): string {
  return `${FREEZE_MARKER}\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`;
}

function parseFreezeComment(body: string): FreezeRecord | null {
  if (!body.includes(FREEZE_MARKER)) return null;
  const match = /```json\s*([\s\S]*?)\s*```/u.exec(body);
  if (match?.[1] === undefined) return null;
  try {
    const record = JSON.parse(match[1]) as FreezeRecord;
    return validFreezeRecord(record) ? record : null;
  } catch {
    return null;
  }
}

function validFreezeRecord(record: FreezeRecord): boolean {
  return (
    Number.isInteger(record.prNumber) &&
    typeof record.headSha === "string" &&
    record.frozen?.version === 1 &&
    record.frozen.maxRepairRounds === 2 &&
    record.frozen.findings.every(
      (finding) => findingFingerprint(finding) === finding.fingerprint,
    )
  );
}

export function readReviewHistory(
  comments: readonly { readonly id: number; readonly body: string }[],
): {
  readonly freeze: FreezeRecord | null;
  readonly rounds: readonly {
    readonly round: number;
    readonly status: string;
  }[];
} {
  const freezes = comments
    .map((comment) => ({
      id: comment.id,
      freeze: parseFreezeComment(comment.body),
    }))
    .filter(
      (row): row is { id: number; freeze: FreezeRecord } => row.freeze !== null,
    )
    .sort((left, right) => left.id - right.id);
  const first = freezes[0]?.freeze ?? null;
  if (
    first !== null &&
    freezes.some(
      ({ freeze }) => JSON.stringify(freeze) !== JSON.stringify(first),
    )
  ) {
    throw new Error("conflicting freeze comments for this PR");
  }
  const rounds = comments
    .flatMap(({ body }) => {
      if (!body.includes(ROUND_MARKER)) return [];
      const match = /```json\s*([\s\S]*?)\s*```/u.exec(body);
      try {
        const row = JSON.parse(match?.[1] ?? "") as {
          round: number;
          status: string;
        };
        return Number.isInteger(row.round) &&
          [
            "passed",
            "unresolved",
            "escalated",
            "infrastructure_blocked",
          ].includes(row.status)
          ? [row]
          : [];
      } catch {
        return [];
      }
    })
    .sort((left, right) => left.round - right.round);
  return { freeze: first, rounds };
}

export function formatRoundComment(record: object): string {
  return `${ROUND_MARKER}\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`;
}

export async function verifyFrozenFindingSet(
  frozen: FrozenFindingSet,
  input: { readonly round: number; readonly judge: FrozenJudge },
) {
  try {
    const judged = await input.judge(frozen.findings);
    const supplied = new Set(
      frozen.findings.map(({ fingerprint }) => fingerprint),
    );
    const statuses = new Map(
      judged.resolutions
        .filter(({ fingerprint }) => supplied.has(fingerprint))
        .map(({ fingerprint, status }) => [fingerprint, status]),
    );
    const blockingFingerprints = frozen.findings
      .map(({ fingerprint }) => fingerprint)
      .filter((fingerprint) => statuses.get(fingerprint) !== "resolved");
    return {
      status:
        blockingFingerprints.length === 0
          ? ("passed" as const)
          : ("unresolved" as const),
      round: input.round,
      roundConsumed: true,
      blockingFingerprints,
      followUpFindings:
        blockingFingerprints.length === 0 ? judged.followUpFindings : [],
    };
  } catch (error) {
    return {
      status: "infrastructure_blocked" as const,
      round: input.round,
      roundConsumed: false,
      blockingFingerprints: frozen.findings.map(
        ({ fingerprint }) => fingerprint,
      ),
      followUpFindings: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runRounds(
  frozen: FrozenFindingSet,
  judge: FrozenJudge,
  options: { readonly maxRepairRounds: 2 },
) {
  for (let round = 1; round <= options.maxRepairRounds; round += 1) {
    const verdict = await verifyFrozenFindingSet(frozen, { round, judge });
    if (verdict.status !== "unresolved")
      return {
        ...verdict,
        frozenFingerprints: frozen.findings.map(
          ({ fingerprint }) => fingerprint,
        ),
      };
    if (round === options.maxRepairRounds)
      return {
        ...verdict,
        status: "escalated" as const,
        frozenFingerprints: frozen.findings.map(
          ({ fingerprint }) => fingerprint,
        ),
      };
  }
  throw new Error("unreachable repair round");
}

function markerJson(output: string, marker: string): Record<string, unknown> {
  const line = output.split("\n").find((item) => item.startsWith(marker));
  if (line === undefined) throw new Error(`${marker} was not emitted`);
  return JSON.parse(line.slice(marker.length)) as Record<string, unknown>;
}

function discoveredFindings(
  tasteOutput: string,
  contractOutput: string,
): ReviewFinding[] {
  const taste = markerJson(tasteOutput, "TASTE_VERDICT_JSON=");
  const contract = markerJson(contractOutput, "CONTRACT_VERDICT_JSON=");
  const tasteFindings = (Array.isArray(taste.files) ? taste.files : []).flatMap(
    (entry) => {
      const file = entry as {
        file?: unknown;
        verdict?: { findings?: unknown };
      };
      if (file.file === "tooling/quality/taste-review.mts")
        throw new Error("taste review infrastructure blocked");
      return (
        Array.isArray(file.verdict?.findings) ? file.verdict.findings : []
      ).flatMap((finding) => {
        const row = finding as Record<string, unknown>;
        return row.severity === "block" &&
          typeof file.file === "string" &&
          typeof row.issue === "string"
          ? [
              {
                gate: "taste" as const,
                rubricVersion: "taste-v1",
                clause: "TASTE",
                path: file.file,
                line: typeof row.line === "number" ? row.line : undefined,
                issue: row.issue,
              },
            ]
          : [];
      });
    },
  );
  const contractFindings = (
    Array.isArray(contract.findings) ? contract.findings : []
  ).flatMap((finding) => {
    const row = finding as Record<string, unknown>;
    if (row.clause === "CONTRACT_REVIEW_INFRASTRUCTURE")
      throw new Error("contract review infrastructure blocked");
    return row.severity === "red" &&
      typeof row.path === "string" &&
      typeof row.issue === "string" &&
      typeof row.clause === "string"
      ? [
          {
            gate: "contract" as const,
            rubricVersion: "contract-v1",
            clause: row.clause,
            path: row.path,
            line: typeof row.line === "number" ? row.line : undefined,
            issue: row.issue,
          },
        ]
      : [];
  });
  return [...tasteFindings, ...contractFindings];
}

async function gateOutput(
  script: "taste" | "contract-review",
): Promise<string> {
  try {
    const result = await execFileAsync(process.execPath, gateArgv(script), {
      encoding: "utf8",
      env: {
        ...process.env,
        CONTRACT_REVIEW_WORKTREE: process.cwd(),
        TASTE_REVIEW_WORKTREE: process.cwd(),
      },
      maxBuffer: 10_000_000,
      timeout: 1_000_000,
    });
    return `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return `${failed.stdout ?? ""}\n${failed.stderr ?? ""}`;
  }
}

export function gateArgv(
  script: "taste" | "contract-review",
  trustedRoot = new URL("../..", import.meta.url).pathname,
): readonly string[] {
  const entrypoint =
    script === "taste"
      ? "tooling/quality/taste.mts"
      : "tooling/quality/contract-review.mts";
  return ["--experimental-strip-types", resolve(trustedRoot, entrypoint)];
}

async function githubComments(
  repo: string,
  prNumber: number,
  token: string,
): Promise<Array<{ id: number; body: string }>> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues/${String(prNumber)}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`GitHub comments read failed: ${String(response.status)}`);
  return (await response.json()) as Array<{ id: number; body: string }>;
}

async function postComment(
  repo: string,
  prNumber: number,
  token: string,
  body: string,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues/${String(prNumber)}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok)
    throw new Error(`GitHub comment write failed: ${String(response.status)}`);
}

async function main(): Promise<void> {
  const request = reviewRequest();
  const comments = await githubComments(
    request.repo,
    request.prNumber,
    request.token,
  );
  await continueReview(request, readReviewHistory(comments));
}

type ReviewRequest = {
  readonly repo: string;
  readonly token: string;
  readonly prNumber: number;
  readonly headSha: string;
};

function reviewRequest(): ReviewRequest {
  const repo = process.env.GITHUB_REPOSITORY ?? process.env.CI_REPO;
  const token = process.env.GITHUB_TOKEN;
  const prNumber = Number(
    process.env.CI_COMMIT_PULL_REQUEST ?? process.env.GITHUB_PR_NUMBER,
  );
  const headSha = process.env.CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (
    !repo ||
    !token ||
    !Number.isInteger(prNumber) ||
    prNumber < 1 ||
    !headSha
  )
    throw new Error(
      "review:bounded requires repository, PR, head SHA, and GITHUB_TOKEN",
    );
  return { repo, token, prNumber, headSha };
}

async function continueReview(
  request: ReviewRequest,
  history: ReturnType<typeof readReviewHistory>,
): Promise<void> {
  const { repo, token, prNumber, headSha } = request;
  if (history.freeze === null) {
    await initialReview(repo, prNumber, token, headSha);
    return;
  }
  if (
    history.freeze.frozen.findings.length === 0 ||
    history.rounds.some(({ status }) => status === "passed")
  )
    return;
  const consumed = consumedRounds(history.rounds);
  if (consumed >= 2) {
    process.exitCode = 1;
    return;
  }
  await repairReview({
    request,
    frozen: history.freeze.frozen,
    round: consumed + 1,
  });
}

function consumedRounds(
  rounds: readonly { readonly round: number; readonly status: string }[],
): number {
  return rounds.filter(
    ({ round, status }) => round > 0 && status !== "infrastructure_blocked",
  ).length;
}

async function initialReview(
  repo: string,
  prNumber: number,
  token: string,
  headSha: string,
): Promise<void> {
  try {
    const [taste, contract] = await Promise.all([
      gateOutput("taste"),
      gateOutput("contract-review"),
    ]);
    const frozen = freezeFindingSet(discoveredFindings(taste, contract));
    await postComment(
      repo,
      prNumber,
      token,
      formatFreezeComment({ prNumber, headSha, frozen }),
    );
    process.exitCode = frozen.findings.length === 0 ? 0 : 1;
  } catch (error) {
    await postComment(
      repo,
      prNumber,
      token,
      formatRoundComment({
        round: 0,
        status: "infrastructure_blocked",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
}

async function repairReview(input: {
  readonly request: ReviewRequest;
  readonly frozen: FrozenFindingSet;
  readonly round: number;
}): Promise<void> {
  const {
    request: { repo, prNumber, token, headSha },
    frozen,
    round,
  } = input;
  const { verifyTasteFindingSet } = await import("./taste-review.mts");
  const { verifyContractFindingSet } = await import("./contract-review.mts");
  const verdict = await verifyFrozenFindingSet(frozen, {
    round,
    judge: async (findings) => {
      const [taste, contract] = await Promise.all([
        findings.some(({ gate }) => gate === "taste")
          ? verifyTasteFindingSet(
              findings.filter(({ gate }) => gate === "taste"),
            )
          : Promise.resolve({ resolutions: [], followUpFindings: [] }),
        findings.some(({ gate }) => gate === "contract")
          ? verifyContractFindingSet(
              findings.filter(({ gate }) => gate === "contract"),
            )
          : Promise.resolve({ resolutions: [], followUpFindings: [] }),
      ]);
      return {
        resolutions: [...taste.resolutions, ...contract.resolutions],
        followUpFindings: [],
      };
    },
  });
  const status =
    verdict.status === "unresolved" && round === 2
      ? "escalated"
      : verdict.status;
  await postComment(
    repo,
    prNumber,
    token,
    formatRoundComment({
      round,
      headSha,
      status,
      blockingFingerprints: verdict.blockingFingerprints,
    }),
  );
  process.exitCode = status === "passed" ? 0 : 1;
}

if (process.argv[1]?.endsWith("ai-review-cycle.mts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
