import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { hydrateWorktreeDependencies } from "./dependencies.js";
import { runRtk } from "./process.js";

interface GeneratedProofHooks {
  readonly generate: (workdir: string) => void;
  readonly hydrate: (root: string, workdir: string) => void;
}

const productionHooks: GeneratedProofHooks = {
  generate: (workdir) => {
    runRtk(["pnpm", "--dir", "packages/convex", "exec", "confect", "codegen"], {
      cwd: workdir,
    });
    runRtk(
      ["pnpm", "exec", "tsx", "tooling/confect-manifest/src/generate.ts"],
      { cwd: workdir },
    );
    runRtk(
      [
        "proxy",
        "env",
        "APP_ENV=build",
        "pnpm",
        "--dir",
        "apps/web",
        "exec",
        "vite",
        "build",
      ],
      { cwd: workdir },
    );
  },
  hydrate: hydrateWorktreeDependencies,
};

const safeRepoFile = (file: string): string => {
  if (
    file.length === 0 ||
    file.startsWith("/") ||
    file.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`unsafe generated candidate ${file}`);
  }
  return file;
};

export const proveIntegrationGeneratedOutput = (input: {
  readonly baseSha: string;
  readonly generatedFiles: readonly string[];
  readonly headSha: string;
  readonly hooks?: GeneratedProofHooks;
  readonly root: string;
}): string => {
  const root = resolve(input.root);
  const hooks = input.hooks ?? productionHooks;
  const generatedFiles = [
    ...new Set(input.generatedFiles.map(safeRepoFile)),
  ].sort();
  if (generatedFiles.length !== input.generatedFiles.length) {
    throw new Error("generated candidate list is not unique");
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), "brain-wave-generated-"));
  const workdir = join(temporaryRoot, "worktree");
  let attached = false;
  try {
    runRtk(["git", "worktree", "add", "--detach", workdir, input.headSha], {
      cwd: root,
    });
    attached = true;
    hooks.hydrate(root, workdir);
    for (const file of generatedFiles) {
      const atBase = runRtk(
        ["proxy", "git", "ls-tree", "--name-only", input.baseSha, "--", file],
        { cwd: workdir, quiet: true },
      );
      if (atBase === file) {
        runRtk(["git", "checkout", input.baseSha, "--", file], {
          cwd: workdir,
        });
        runRtk(["git", "reset", "HEAD", "--", file], { cwd: workdir });
      } else {
        rmSync(resolve(workdir, file), { force: true, recursive: true });
      }
    }
    hooks.generate(workdir);
    const status = runRtk(["proxy", "git", "status", "--porcelain"], {
      cwd: workdir,
      quiet: true,
    });
    if (status !== "") {
      throw new Error(
        `generated output is not reproducible at exact head: ${status}`,
      );
    }
    return createHash("sha256")
      .update(
        runRtk(
          [
            "proxy",
            "git",
            "diff",
            "--binary",
            "--full-index",
            `${input.baseSha}..${input.headSha}`,
            "--",
            ...generatedFiles,
          ],
          { cwd: workdir, quiet: true },
        ),
      )
      .digest("hex");
  } finally {
    try {
      if (attached) {
        runRtk(["git", "worktree", "remove", "--force", workdir], {
          cwd: root,
        });
      }
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true });
    }
  }
};
