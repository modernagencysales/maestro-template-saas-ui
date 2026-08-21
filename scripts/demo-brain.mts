import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import {
  assertCanonicalBranch,
  assertDemoPageText,
  assertPortAvailable,
  parseDemoArgs,
  type DemoPageContract,
} from "./demo-brain-lib.mts";

type DemoManifest = DemoPageContract & {
  readonly product: string;
  readonly canonicalBranch: string;
  readonly defaultRoute: string;
  readonly host: string;
  readonly port: number;
  readonly mode: string;
  readonly backend: string;
};

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(repositoryRoot, "demo/maestro-brain.json"), "utf8"),
) as DemoManifest;
const args = parseDemoArgs(process.argv.slice(2));
const artifactRoot = "/tmp/maestro-brain-demo";

const git = (...gitArgs: readonly string[]): string =>
  execFileSync("git", [...gitArgs], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();

const currentBranch =
  process.env.BUILDKITE_BRANCH?.trim() || git("branch", "--show-current");
assertCanonicalBranch(currentBranch, manifest.canonicalBranch);

const dirty = git("status", "--porcelain", "--untracked-files=no");
if (dirty) {
  throw new Error(
    "Refusing to launch from a dirty canonical checkout. Commit or preserve the changes first.",
  );
}

const remoteRef = `refs/remotes/origin/${manifest.canonicalBranch}`;
if (
  spawnSync("git", ["show-ref", "--verify", "--quiet", remoteRef], {
    cwd: repositoryRoot,
  }).status === 0
) {
  const [ahead, behind] = git(
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...origin/${manifest.canonicalBranch}`,
  )
    .split(/\s+/)
    .map(Number);
  if ((behind ?? 0) > 0) {
    throw new Error(
      `Canonical checkout is ${behind} commit(s) behind origin/${manifest.canonicalBranch}. Run git pull --ff-only before the demo.`,
    );
  }
  if ((ahead ?? 0) > 0) {
    process.stdout.write(
      `Note: canonical checkout is ${ahead} commit(s) ahead of origin and must be pushed before external use.\n`,
    );
  }
}

await assertPortAvailable(args.host, args.port);

const commit = git("rev-parse", "--short=12", "HEAD");
const buildEnvironment = {
  ...process.env,
  APP_PROVIDER_MODE: "fake",
  VITE_CONVEX_URL: "",
  VITE_DEMO_PRODUCT: manifest.product,
  VITE_DEMO_REF: manifest.canonicalBranch,
  VITE_DEMO_MODE: manifest.mode,
  VITE_DEMO_BACKEND: manifest.backend,
  VITE_DEMO_COMMIT: commit,
};

const build = spawnSync("pnpm", ["--dir", "apps/web", "build"], {
  cwd: repositoryRoot,
  env: buildEnvironment,
  stdio: "inherit",
});
if (build.status !== 0) {
  throw new Error(
    `Maestro Brain demo build failed with status ${build.status}.`,
  );
}

const clientRoot = join(repositoryRoot, "apps/web/dist/client");
const serverEntry = join(repositoryRoot, "apps/web/dist/server/server.js");
const server = await createDemoServer(clientRoot, serverEntry);
await new Promise<void>((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(args.port, args.host, resolveListen);
});

const origin = `http://${args.host}:${args.port}`;
const url = `${origin}${manifest.defaultRoute}`;
mkdirSync(artifactRoot, { recursive: true });

try {
  const screenshot = join(artifactRoot, "maestro-brain.png");
  const pageErrors: string[] = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) {
      throw new Error(
        `Demo route returned HTTP ${response?.status() ?? "unknown"}.`,
      );
    }
    await page.getByRole("navigation", { name: "Primary" }).waitFor();
    const pageText = await page.locator("body").innerText();
    assertDemoPageText(pageText, manifest);
    const identity = page
      .getByRole("complementary")
      .getByTestId("demo-build-identity");
    await identity.waitFor();
    const identityText = await identity.innerText();
    if (
      !identityText.includes(manifest.canonicalBranch) ||
      !identityText.includes(commit)
    ) {
      throw new Error(
        "Visible demo identity does not match the canonical ref and commit.",
      );
    }
    if (pageErrors.length > 0) {
      throw new Error(`Demo raised browser errors: ${pageErrors.join(" | ")}`);
    }
    await page.screenshot({ path: screenshot, fullPage: true });
  } finally {
    await browser.close();
  }

  const receipt = {
    product: manifest.product,
    canonicalBranch: manifest.canonicalBranch,
    commit,
    mode: manifest.mode,
    backend: manifest.backend,
    url,
    requiredText: manifest.requiredText,
    forbiddenText: manifest.forbiddenText,
    verifiedAt: new Date().toISOString(),
    screenshot,
  };
  writeFileSync(
    join(artifactRoot, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  process.stdout.write(
    `\nVerified ${manifest.product} ${commit}\n${url}\nReceipt: ${artifactRoot}/receipt.json\n`,
  );

  if (args.verifyOnly) {
    await closeServer(server);
    process.exitCode = 0;
  } else {
    if (args.openBrowser) openUrl(url);
    process.stdout.write("Press Ctrl-C to stop the canonical demo server.\n");
    const stop = () => void closeServer(server);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    await once(server, "close");
  }
} catch (error) {
  await closeServer(server);
  throw error;
}

async function createDemoServer(
  root: string,
  serverEntry: string,
): Promise<Server> {
  const startServer = (await import(serverEntry)) as {
    readonly default: {
      readonly fetch: (request: Request) => Promise<Response>;
    };
  };

  return createServer(async (request, response) => {
    try {
      const rawPath = new URL(request.url ?? "/", "http://demo.local").pathname;
      const decodedPath = decodeURIComponent(rawPath);
      const relativePath = normalize(decodedPath).replace(/^[/\\]+/, "");
      const target = join(root, relativePath);
      if (!target.startsWith(root)) {
        response.writeHead(400).end("Invalid path");
        return;
      }
      if (
        relativePath &&
        existsSync(target) &&
        !statSync(target).isDirectory()
      ) {
        response.setHeader("Content-Type", contentTypeFor(target));
        response.setHeader("Cache-Control", "no-store");
        response.writeHead(200);
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        createReadStream(target).pipe(response);
        return;
      }

      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(name, item);
        } else if (value !== undefined) {
          headers.set(name, value);
        }
      }
      const appResponse = await startServer.default.fetch(
        new Request(
          `http://${request.headers.host ?? `${manifest.host}:${manifest.port}`}${request.url ?? "/"}`,
          { method: request.method, headers },
        ),
      );
      for (const [name, value] of appResponse.headers) {
        response.setHeader(name, value);
      }
      response.setHeader("Cache-Control", "no-store");
      response.writeHead(appResponse.status);
      response.end(Buffer.from(await appResponse.arrayBuffer()));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.stack : String(error));
    }
  });
}

function contentTypeFor(path: string): string {
  const types: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
  };
  return types[extname(path)] ?? "application/octet-stream";
}

function openUrl(url: string): void {
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const opener = spawn(command, [url], { detached: true, stdio: "ignore" });
  opener.unref();
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
