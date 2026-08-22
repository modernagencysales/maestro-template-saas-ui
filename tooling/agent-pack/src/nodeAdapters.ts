import { execFile as childProcessExecFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  access as nodeAccess,
  readFile as nodeReadFile,
  readdir as nodeReadDirectory,
  realpath as nodeRealpath,
  statfs as nodeStatfs,
} from "node:fs/promises";
import { createServer } from "node:net";
import { arch as nodeArch, platform as nodePlatform } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import type {
  PreflightRuntimeReader,
  PreflightRuntimeSnapshot,
} from "./preflightProbe.js";
import type { RepositoryContext } from "./repoContext.js";
import type {
  VerificationExecFile,
  VerificationExecResult,
} from "./verificationRunner.js";
import { createConfigurationBinding } from "./verificationRunner.js";

type NodeExecError = Error & {
  readonly code?: string | number | null;
  readonly killed?: boolean;
  readonly signal?: NodeJS.Signals | null;
};

type NodeExecOptions = {
  readonly cwd: string;
  readonly shell: false;
  readonly timeout: number;
  readonly maxBuffer: number;
  readonly encoding: "utf8";
  readonly windowsHide: true;
};

type PackageManifest = Record<string, unknown> | undefined;

const NODE_ENGINE_RANGE = "^22.23.2 || ^24.0.0 || >=26.0.0";

function execExitCode(error: NodeExecError | null): number | null {
  if (error === null) return 0;
  if (
    error.code === "ENOENT" ||
    error.code === "ETIMEDOUT" ||
    error.killed === true ||
    error.signal != null
  ) {
    return null;
  }
  return typeof error.code === "number" ? error.code : null;
}

export type NodeExecFilePrimitive = (
  file: string,
  args: readonly string[],
  options: NodeExecOptions,
  callback: (
    error: NodeExecError | null,
    stdout: string,
    stderr: string,
  ) => void,
) => unknown;

const defaultExecFilePrimitive: NodeExecFilePrimitive = (
  file,
  args,
  options,
  callback,
) =>
  childProcessExecFile(file, [...args], options, (error, stdout, stderr) =>
    callback(error, String(stdout), String(stderr)),
  );

export function createNodeExecFileAdapter(
  primitive: NodeExecFilePrimitive = defaultExecFilePrimitive,
): VerificationExecFile {
  return (file, args, options) => {
    if (
      ![options.timeoutMs, options.maxBufferBytes].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      )
    ) {
      return Promise.resolve({ exitCode: null, stdout: "", stderr: "" });
    }
    return new Promise((resolveResult) => {
      const finish = (
        error: NodeExecError | null,
        stdout: string,
        stderr: string,
      ): void => {
        resolveResult({ exitCode: execExitCode(error), stdout, stderr });
      };

      try {
        primitive(
          file,
          args,
          {
            cwd: options.cwd,
            shell: false,
            timeout: options.timeoutMs,
            maxBuffer: options.maxBufferBytes,
            encoding: "utf8",
            windowsHide: true,
          },
          finish,
        );
      } catch {
        resolveResult({ exitCode: null, stdout: "", stderr: "" });
      }
    });
  };
}

export type NodePreflightFileSystem = {
  readonly readFile: (path: string) => Promise<string>;
  readonly readDirectory: (path: string) => Promise<
    readonly {
      readonly name: string;
      readonly kind: "file" | "directory" | "other";
    }[]
  >;
  readonly access: (path: string) => Promise<void>;
  readonly realpath?: (path: string) => Promise<string>;
  readonly statfs: (path: string) => Promise<{
    readonly bavail: number | bigint;
    readonly bsize: number | bigint;
  }>;
};

export const nodePreflightFileSystem: NodePreflightFileSystem = {
  readFile: (path) => nodeReadFile(path, "utf8"),
  readDirectory: async (path) =>
    (await nodeReadDirectory(path, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      kind: entry.isFile()
        ? ("file" as const)
        : entry.isDirectory()
          ? ("directory" as const)
          : ("other" as const),
    })),
  access: (path) => nodeAccess(path),
  realpath: (path) => nodeRealpath(path),
  statfs: async (path) => {
    const result = await nodeStatfs(path);
    return { bavail: result.bavail, bsize: result.bsize };
  },
};

export type WorkflowProjectionRule = {
  readonly id: string;
  readonly subject: string;
  readonly status: "supported" | "intentionally-restricted" | "unsupported";
};

export type NodePreflightPolicy = {
  readonly supportedPlatforms: readonly string[];
  readonly supportedPnpmVersions?: readonly string[];
  readonly minimumGitVersion: string;
  readonly minimumDiskBytes: number;
  readonly requiredPorts: readonly number[];
  readonly metadataTimeoutMs: number;
  readonly maxBufferBytes: number;
};

export function createNodePreflightRuntimeReader(input: {
  readonly fs: NodePreflightFileSystem;
  readonly execFile: VerificationExecFile;
  readonly policy: NodePreflightPolicy;
  readonly workflowRules: readonly WorkflowProjectionRule[];
  readonly publishedWorkflowRuleIds: readonly string[];
  readonly platform?: () => string;
  readonly architecture?: () => string;
  readonly nodeVersion?: () => string;
  readonly environment?: () => Readonly<Record<string, string | undefined>>;
  readonly now?: () => string;
  readonly portAvailable?: (port: number) => Promise<boolean>;
}): PreflightRuntimeReader {
  validatePolicy(input.policy);
  const platform = input.platform ?? nodePlatform;
  const architecture = input.architecture ?? nodeArch;
  const nodeVersion = input.nodeVersion ?? (() => process.version);
  const environment = input.environment ?? (() => process.env);
  const now = input.now ?? (() => new Date().toISOString());
  const portAvailable = input.portAvailable ?? nodeLoopbackPortAvailable;

  return {
    inspect: async (request, repo) => {
      const environmentSnapshot = environment();
      const exec = (file: string, args: readonly string[]) =>
        input.execFile(file, args, {
          cwd: repo.sourceRoot,
          timeoutMs: input.policy.metadataTimeoutMs,
          maxBufferBytes: input.policy.maxBufferBytes,
        });
      const [
        rootManifest,
        convexManifest,
        pnpm,
        network,
        corepack,
        gitVersion,
        gitWorktree,
        commit,
        gitRoot,
        canonicalBase,
        canonicalTag,
        dirty,
        generatedDrift,
        sourceExists,
        templateExists,
        targetExists,
        dependenciesInstalled,
        hostIntegration,
        disk,
        portsReady,
        templateInstanceText,
      ] = await Promise.all([
        readJson(input.fs, resolve(repo.sourceRoot, "package.json")),
        readJson(
          input.fs,
          resolve(repo.sourceRoot, "packages/convex/package.json"),
        ),
        safeExec(exec, "pnpm", ["--version"]),
        networkObservation(request.mode, exec),
        safeExec(exec, "corepack", ["--version"]),
        safeExec(exec, "git", ["--version"]),
        safeExec(exec, "git", ["worktree", "list", "--porcelain"]),
        safeExec(exec, "git", ["rev-parse", "HEAD"]),
        safeExec(exec, "git", ["rev-parse", "--show-toplevel"]),
        safeExec(exec, "git", [
          "symbolic-ref",
          "--short",
          "refs/remotes/origin/HEAD",
        ]),
        safeExec(exec, "git", ["describe", "--tags", "--abbrev=0"]),
        safeExec(exec, "git", [
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
        ]),
        safeExec(exec, "git", [
          "status",
          "--porcelain=v1",
          "--",
          "docs/template/generated",
          "packages/template-core/src/generated",
        ]),
        exists(input.fs, repo.sourceRoot),
        exists(input.fs, repo.templateRoot),
        exists(input.fs, repo.targetRoot),
        exists(input.fs, resolve(repo.sourceRoot, "node_modules")),
        hostIntegrationPosture(input.fs, repo, input.policy.maxBufferBytes),
        diskPosture(input.fs, repo.targetRoot, input.policy.minimumDiskBytes),
        portPosture(input.policy.requiredPorts, portAvailable),
        optionalText(
          input.fs,
          resolve(repo.targetRoot, "template-instance.json"),
        ),
      ]);

      const currentNode = nodeVersion().replace(/^v/, "");
      const currentPnpm = successfulText(pnpm) ?? "unavailable";
      const requiredPnpm = packageManagerVersion(rootManifest);
      const currentGit =
        successfulText(gitVersion)?.match(/(\d+(?:\.\d+){1,2})/)?.[1] ??
        "unavailable";
      const worktreeSupported = gitWorktree.exitCode === 0;
      const gitVersionSupported = versionAtLeast(
        currentGit,
        input.policy.minimumGitVersion,
      );
      const versionAuthority = await resolveVersionAuthority(
        exec,
        templateInstanceText,
        successfulText(commit),
      );
      const versions = packageVersions(
        rootManifest,
        convexManifest,
        versionAuthority,
      );
      const os = platform();
      const repository = repositoryPosture(repo, {
        sourceExists,
        templateExists,
        targetExists,
      });
      const workflow = workflowProjection(
        input.workflowRules,
        input.publishedWorkflowRuleIds,
      );
      const nodeSupported = supportedNode(currentNode);
      const pnpmSupported = supportedPnpm(
        currentPnpm,
        requiredPnpm,
        input.policy.supportedPnpmVersions,
      );
      const packageVersionsBound = versionsBoundToOneAuthority(versions);
      const observedGitRoot = successfulText(gitRoot);
      const dirtyPaths = successfulPorcelainPaths(dirty);
      const collisions = collisionPosture(repo, dirtyPaths);
      const availableEnvironmentNames =
        configuredEnvironmentNames(environmentSnapshot);
      const networkPosture = observedNetworkPosture(network);
      const authPosture = request.mode === "fake" ? "not-required" : "unknown";
      const rootMatches = await observedRootMatches(
        input.fs,
        observedGitRoot,
        repo.sourceRoot,
      );
      const generatedDriftPosture = observedGeneratedDrift(generatedDrift);

      return {
        host: hostSnapshot({
          architecture: architecture(),
          corepack,
          currentGit,
          currentNode,
          currentPnpm,
          gitVersion,
          gitVersionSupported,
          nodeSupported,
          os,
          pnpmSupported,
          policy: input.policy,
          requiredPnpm,
          worktreeSupported,
        }),
        prerequisites: {
          dependencies: dependenciesInstalled ? "installed" : "missing",
          disk,
          ports: portsReady,
        },
        repository: repositorySnapshot({
          canonicalBase,
          canonicalTag,
          collisions,
          commit,
          dirtyPaths,
          generatedDriftPosture,
          hostIntegration,
          observedGitRoot,
          repository,
          rootMatches,
        }),
        network: networkPosture,
        auth: authPosture,
        observationDiagnostics: observationDiagnostics({
          authPosture,
          collisions,
          dirtyPaths,
          generatedDriftPosture,
          networkPosture,
          rootMatches,
        }),
        versionsCompatible: compatibleVersions({
          gitVersion,
          gitVersionSupported,
          nodeSupported,
          osSupported: input.policy.supportedPlatforms.includes(os),
          packageVersionsBound,
          pnpmSupported,
          worktreeSupported,
        }),
        versions,
        workflow,
        availableEnvironmentNames,
        environmentBinding: createConfigurationBinding("environment", {
          sourceRoot: repo.sourceRoot,
          targetRoot: repo.targetRoot,
          mode: request.mode,
          configured: Object.fromEntries(
            availableEnvironmentNames.map((name) => [
              name,
              environmentSnapshot[name],
            ]),
          ),
        }),
        templateInstanceText,
        observedAt: now(),
      } satisfies PreflightRuntimeSnapshot;
    },
  };
}

function networkObservation(
  mode: "fake" | "live" | "test",
  exec: (
    file: string,
    args: readonly string[],
  ) => Promise<VerificationExecResult>,
): Promise<VerificationExecResult> {
  return mode === "fake"
    ? Promise.resolve({ exitCode: 1, stdout: "", stderr: "" })
    : safeExec(exec, "pnpm", [
        "ping",
        "--registry",
        "https://registry.npmjs.org",
      ]);
}

function supportedNode(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return false;
  const major = Number(match[1]);
  if (major === 22) return versionAtLeast(version, "22.23.2");
  return major === 24 || major >= 26;
}

function supportedPnpm(
  current: string,
  required: string,
  compatible: readonly string[] | undefined,
): boolean {
  return (
    required !== "unavailable" &&
    (current === required || (compatible ?? []).includes(current))
  );
}

function successfulPorcelainPaths(
  result: VerificationExecResult,
): readonly string[] | undefined {
  return result.exitCode === 0 ? porcelainPaths(result.stdout) : undefined;
}

function collisionPosture(
  repo: RepositoryContext,
  dirtyPaths: readonly string[] | undefined,
): PreflightRuntimeSnapshot["repository"]["collisions"] {
  return dirtyPaths === undefined
    ? "unknown"
    : targetDirtyCollisions(repo, dirtyPaths);
}

function configuredEnvironmentNames(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return Object.entries(environment)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([name]) => name)
    .sort();
}

function observedNetworkPosture(
  result: VerificationExecResult,
): PreflightRuntimeSnapshot["network"] {
  if (result.exitCode === 0) return "online";
  return typeof result.exitCode === "number" ? "offline" : "unknown";
}

async function observedRootMatches(
  fs: NodePreflightFileSystem,
  observedRoot: string | undefined,
  sourceRoot: string,
): Promise<PreflightRuntimeSnapshot["repository"]["rootMatches"]> {
  if (observedRoot === undefined) return "unknown";
  const [canonicalObservedRoot, canonicalSourceRoot] = await Promise.all([
    canonicalPath(fs, observedRoot),
    canonicalPath(fs, sourceRoot),
  ]);
  return canonicalObservedRoot === canonicalSourceRoot;
}

function observedGeneratedDrift(
  result: VerificationExecResult,
): PreflightRuntimeSnapshot["repository"]["generatedDrift"] {
  return result.exitCode === 0 ? result.stdout.trim().length > 0 : "unknown";
}

function hostSnapshot(input: {
  readonly architecture: string;
  readonly corepack: VerificationExecResult;
  readonly currentGit: string;
  readonly currentNode: string;
  readonly currentPnpm: string;
  readonly gitVersion: VerificationExecResult;
  readonly gitVersionSupported: boolean;
  readonly nodeSupported: boolean;
  readonly os: string;
  readonly pnpmSupported: boolean;
  readonly policy: NodePreflightPolicy;
  readonly requiredPnpm: string;
  readonly worktreeSupported: boolean;
}): PreflightRuntimeSnapshot["host"] {
  return {
    os: input.os,
    architecture: input.architecture,
    osSupported: input.policy.supportedPlatforms.includes(input.os),
    node: {
      current: input.currentNode,
      required: NODE_ENGINE_RANGE,
      supported: input.nodeSupported,
    },
    pnpm: {
      current: input.currentPnpm,
      required: input.requiredPnpm,
      supported: input.pnpmSupported,
    },
    corepack: input.corepack.exitCode === 0 ? "ready" : "missing",
    git: {
      current: input.currentGit,
      required: `>=${input.policy.minimumGitVersion} with worktree support`,
      supported:
        input.gitVersion.exitCode === 0 &&
        input.gitVersionSupported &&
        input.worktreeSupported,
      worktree: input.worktreeSupported,
    },
  };
}

function repositorySnapshot(input: {
  readonly canonicalBase: VerificationExecResult;
  readonly canonicalTag: VerificationExecResult;
  readonly collisions: PreflightRuntimeSnapshot["repository"]["collisions"];
  readonly commit: VerificationExecResult;
  readonly dirtyPaths: readonly string[] | undefined;
  readonly generatedDriftPosture: PreflightRuntimeSnapshot["repository"]["generatedDrift"];
  readonly hostIntegration: PreflightRuntimeSnapshot["repository"]["hostIntegration"];
  readonly observedGitRoot: string | undefined;
  readonly repository: ReturnType<typeof repositoryPosture>;
  readonly rootMatches: PreflightRuntimeSnapshot["repository"]["rootMatches"];
}): PreflightRuntimeSnapshot["repository"] {
  return {
    ...input.repository,
    commit: successfulText(input.commit) ?? "unavailable",
    gitRoot:
      input.observedGitRoot === undefined
        ? "unavailable"
        : comparableRepositoryPath(input.observedGitRoot),
    rootMatches: input.rootMatches,
    canonicalBase:
      successfulText(input.canonicalBase)?.replace(/^origin\//, "") ??
      "unavailable",
    canonicalTag: successfulText(input.canonicalTag) ?? "unavailable",
    dirty:
      input.dirtyPaths === undefined ? "unknown" : input.dirtyPaths.length > 0,
    generatedDrift: input.generatedDriftPosture,
    collisions: input.collisions,
    hostIntegration: input.hostIntegration,
  };
}

function observationDiagnostics(input: {
  readonly authPosture: PreflightRuntimeSnapshot["auth"];
  readonly collisions: PreflightRuntimeSnapshot["repository"]["collisions"];
  readonly dirtyPaths: readonly string[] | undefined;
  readonly generatedDriftPosture: PreflightRuntimeSnapshot["repository"]["generatedDrift"];
  readonly networkPosture: PreflightRuntimeSnapshot["network"];
  readonly rootMatches: PreflightRuntimeSnapshot["repository"]["rootMatches"];
}): NonNullable<PreflightRuntimeSnapshot["observationDiagnostics"]> {
  return {
    ...(input.networkPosture === "unknown"
      ? {
          network:
            "The bounded pnpm registry probe timed out or its executable was unavailable.",
        }
      : {}),
    ...(input.authPosture === "unknown"
      ? {
          auth: "Read-only preflight inspected provider configuration names but does not authenticate or read credential values.",
        }
      : {}),
    ...(input.rootMatches === "unknown"
      ? { root: "git rev-parse --show-toplevel was unavailable." }
      : {}),
    ...(input.dirtyPaths === undefined
      ? { dirty: "git status was unavailable or timed out." }
      : {}),
    ...(input.collisions === "unknown"
      ? {
          collisions:
            "Collision attribution requires a successful bounded git status observation.",
        }
      : {}),
    ...(input.generatedDriftPosture === "unknown"
      ? {
          generatedDrift:
            "Generated-path git status was unavailable or timed out.",
        }
      : {}),
  };
}

function compatibleVersions(input: {
  readonly gitVersion: VerificationExecResult;
  readonly gitVersionSupported: boolean;
  readonly nodeSupported: boolean;
  readonly osSupported: boolean;
  readonly packageVersionsBound: boolean;
  readonly pnpmSupported: boolean;
  readonly worktreeSupported: boolean;
}): boolean {
  return (
    input.osSupported &&
    input.nodeSupported &&
    input.pnpmSupported &&
    input.gitVersion.exitCode === 0 &&
    input.gitVersionSupported &&
    input.worktreeSupported &&
    input.packageVersionsBound
  );
}

function porcelainPaths(stdout: string): readonly string[] {
  const records = stdout.split("\0");
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length < 4) continue;
    const status = record.slice(0, 2);
    const path = record.slice(3);
    if (path.length > 0) paths.push(path);
    if (/[RC]/.test(status)) {
      const source = records[index + 1];
      if (source !== undefined && source.length > 0) paths.push(source);
      index += 1;
    }
  }
  return [...new Set(paths)].sort();
}

function targetDirtyCollisions(
  repo: RepositoryContext,
  paths: readonly string[],
): readonly string[] {
  const targetFromSource = relative(repo.sourceRoot, repo.targetRoot);
  if (targetFromSource === "") return [...paths];
  if (
    targetFromSource === ".." ||
    targetFromSource.startsWith(`..${sep}`) ||
    targetFromSource.startsWith(sep)
  ) {
    return [];
  }
  const prefix = `${targetFromSource.split(sep).join("/")}/`;
  return paths
    .map((path) => path.split(sep).join("/"))
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length));
}

export async function nodeLoopbackPortAvailable(
  port: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) return false;
  return new Promise((resolveAvailability) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveAvailability(false));
    server.listen(port, "127.0.0.1", () =>
      server.close(() => resolveAvailability(true)),
    );
  });
}

function validatePolicy(policy: NodePreflightPolicy): void {
  const positive = [policy.metadataTimeoutMs, policy.maxBufferBytes];
  if (
    policy.supportedPlatforms.length === 0 ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(policy.minimumGitVersion) ||
    !positive.every((value) => Number.isSafeInteger(value) && value > 0) ||
    !Number.isSafeInteger(policy.minimumDiskBytes) ||
    policy.minimumDiskBytes < 0 ||
    !policy.requiredPorts.every(
      (port) => Number.isSafeInteger(port) && port > 0 && port <= 65_535,
    )
  ) {
    throw new Error(
      "Node preflight policy must contain bounded positive values.",
    );
  }
}

async function safeExec(
  exec: (
    file: string,
    args: readonly string[],
  ) => Promise<VerificationExecResult>,
  file: string,
  args: readonly string[],
): Promise<VerificationExecResult> {
  try {
    return await exec(file, args);
  } catch {
    return { exitCode: null, stdout: "", stderr: "" };
  }
}

async function readJson(
  fs: NodePreflightFileSystem,
  path: string,
): Promise<PackageManifest> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(path));
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function optionalText(
  fs: NodePreflightFileSystem,
  path: string,
): Promise<string | undefined> {
  try {
    return await fs.readFile(path);
  } catch {
    return undefined;
  }
}

async function exists(
  fs: NodePreflightFileSystem,
  path: string,
): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function hostIntegrationPosture(
  fs: NodePreflightFileSystem,
  repo: RepositoryContext,
  maxBytes: number,
): Promise<"current" | "stale" | "not-installed"> {
  const installedRoot = resolve(repo.targetRoot, ".agents/skills/maestro");
  if (!(await exists(fs, resolve(installedRoot, "SKILL.md")))) {
    return "not-installed";
  }
  const installed = await managedFileHashes(fs, installedRoot, maxBytes);
  if (installed === undefined || !installed.has("SKILL.md")) return "stale";

  const [canonical, rootManifest, packagedManifest] = await Promise.all([
    managedFileHashes(
      fs,
      resolve(repo.sourceRoot, "agent-pack/skills/maestro"),
      maxBytes,
    ),
    optionalText(
      fs,
      resolve(repo.targetRoot, "customer-context.manifest.json"),
    ),
    optionalText(
      fs,
      resolve(repo.targetRoot, "docs/template/customer-context.manifest.json"),
    ),
  ]);
  const manifestText = rootManifest ?? packagedManifest;
  if (manifestText !== undefined) {
    return manifestIntegrationPosture(manifestText, installed, canonical);
  }

  if (canonical === undefined || canonical.size === 0) return "stale";
  return sameHashes(canonical, installed) ? "current" : "stale";
}

function manifestIntegrationPosture(
  manifestText: string,
  installed: ReadonlyMap<string, string>,
  canonical: ReadonlyMap<string, string> | undefined,
): "current" | "stale" {
  const expected = managedManifestHashes(manifestText);
  if (expected === undefined || !sameHashes(expected, installed))
    return "stale";
  return canonical === undefined || sameHashes(expected, canonical)
    ? "current"
    : "stale";
}

async function managedFileHashes(
  fs: NodePreflightFileSystem,
  root: string,
  maxBytes: number,
): Promise<ReadonlyMap<string, string> | undefined> {
  const hashes = new Map<string, string>();
  let totalBytes = 0;
  const validName = (name: string): boolean =>
    name.length > 0 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\");
  const visitEntry = async (
    entry: Awaited<
      ReturnType<NodePreflightFileSystem["readDirectory"]>
    >[number],
    directory: string,
    prefix: string,
    visit: (childDirectory: string, childPrefix: string) => Promise<boolean>,
  ): Promise<boolean> => {
    if (!validName(entry.name)) return false;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = resolve(directory, entry.name);
    if (entry.kind === "directory") return visit(absolutePath, relativePath);
    if (entry.kind !== "file") return false;
    const content = await optionalText(fs, absolutePath);
    if (content === undefined) return false;
    totalBytes += Buffer.byteLength(content, "utf8");
    if (totalBytes > maxBytes) return false;
    hashes.set(
      relativePath,
      `sha256:${createHash("sha256").update(content).digest("hex")}`,
    );
    return true;
  };
  const visit = async (directory: string, prefix: string): Promise<boolean> => {
    let entries;
    try {
      entries = await fs.readDirectory(directory);
    } catch {
      return false;
    }
    if (entries.length > 64 || hashes.size + entries.length > 64) return false;
    for (const entry of [...entries].sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      if (!(await visitEntry(entry, directory, prefix, visit))) return false;
    }
    return true;
  };
  return (await visit(root, "")) ? hashes : undefined;
}

function managedManifestHashes(
  text: string,
): ReadonlyMap<string, string> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (!isManagedManifest(value)) return undefined;
    const prefix = ".agents/skills/maestro/";
    const hashes = new Map<string, string>();
    for (const entry of value.files) {
      if (!isManagedManifestEntry(entry) || !entry.path.startsWith(prefix)) {
        continue;
      }
      const relativePath = entry.path.slice(prefix.length);
      if (!validManagedManifestHash(entry.sha256, relativePath, hashes)) {
        return undefined;
      }
      hashes.set(relativePath, entry.sha256);
    }
    return hashes.has("SKILL.md") ? hashes : undefined;
  } catch {
    return undefined;
  }
}

function isManagedManifest(
  value: unknown,
): value is { readonly files: readonly unknown[]; readonly schemaVersion: 1 } {
  return (
    isRecord(value) && value.schemaVersion === 1 && Array.isArray(value.files)
  );
}

function isManagedManifestEntry(
  value: unknown,
): value is { readonly path: string; readonly sha256?: unknown } {
  return isRecord(value) && typeof value.path === "string";
}

function validManagedManifestHash(
  hash: unknown,
  path: string,
  hashes: ReadonlyMap<string, string>,
): hash is string {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split("/").includes("..") &&
    typeof hash === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(hash) &&
    !hashes.has(path)
  );
}

function sameHashes(
  expected: ReadonlyMap<string, string>,
  actual: ReadonlyMap<string, string>,
): boolean {
  return (
    expected.size === actual.size &&
    [...expected].every(([path, hash]) => actual.get(path) === hash)
  );
}

async function diskPosture(
  fs: NodePreflightFileSystem,
  targetRoot: string,
  minimumDiskBytes: number,
): Promise<"ready" | "low" | "unknown"> {
  try {
    const stats = await fs.statfs(
      (await exists(fs, targetRoot)) ? targetRoot : dirname(targetRoot),
    );
    const available = BigInt(stats.bavail) * BigInt(stats.bsize);
    return available >= BigInt(minimumDiskBytes) ? "ready" : "low";
  } catch {
    return "unknown";
  }
}

async function portPosture(
  ports: readonly number[],
  available: (port: number) => Promise<boolean>,
): Promise<"ready" | "blocked" | "not-required"> {
  if (ports.length === 0) return "not-required";
  const results = await Promise.all(
    ports.map(async (port) => {
      try {
        return await available(port);
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean) ? "ready" : "blocked";
}

function repositoryPosture(
  repo: RepositoryContext,
  existence: {
    readonly sourceExists: boolean;
    readonly templateExists: boolean;
    readonly targetExists: boolean;
  },
): Pick<PreflightRuntimeSnapshot["repository"], "role" | "rootRoles"> {
  const sourceIsTemplate = repo.sourceRoot === repo.templateRoot;
  const sourceIsTarget = repo.sourceRoot === repo.targetRoot;
  const role =
    !existence.sourceExists || !existence.templateExists
      ? "ambiguous"
      : sourceIsTemplate && sourceIsTarget
        ? "canonical-clone"
        : sourceIsTarget
          ? "existing-app"
          : "greenfield";
  return {
    role,
    rootRoles: {
      source: sourceIsTemplate ? "canonical" : "existing-app",
      template: "immutable-template",
      target:
        role === "canonical-clone"
          ? "canonical"
          : role === "greenfield"
            ? "new-target"
            : "existing-app",
    },
  };
}

function packageVersions(
  root: PackageManifest,
  convex: PackageManifest,
  authority: string | undefined,
): PreflightRuntimeSnapshot["versions"] {
  const dependencies = {
    ...record(root?.dependencies),
    ...record(root?.devDependencies),
    ...record(convex?.dependencies),
    ...record(convex?.devDependencies),
  };
  return {
    pack: manifestVersion(authority),
    cli: manifestVersion(authority),
    template: manifestVersion(authority),
    convex: dependencyVersion(dependencies, "convex"),
    workflow: dependencyVersion(dependencies, "@convex-dev/workflow"),
    workpool: dependencyVersion(dependencies, "@convex-dev/workpool"),
    confect:
      dependencyVersion(dependencies, "@confect/core") === "unavailable"
        ? dependencyVersion(dependencies, "@confect/js")
        : dependencyVersion(dependencies, "@confect/core"),
    effect: dependencyVersion(dependencies, "effect"),
  };
}

function workflowProjection(
  rules: readonly WorkflowProjectionRule[],
  publishedRuleIds: readonly string[],
): PreflightRuntimeSnapshot["workflow"] {
  const primitives = rules.filter(({ subject }) =>
    subject.startsWith("primitive."),
  );
  const subjects = (status: WorkflowProjectionRule["status"]) =>
    primitives
      .filter((rule) => rule.status === status)
      .map(({ subject }) => subject.slice("primitive.".length));
  const currentIds = [...rules.map(({ id }) => id)].sort();
  const publishedIds = [...publishedRuleIds].sort();
  const publishedDrift =
    JSON.stringify(currentIds) !== JSON.stringify(publishedIds);
  const restricted = subjects("intentionally-restricted");
  const unsupported = subjects("unsupported");
  return {
    status: publishedDrift
      ? "unsupported"
      : restricted.length > 0 || unsupported.length > 0
        ? "restricted"
        : "supported",
    accepted: subjects("supported"),
    restricted,
    unsupported,
    publishedDrift,
    rerun: "pnpm check:workflow:fast",
  };
}

function packageManagerVersion(manifest: PackageManifest): string {
  const packageManager = manifest?.packageManager;
  if (typeof packageManager !== "string") return "unavailable";
  return packageManager.match(/^pnpm@(.+)$/)?.[1] ?? "unavailable";
}

function manifestVersion(authority: string | undefined): string {
  return authority ?? "unavailable";
}

type ReleaseAuthorityCandidate = {
  readonly version: string;
  readonly tag: string;
  readonly sourceCommit: string;
  readonly sourceChecksum: string;
  readonly manifest: string;
  readonly manifestChecksum: string;
};

type ReleaseAuthorityPosture =
  | { readonly status: "absent" }
  | { readonly status: "invalid" }
  | {
      readonly status: "candidate";
      readonly value: ReleaseAuthorityCandidate;
    };

async function resolveVersionAuthority(
  _exec: (
    file: string,
    args: readonly string[],
  ) => Promise<VerificationExecResult>,
  templateInstanceText: string | undefined,
  commit: string | undefined,
): Promise<string | undefined> {
  const release = releaseAuthorityCandidate(templateInstanceText);
  if (release.status === "absent") return gitVersionAuthority(commit);
  if (
    release.status === "invalid" ||
    gitVersionAuthority(commit) === undefined
  ) {
    return undefined;
  }

  const candidate = release.value;
  return `release:${candidate.version}@${candidate.sourceCommit}`;
}

function releaseAuthorityCandidate(
  text: string | undefined,
): ReleaseAuthorityPosture {
  if (text === undefined) return { status: "absent" };
  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) return { status: "invalid" };
    if (!Object.hasOwn(value, "release")) return { status: "absent" };
    if (!isReleaseFields(value.release)) {
      return { status: "invalid" };
    }
    if (!isOwnershipFields(value.ownership, value.release.version)) {
      return { status: "invalid" };
    }
    const { version, tag, sourceCommit, sourceChecksum } = value.release;
    const { manifest, manifestChecksum } = value.ownership;
    return {
      status: "candidate",
      value: {
        version,
        tag,
        sourceCommit,
        sourceChecksum,
        manifest,
        manifestChecksum,
      },
    };
  } catch {
    return { status: "invalid" };
  }
}

function isReleaseFields(
  value: unknown,
): value is Omit<ReleaseAuthorityCandidate, "manifest" | "manifestChecksum"> {
  if (!isRecord(value)) return false;
  const { version, tag, sourceCommit, sourceChecksum } = value;
  return (
    typeof version === "string" &&
    exactSemver(version) &&
    tag === `maestro-template-v${version}` &&
    typeof sourceCommit === "string" &&
    /^[0-9a-f]{40}$/.test(sourceCommit) &&
    typeof sourceChecksum === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(sourceChecksum)
  );
}

function isOwnershipFields(
  value: unknown,
  version: string,
): value is Pick<ReleaseAuthorityCandidate, "manifest" | "manifestChecksum"> {
  if (!isRecord(value)) return false;
  const { manifest, manifestChecksum } = value;
  return (
    manifest === `releases/v${version}/manifest.json` &&
    typeof manifestChecksum === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(manifestChecksum)
  );
}

function versionsBoundToOneAuthority(
  versions: PreflightRuntimeSnapshot["versions"],
): boolean {
  const authority = versions.pack;
  const immutableAuthority =
    /^git:[0-9a-f]{40}$/.test(authority) ||
    /^release:[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?@[0-9a-f]{40}$/.test(
      authority,
    );
  return (
    immutableAuthority &&
    versions.cli === authority &&
    versions.template === authority &&
    [
      versions.convex,
      versions.workpool,
      versions.confect,
      versions.effect,
    ].every((version) => version !== "unavailable")
  );
}

function comparableRepositoryPath(path: string): string {
  return resolve(path).replace(/^\/private(?=\/(?:etc|tmp|var)(?:\/|$))/u, "");
}

function gitVersionAuthority(commit: string | undefined): string | undefined {
  return typeof commit === "string" && /^[0-9a-f]{40}$/.test(commit)
    ? `git:${commit}`
    : undefined;
}

function exactSemver(value: string): boolean {
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function dependencyVersion(
  dependencies: Record<string, unknown>,
  name: string,
): string {
  const value = dependencies[name];
  return typeof value === "string" ? value : "unavailable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function successfulText(result: VerificationExecResult): string | undefined {
  if (result.exitCode !== 0) return undefined;
  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

async function canonicalPath(
  fs: NodePreflightFileSystem,
  path: string,
): Promise<string> {
  if (fs.realpath === undefined) return resolve(path);
  try {
    return resolve(await fs.realpath(path));
  } catch {
    return resolve(path);
  }
}

function versionAtLeast(current: string, minimum: string): boolean {
  const currentParts = current.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);
  if (
    currentParts.length < 2 ||
    minimumParts.length < 2 ||
    [...currentParts, ...minimumParts].some(
      (part) => !Number.isSafeInteger(part) || part < 0,
    )
  ) {
    return false;
  }
  for (let index = 0; index < 3; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (currentPart !== minimumPart) return currentPart > minimumPart;
  }
  return true;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
