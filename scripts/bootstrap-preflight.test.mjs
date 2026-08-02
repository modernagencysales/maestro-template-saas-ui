import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/bootstrap-preflight.mjs");

const runWithPnpm = (version) => {
  const bin = mkdtempSync(join(tmpdir(), "maestro-bootstrap-bin-"));
  const pnpm = join(bin, "pnpm");
  writeFileSync(pnpm, `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
  chmodSync(pnpm, 0o755);
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
    },
  });
};

describe("dependency-free bootstrap preflight", () => {
  it("accepts exactly the package-manager version declared by the repository", () => {
    const result = runWithPnpm("10.12.1");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("pnpm 10.12.1 is ready");
    expect(result.stdout).toContain("pnpm install --frozen-lockfile");
  });

  it("rejects an ambient mismatch with a copy-paste-safe pinned fallback", () => {
    const result = runWithPnpm("9.15.4");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("found pnpm 9.15.4; required pnpm 10.12.1");
    expect(result.stderr).toContain(
      "npx --yes pnpm@10.12.1 install --frozen-lockfile",
    );
    expect(result.stderr).toContain("Corepack reports a signing-key error");
  });
});
