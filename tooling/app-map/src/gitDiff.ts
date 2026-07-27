import { execFile } from "node:child_process";

export type GitDiffDiagnosticCode =
  | "APP_MAP_GIT_DIFF_BASE_REQUIRED"
  | "APP_MAP_GIT_DIFF_INVALID"
  | "APP_MAP_GIT_DIFF_UNAVAILABLE";

export type GitDiffDiagnostic = {
  readonly code: GitDiffDiagnosticCode;
  readonly message: string;
  readonly repair: string;
};

export type GitChangedPathsResult =
  | { readonly ok: true; readonly changedPaths: readonly string[] }
  | { readonly ok: false; readonly diagnostic: GitDiffDiagnostic };

export type ReadGitChangedPathsResult =
  | {
      readonly ok: true;
      readonly baseRevision: string;
      readonly headRevision: string;
      readonly changedPaths: readonly string[];
    }
  | { readonly ok: false; readonly diagnostic: GitDiffDiagnostic };

export type GitComparisonBaseResult =
  | {
      readonly ok: true;
      readonly baseRevision: string;
      readonly source: "explicit" | "trusted-ci";
    }
  | { readonly ok: false; readonly diagnostic: GitDiffDiagnostic };

export type GitDiffRunner = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly maxBuffer: number },
) => Promise<{ readonly stdout: string }>;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const onlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));
export const isExactGitRevision = (value: unknown): value is string =>
  typeof value === "string" &&
  (/^[0-9a-f]{40}$/u.test(value) || /^[0-9a-f]{64}$/u.test(value));
const safePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  value === value.normalize("NFC") &&
  !value.startsWith("/") &&
  !value.includes("\\") &&
  ![...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 0x1f || (point >= 0x7f && point <= 0x9f);
  }) &&
  value
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");

const diagnostic = (
  code: GitDiffDiagnosticCode,
  message: string,
): GitDiffDiagnostic => ({
  code,
  message,
  repair:
    code === "APP_MAP_GIT_DIFF_BASE_REQUIRED"
      ? "Supply the reviewed PR comparison base and exact head revision as commit IDs."
      : "Resolve the Git comparison locally, then rerun the focused App Map impact check.",
});

export const resolveGitComparisonBase = (
  candidate: unknown,
): GitComparisonBaseResult => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, ["explicitBaseRevision", "trustedCiBaseRevision"])
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_BASE_REQUIRED",
        "A reviewed explicit or trusted CI comparison base is required.",
      ),
    };
  }

  const explicit = candidate.explicitBaseRevision;
  const trustedCi = candidate.trustedCiBaseRevision;
  if (
    (explicit !== undefined && !isExactGitRevision(explicit)) ||
    (trustedCi !== undefined && !isExactGitRevision(trustedCi))
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_INVALID",
        "The supplied comparison-base metadata is not an exact commit ID.",
      ),
    };
  }
  if (
    explicit !== undefined &&
    trustedCi !== undefined &&
    explicit !== trustedCi
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_INVALID",
        "Explicit and trusted CI comparison bases disagree.",
      ),
    };
  }
  if (explicit !== undefined) {
    return { ok: true, baseRevision: explicit, source: "explicit" };
  }
  if (trustedCi !== undefined) {
    return { ok: true, baseRevision: trustedCi, source: "trusted-ci" };
  }
  return {
    ok: false,
    diagnostic: diagnostic(
      "APP_MAP_GIT_DIFF_BASE_REQUIRED",
      "No explicit or trusted CI comparison base was supplied.",
    ),
  };
};

export const parseGitNameStatus = (output: string): GitChangedPathsResult => {
  if (output === "") return { ok: true, changedPaths: [] };
  if (!output.endsWith("\0")) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_INVALID",
        "Git name-status output was not NUL terminated.",
      ),
    };
  }

  const tokens = output.split("\0");
  tokens.pop();
  const paths: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (
      status === undefined ||
      !/^(?:[ADMT]|[CR](?:100|[1-9]?[0-9]))$/u.test(status)
    ) {
      return {
        ok: false,
        diagnostic: diagnostic(
          "APP_MAP_GIT_DIFF_INVALID",
          "Git name-status output contained an unsupported or unresolved status.",
        ),
      };
    }
    const pathCount = status.startsWith("C") || status.startsWith("R") ? 2 : 1;
    for (let offset = 0; offset < pathCount; offset += 1) {
      const path = tokens[index++];
      if (!safePath(path)) {
        return {
          ok: false,
          diagnostic: diagnostic(
            "APP_MAP_GIT_DIFF_INVALID",
            "Git name-status output contained an unsafe or missing path.",
          ),
        };
      }
      paths.push(path);
    }
  }
  return { ok: true, changedPaths: [...new Set(paths)].sort(compareText) };
};

const nodeRunner: GitDiffRunner = (file, args, options) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      [...args],
      { cwd: options.cwd, maxBuffer: options.maxBuffer, encoding: "utf8" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve({ stdout });
      },
    );
  });

export const readGitChangedPaths = async (
  candidate: unknown,
  run: GitDiffRunner = nodeRunner,
): Promise<ReadGitChangedPathsResult> => {
  if (
    !isRecord(candidate) ||
    !onlyKeys(candidate, ["repoRoot", "baseRevision", "headRevision"]) ||
    !isExactGitRevision(candidate.baseRevision) ||
    !isExactGitRevision(candidate.headRevision)
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_BASE_REQUIRED",
        "An explicit unambiguous comparison base and head are required.",
      ),
    };
  }
  if (
    typeof candidate.repoRoot !== "string" ||
    !candidate.repoRoot.startsWith("/") ||
    candidate.repoRoot.length <= 1 ||
    candidate.baseRevision === candidate.headRevision
  ) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_INVALID",
        "The repository root or revision pair is invalid.",
      ),
    };
  }

  try {
    const { stdout } = await run(
      "git",
      [
        "diff",
        "--name-status",
        "-z",
        "--find-renames",
        `${candidate.baseRevision}...${candidate.headRevision}`,
        "--",
      ],
      { cwd: candidate.repoRoot, maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = parseGitNameStatus(stdout);
    return parsed.ok
      ? {
          ok: true,
          baseRevision: candidate.baseRevision,
          headRevision: candidate.headRevision,
          changedPaths: parsed.changedPaths,
        }
      : parsed;
  } catch {
    return {
      ok: false,
      diagnostic: diagnostic(
        "APP_MAP_GIT_DIFF_UNAVAILABLE",
        "Git could not produce the reviewed comparison without exposing runner details.",
      ),
    };
  }
};
