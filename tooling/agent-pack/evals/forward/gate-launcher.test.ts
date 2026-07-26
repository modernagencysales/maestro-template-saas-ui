import { execFile, spawn } from "node:child_process";
import { lstat, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { cloneCandidate } from "../walking-skeleton/runner.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../../../..");

describe("forward gate launcher", () => {
  it.runIf(process.platform === "linux")(
    "passes in a detached clone when Unix socket creation is denied",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "maestro-gate-launcher-"));
      const clone = join(root, "detached");
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: repositoryRoot,
      });
      const candidateSha = stdout.trim();
      await cloneCandidate({
        sourceRoot: repositoryRoot,
        candidateSha,
        workspace: clone,
        sessionDir: root,
      });
      await expect(lstat(join(clone, "node_modules"))).rejects.toMatchObject({
        code: "ENOENT",
      });

      const preloadSource = join(root, "deny-unix-sockets.c");
      const preloadLibrary = join(root, "deny-unix-sockets.so");
      await writeFile(
        preloadSource,
        [
          "#define _GNU_SOURCE",
          "#include <dlfcn.h>",
          "#include <errno.h>",
          "#include <sys/socket.h>",
          "typedef int (*socket_fn)(int, int, int);",
          "int socket(int domain, int type, int protocol) {",
          "  static socket_fn real_socket = 0;",
          "  if (domain == AF_UNIX) { errno = EPERM; return -1; }",
          '  if (!real_socket) real_socket = (socket_fn)dlsym(RTLD_NEXT, "socket");',
          "  return real_socket(domain, type, protocol);",
          "}",
          "",
        ].join("\n"),
      );
      await execFileAsync("cc", [
        "-shared",
        "-fPIC",
        "-o",
        preloadLibrary,
        preloadSource,
        "-ldl",
      ]);
      const env = { ...process.env, LD_PRELOAD: preloadLibrary };

      const denial = await run(
        process.execPath,
        [
          "-e",
          [
            "const net=require('node:net');",
            "const server=net.createServer();",
            "server.on('error',error=>process.exit(error.code==='EPERM'?0:2));",
            `server.listen(${JSON.stringify(join(root, "must-not-open.sock"))},()=>process.exit(3));`,
          ].join(""),
        ],
        { cwd: clone, env },
      );
      expect(denial.exitCode).toBe(0);

      const result = await run(
        process.execPath,
        [
          "tooling/agent-pack/evals/forward/gate-launcher.mjs",
          "check:convex-ai-files",
        ],
        { cwd: clone, env },
      );
      expect(result).toMatchObject({ exitCode: 0, stderr: "" });
      expect(result.stdout).toContain(
        "Convex AI files match the pinned offline manifest.",
      );
      await expect(
        readFile(join(clone, ".git", "HEAD"), "utf8"),
      ).resolves.toMatch(/^[0-9a-f]{40}\n$/u);
    },
    30_000,
  );
});

function run(
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv },
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolveResult({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
