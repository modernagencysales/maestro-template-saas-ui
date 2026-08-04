import { describe, expect, it } from "vitest";
import {
  assertCandidateDependencyProxyIsWired,
  candidateEnvironment,
  candidateSandboxArgv,
  validateCandidateLockfile,
} from "./candidate-sandbox.mts";

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
      /controller-local dependency proxy/u,
    );
    expect(() =>
      assertCandidateDependencyProxyIsWired({
        wired: true,
        networkMode: "shared-proxy",
        egressPolicyDigest: `sha256:${"a".repeat(64)}`,
      }),
    ).not.toThrow();
  });
});
