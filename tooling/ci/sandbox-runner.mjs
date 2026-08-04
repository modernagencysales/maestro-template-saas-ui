/* global fetch, process, setTimeout */
import { spawn, spawnSync } from "node:child_process";

const action = process.argv[2];
if (action !== "fetch" && action !== "install")
  throw new Error("sandbox runner requires fetch or install");

const bridge = spawn(
  "/runtime/bin/socat",
  [
    "TCP-LISTEN:4873,bind=127.0.0.1,fork,reuseaddr",
    "UNIX-CONNECT:/proxy/dependency.sock",
  ],
  { stdio: "inherit" },
);

try {
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch("http://127.0.0.1:4873/health").catch(
      () => undefined,
    );
    if (response?.ok) {
      healthy = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!healthy)
    throw new Error("controller dependency proxy bridge is unhealthy");
  const env = {
    CI: "true",
    HOME: "/tmp/candidate-home",
    npm_config_registry: "http://127.0.0.1:4873",
  };
  const runPnpm = (args) =>
    spawnSync("/runtime/bin/node", ["/runtime/pnpm/bin/pnpm.cjs", ...args], {
      env,
      stdio: "inherit",
    }).status ?? 1;
  const fetched = runPnpm(["fetch", "--frozen-lockfile", "--ignore-scripts"]);
  process.exitCode =
    fetched === 0 && action === "install"
      ? runPnpm([
          "install",
          "--offline",
          "--frozen-lockfile",
          "--ignore-scripts",
        ])
      : fetched;
} finally {
  bridge.kill("SIGTERM");
}
