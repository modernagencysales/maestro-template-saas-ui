import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createNodePreflightRuntimeReader,
  nodePreflightFileSystem,
} from "./nodeAdapters.js";
import { createNodeExecFileAdapter } from "./nodeAdapters.js";
import { createRepositoryContext } from "./repoContext.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("factory Node Agent Pack adapter authority", () => {
  it("resolves immutable pack, CLI, and template versions in the real workspace", async () => {
    const realExec = createNodeExecFileAdapter();
    const runtime = createNodePreflightRuntimeReader({
      fs: nodePreflightFileSystem,
      execFile: (file, args, options) =>
        file === "git"
          ? realExec(file, args, options)
          : Promise.resolve({
              exitCode: 0,
              stdout:
                file === "pnpm" && args[0] === "--version"
                  ? "10.12.1\n"
                  : "ready\n",
              stderr: "",
            }),
      workflowRules: [],
      publishedWorkflowRuleIds: [],
      environment: () => ({}),
      policy: {
        supportedPlatforms: [process.platform],
        minimumGitVersion: "2.31.0",
        minimumDiskBytes: 0,
        requiredPorts: [],
        metadataTimeoutMs: 2_000,
        maxBufferBytes: 256 * 1024,
      },
    });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();

    const snapshot = await runtime.inspect(
      { mode: "fake" },
      createRepositoryContext({ cwd: repositoryRoot }),
    );

    expect(snapshot.versions).toMatchObject({
      pack: `git:${commit}`,
      cli: `git:${commit}`,
      template: `git:${commit}`,
    });
    expect(JSON.stringify(snapshot.versions)).not.toMatch(
      /workspace|unavailable/,
    );
  });
});
