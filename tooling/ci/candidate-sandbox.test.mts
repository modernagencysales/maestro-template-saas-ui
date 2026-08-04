import { describe, expect, it } from "vitest";
import {
  assertCandidateDependencyProxyIsWired,
  candidateInstallCommand,
  candidateInstallSequence,
  candidateEnvironment,
  candidateSandboxArgv,
  validateCandidateLockfile,
} from "./candidate-sandbox.mts";
import { readFileSync } from "node:fs";

describe("candidate sandbox", () => {
  it("starts empty and exposes no controller credential or host control path", () => {
    expect(candidateEnvironment()).toEqual({
      CI: "true",
      HOME: "/tmp/candidate-home",
      npm_config_registry: "http://127.0.0.1:4873",
    });
    const argv = candidateSandboxArgv({
      workspace: "/scratch/candidate",
      sourceWorkspace: "/read-only/source",
      runtime: "/controller/runtime",
    });
    expect(argv).toEqual(
      expect.arrayContaining([
        "--unshare-user",
        "--unshare-pid",
        "--unshare-ipc",
        "--unshare-uts",
        "--unshare-cgroup",
        "--unshare-net",
      ]),
    );
    expect(argv).not.toContain("--unshare-all");
    expect(argv).not.toContain("--share-net");
    expect(argv).toEqual(
      expect.arrayContaining(["--ro-bind", "/controller/proxy", "/proxy"]),
    );
    expect(argv).toEqual(
      expect.arrayContaining([
        "--ro-bind",
        "/read-only/source",
        "/source",
        "--bind",
        "/scratch/candidate",
        "/candidate",
        "--ro-bind",
        "/controller/runtime",
        "/runtime",
        "--rlimit-as",
        "1073741824",
        "--rlimit-cpu",
        "300",
        "--rlimit-nofile",
        "1024",
      ]),
    );
    expect(argv).not.toContain("/dependency-proxy");
    expect(argv.join(" ")).not.toMatch(
      /GITHUB_TOKEN|BWS|CLOUDFLARE|SSH_AUTH_SOCK|docker\.sock/u,
    );
  });

  it("rejects candidate hooks and lockfiles that widen the protected allowlist", () => {
    expect(() =>
      validateCandidateLockfile({
        lockfile: "lockfileVersion: '9.0'\n  evil@1.0.0:\n",
        allowedPackages: new Set(["safe@1.0.0"]),
        hasPnpmfile: true,
      }),
    ).toThrow(/\.pnpmfile\.cjs/u);
    expect(() =>
      validateCandidateLockfile({
        lockfile: "lockfileVersion: '9.0'\n  evil@1.0.0:\n",
        allowedPackages: new Set(["safe@1.0.0"]),
        hasPnpmfile: false,
      }),
    ).toThrow(/evil@1\.0\.0/u);
  });

  it("refuses installs until a controller-local dependency proxy is wired into the network namespace", () => {
    expect(() => assertCandidateDependencyProxyIsWired()).toThrow(
      /Unix socket/u,
    );
    expect(() =>
      assertCandidateDependencyProxyIsWired({
        socketExists: true,
        socketIsSocket: true,
      }),
    ).not.toThrow();
  });

  it("runs package management only through immutable absolute runtime paths", () => {
    expect(candidateInstallCommand("fetch")).toEqual([
      "/runtime/bin/node",
      "/runtime/sandbox-runner.mjs",
      "fetch",
    ]);
    expect(candidateInstallCommand("install")).toEqual([
      "/runtime/bin/node",
      "/runtime/sandbox-runner.mjs",
      "install",
    ]);
    expect(candidateInstallCommand("fetch").join(" ")).not.toMatch(
      /(?:^|\s)(?:env|pnpm)(?:\s|$)/u,
    );
    expect(candidateInstallSequence()).toEqual([
      candidateInstallCommand("install"),
    ]);
  });

  it("builds a fixed protected operator image with an immutable candidate runtime", () => {
    const dockerfile = readFileSync(
      new URL("./controller.Dockerfile", import.meta.url),
      "utf8",
    );
    expect(dockerfile).toContain("/controller/runtime/bin/node");
    expect(dockerfile).toContain("/controller/runtime/bin/socat");
    expect(dockerfile).toContain("/controller/runtime/pnpm");
    expect(dockerfile).toContain(
      'ENTRYPOINT ["/controller/bin/protected-bootstrap"]',
    );
    expect(dockerfile).not.toMatch(/ENTRYPOINT .*candidate-sandbox/u);
    expect(dockerfile).not.toContain("--share-net");
  });
});
