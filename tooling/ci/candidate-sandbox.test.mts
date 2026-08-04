import { describe, expect, it } from "vitest";
import {
  candidateEnvironment,
  candidateSandboxArgv,
  validateCandidateLockfile,
} from "./candidate-sandbox.mts";

describe("candidate sandbox", () => {
  it("starts empty and exposes no controller credential or host control path", () => {
    expect(candidateEnvironment("http://dependency-proxy:4873")).toEqual({
      CI: "true",
      HOME: "/tmp/candidate-home",
      npm_config_registry: "http://dependency-proxy:4873",
    });
    const argv = candidateSandboxArgv({ workspace: "/candidate" });
    expect(argv).toContain("--unshare-net");
    expect(argv.join(" ")).not.toMatch(
      /GITHUB_TOKEN|BWS|CLOUDFLARE|SSH_AUTH_SOCK|docker\.sock|controller/u,
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
});
