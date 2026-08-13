import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const maxGitOutput = 512 * 1024 * 1024;

const gitEnvironment = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
  ])
    delete environment[name];
  return environment;
};

const discoverGit = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    env: gitEnvironment(),
    maxBuffer: maxGitOutput,
    stdio: ["ignore", "pipe", "ignore"],
  });

export type CheckoutState = {
  readonly worktree: string;
  readonly gitDir: string;
  readonly commonDir: string;
  readonly state: Buffer;
};

const boundGit = (
  checkout: Pick<CheckoutState, "worktree" | "gitDir" | "commonDir">,
  args: readonly string[],
): Buffer =>
  execFileSync(
    "git",
    [
      `--git-dir=${checkout.gitDir}`,
      `--work-tree=${checkout.worktree}`,
      ...args,
    ],
    {
      cwd: checkout.worktree,
      env: { ...gitEnvironment(), GIT_COMMON_DIR: checkout.commonDir },
      maxBuffer: maxGitOutput,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );

const hasUnsafeIndexFlags = (listing: Buffer): boolean =>
  listing
    .toString("utf8")
    .split("\0")
    .some((entry) => {
      const flag = entry[0];
      return (
        entry[1] === " " &&
        (flag === "S" || (flag !== undefined && flag >= "a" && flag <= "z"))
      );
    });

const configState = (commonDir: string, gitDir: string): Buffer =>
  Buffer.concat(
    [
      [commonDir, "config"],
      [gitDir, "config.worktree"],
      [gitDir, "commondir"],
    ].flatMap(([directory, name]) => {
      const path = `${directory}/${name}`;
      return existsSync(path)
        ? [
            Buffer.from(name),
            Buffer.from([0]),
            readFileSync(path),
            Buffer.from([0]),
          ]
        : [];
    }),
  );

const capture = (
  checkout: Pick<CheckoutState, "worktree" | "gitDir" | "commonDir">,
): Buffer => {
  if (
    boundGit(checkout, ["rev-parse", "--is-inside-work-tree"])
      .toString("utf8")
      .trim() !== "true"
  )
    throw new Error("not a Git worktree");
  const indexFlags = boundGit(checkout, ["ls-files", "--cached", "-v", "-z"]);
  if (hasUnsafeIndexFlags(indexFlags))
    throw new Error("unsafe Git index flags");
  return Buffer.concat([
    ...[
      ["rev-parse", "HEAD"],
      ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
      ["diff", "--cached", "--binary", "--no-ext-diff"],
      ["diff", "--binary", "--no-ext-diff"],
    ].flatMap((args) => [boundGit(checkout, args), Buffer.from([0])]),
    indexFlags,
    configState(checkout.commonDir, checkout.gitDir),
  ]);
};

export const snapshotCheckoutState = (root: string): CheckoutState => {
  try {
    if (
      discoverGit(root, ["rev-parse", "--is-inside-work-tree"])
        .toString("utf8")
        .trim() !== "true"
    )
      throw new Error("not a Git worktree");
    const worktree = realpathSync(
      discoverGit(root, ["rev-parse", "--show-toplevel"])
        .toString("utf8")
        .trim(),
    );
    const gitDir = realpathSync(
      discoverGit(root, ["rev-parse", "--absolute-git-dir"])
        .toString("utf8")
        .trim(),
    );
    const commonDir = realpathSync(
      resolve(
        root,
        discoverGit(root, ["rev-parse", "--git-common-dir"])
          .toString("utf8")
          .trim(),
      ),
    );
    const checkout = { worktree, gitDir, commonDir };
    return { ...checkout, state: capture(checkout) };
  } catch {
    throw new Error("could not capture Git checkout state");
  }
};

export const assertCheckoutState = (
  initial: CheckoutState,
  message: string,
): void => {
  try {
    if (capture(initial).equals(initial.state)) return;
  } catch {
    // A checkout that existed before discovery must remain inspectable.
  }
  throw new Error(message);
};
