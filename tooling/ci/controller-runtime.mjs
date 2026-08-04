/* global process, setTimeout */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const node = "/usr/local/bin/node";
const controller = "/controller";
const socket = "/controller/proxy/dependency.sock";

const run = (program, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (status, signal) =>
      status === 0
        ? resolve()
        : reject(new Error(`${program} failed: ${status ?? signal}`)),
    );
  });

async function candidate(action, root) {
  if (existsSync(socket)) rmSync(socket);
  const proxy = spawn(
    node,
    [
      "--experimental-strip-types",
      `${controller}/dependency-proxy.mts`,
      "serve",
      "--allowlist",
      `${controller}/dependency-allowlist.json`,
      "--socket",
      socket,
    ],
    { stdio: "inherit" },
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (existsSync(socket) && statSync(socket).isSocket()) {
        ready = true;
        break;
      }
      if (proxy.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!ready)
      throw new Error("dependency proxy did not create its fixed socket");
    await run(
      node,
      [
        "--experimental-strip-types",
        `${controller}/candidate-sandbox.mts`,
        action,
      ],
      { cwd: root },
    );
  } finally {
    proxy.kill("SIGTERM");
    if (existsSync(socket)) rmSync(socket);
  }
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === "candidate-install") {
    const root = args[args.indexOf("--candidate-root") + 1];
    if (!root) throw new Error("candidate-install requires --candidate-root");
    await candidate("install", root);
    return;
  }
  if (action === "canary") {
    const root = mkdtempSync(join(tmpdir(), "protected-controller-canary-"));
    try {
      writeFileSync(
        join(root, "package.json"),
        '{"name":"protected-controller-canary","private":true}\n',
      );
      writeFileSync(
        join(root, "pnpm-lock.yaml"),
        "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n",
      );
      await candidate("canary", root);
      process.stdout.write("protected controller canary passed\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    return;
  }
  const bootstrap = new Set([
    "observe",
    "install-temporary",
    "enable-canonical",
    "remove-temporary",
    "verify",
    "rollback",
  ]);
  if (!action || !bootstrap.has(action))
    throw new Error("controller runtime rejected unknown action");
  await run(node, [
    "--experimental-strip-types",
    `${controller}/protected-bootstrap.mts`,
    action,
    ...args,
  ]);
}

await main();
