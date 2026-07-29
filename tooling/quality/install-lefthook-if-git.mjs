import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import process from "node:process";

const cwd = realpathSync(process.cwd());
const worktree = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  cwd,
  encoding: "utf8",
  shell: false,
  stdio: ["ignore", "pipe", "ignore"],
});

if (worktree.status === 0) {
  let gitRoot;
  try {
    gitRoot = realpathSync(worktree.stdout.trim());
  } catch {
    gitRoot = undefined;
  }

  if (gitRoot === cwd) {
    const installed = spawnSync("lefthook", ["install"], {
      cwd,
      shell: false,
      stdio: "inherit",
    });
    if (installed.error !== undefined || installed.status !== 0) {
      process.stderr.write("Lefthook installation failed.\n");
      process.exitCode = installed.status ?? 1;
    }
  }
}
