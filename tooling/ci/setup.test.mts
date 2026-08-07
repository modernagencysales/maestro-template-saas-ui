import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const temporaryDirectories: string[] = [];

type Scenario = {
  readonly nodeVersion?: string;
  readonly pnpmVersion?: string;
  readonly fnm?: boolean;
  readonly fnmChecksum?: string;
};

type SetupResult = ReturnType<typeof spawnSync> & {
  readonly calls: readonly string[];
};

const executable = (path: string, body: string): void => {
  writeFileSync(path, `#!/bin/bash\nset -euo pipefail\n${body}\n`);
  chmodSync(path, 0o755);
};

const fakeNode = (path: string, version: string): void => {
  executable(
    path,
    `printf 'node %s\\n' "$*" >> "$FAKE_SETUP_LOG"
if [[ "\${1:-}" == "--version" ]]; then
  printf 'v%s\\n' ${JSON.stringify(version)}
fi`,
  );
};

const fakePnpm = (path: string, version: string): void => {
  executable(
    path,
    `printf 'pnpm %s\\n' "$*" >> "$FAKE_SETUP_LOG"
if [[ "\${1:-}" == "--version" ]]; then
  printf '%s\\n' ${JSON.stringify(version)}
elif [[ "\${1:-}" == "store" && "\${2:-}" == "path" ]]; then
  printf '%s/.pnpm-store\\n' "$PWD"
fi`,
  );
};

const runSetup = (scenario: Scenario): SetupResult => {
  const directory = mkdtempSync(join(tmpdir(), "maestro-ci-setup-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  const fnmBin = join(directory, "fnm-bin");
  const home = join(directory, "home");
  const log = join(directory, "calls.log");
  mkdirSync(bin);
  mkdirSync(fnmBin);
  mkdirSync(home);
  writeFileSync(log, "");

  if (scenario.nodeVersion) fakeNode(join(bin, "node"), scenario.nodeVersion);
  if (scenario.pnpmVersion) fakePnpm(join(bin, "pnpm"), scenario.pnpmVersion);
  fakeNode(join(fnmBin, "node"), "22.23.2");

  if (scenario.fnm) {
    executable(
      join(bin, "fnm"),
      `printf 'fnm %s\\n' "$*" >> "$FAKE_SETUP_LOG"
case "\${1:-}" in
  --version) printf 'fnm 1.38.1\\n' ;;
  env) printf 'export PATH=%q:$PATH\\n' "$FAKE_FNM_NODE_BIN" ;;
esac`,
    );
  }

  executable(
    join(bin, "curl"),
    `printf 'curl %s\\n' "$*" >> "$FAKE_SETUP_LOG"
output=''
url=''
while (($#)); do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
if [[ "$url" == *pnpm-linux-x64 ]]; then
  cat > "$output" <<'PNPM'
#!/bin/bash
set -euo pipefail
printf 'pnpm %s\\n' "$*" >> "$FAKE_SETUP_LOG"
if [[ "\${1:-}" == "--version" ]]; then
  printf '10.12.1\\n'
elif [[ "\${1:-}" == "store" && "\${2:-}" == "path" ]]; then
  printf '%s/.pnpm-store\\n' "$PWD"
fi
PNPM
else
  printf 'not-a-real-fnm-archive' > "$output"
fi`,
  );
  executable(
    join(bin, "uname"),
    `if [[ "\${1:-}" == "-s" ]]; then printf 'Linux\\n'; else printf 'x86_64\\n'; fi`,
  );
  executable(
    join(bin, "sha256sum"),
    `case "$1" in
  *fnm-linux.zip) printf '%s  %s\\n' "$FAKE_FNM_CHECKSUM" "$1" ;;
  *) printf 'eb2dc1f109bca046ce734d062c8dd8f34db2b58a115992f9b086456efd7b2305  %s\\n' "$1" ;;
esac`,
  );
  executable(
    join(bin, "python3"),
    `printf 'python3 %s\\n' "$*" >> "$FAKE_SETUP_LOG"`,
  );
  executable(
    join(bin, "bash"),
    `printf 'bash %s\\n' "$*" >> "$FAKE_SETUP_LOG"`,
  );

  const result = spawnSync("/bin/bash", ["-c", "source tooling/ci/setup.sh"], {
    cwd: root,
    encoding: "utf8",
    env: {
      CI: "true",
      FAKE_FNM_CHECKSUM:
        scenario.fnmChecksum ??
        "b69e5c9a05c1e17e4a7de9a17df14ba430d049f2591af791a6f850a170296069",
      FAKE_FNM_NODE_BIN: fnmBin,
      FAKE_SETUP_LOG: log,
      HOME: home,
      PATH: `${bin}:/usr/bin:/bin`,
    },
  });
  return {
    ...result,
    calls: readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
  };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("CI toolchain bootstrap", () => {
  it("uses a compatible preinstalled Node and matching pnpm directly", () => {
    const result = runSetup({
      nodeVersion: "24.4.0",
      pnpmVersion: "10.12.1",
      fnm: true,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).not.toContain("fnm install");
    expect(result.calls.some((call) => call.startsWith("curl "))).toBe(false);
  });

  it("installs pnpm 10.12.1 when compatible Node has no pnpm", () => {
    const result = runSetup({ nodeVersion: "22.23.2", fnm: true });

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).not.toContain("fnm install");
    expect(result.calls).toContainEqual(
      expect.stringContaining("/v10.12.1/pnpm-linux-x64"),
    );
  });

  it("replaces mismatched pnpm without replacing compatible Node", () => {
    const result = runSetup({
      nodeVersion: "26.3.0",
      pnpmVersion: "9.15.0",
      fnm: true,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).not.toContain("fnm install");
    expect(result.calls).toContain("pnpm --version");
    expect(result.calls).toContainEqual(
      expect.stringContaining("pnpm-linux-x64"),
    );
  });

  it("uses fnm when Node is missing", () => {
    const result = runSetup({ pnpmVersion: "10.12.1", fnm: true });

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain("fnm install");
    expect(result.calls).toContain("fnm use");
  });

  it("uses fnm when preinstalled Node is incompatible", () => {
    const result = runSetup({
      nodeVersion: "20.19.0",
      pnpmVersion: "10.12.1",
      fnm: true,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toContain("fnm install");
    expect(result.calls).toContain("fnm use");
  });

  it("rejects a downloaded fnm archive with the wrong checksum", () => {
    const result = runSetup({ fnmChecksum: "wrong-checksum" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fnm 1.38.1 checksum mismatch");
    expect(result.calls).toContainEqual(
      expect.stringContaining("fnm-linux.zip"),
    );
    expect(result.calls.some((call) => call.startsWith("python3 "))).toBe(
      false,
    );
  });
});
