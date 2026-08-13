import { execFileSync } from "node:child_process";

const maxGitOutput = 512 * 1024 * 1024;

const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    maxBuffer: maxGitOutput,
    stdio: ["ignore", "pipe", "ignore"],
  });

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

export const snapshotCheckoutState = (root: string): Buffer => {
  try {
    if (
      git(root, ["rev-parse", "--is-inside-work-tree"])
        .toString("utf8")
        .trim() !== "true"
    )
      throw new Error("not a Git worktree");
    const indexFlags = git(root, ["ls-files", "--cached", "-v", "-z"]);
    if (hasUnsafeIndexFlags(indexFlags))
      throw new Error("unsafe Git index flags");
    return Buffer.concat([
      ...[
        ["rev-parse", "HEAD"],
        ["status", "--porcelain=v1", "--untracked-files=all", "-z"],
        ["diff", "--cached", "--binary", "--no-ext-diff"],
        ["diff", "--binary", "--no-ext-diff"],
      ].flatMap((args) => [git(root, args), Buffer.from([0])]),
      indexFlags,
    ]);
  } catch {
    throw new Error("could not capture Git checkout state");
  }
};

export const assertCheckoutState = (
  initial: Buffer,
  root: string,
  message: string,
): void => {
  try {
    if (snapshotCheckoutState(root).equals(initial)) return;
  } catch {
    // A checkout that existed before discovery must remain inspectable.
  }
  throw new Error(message);
};
