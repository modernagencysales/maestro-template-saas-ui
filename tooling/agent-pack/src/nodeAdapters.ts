import { execFile as childProcessExecFile } from "node:child_process";
import {
  access as nodeAccess,
  readFile as nodeReadFile,
  statfs as nodeStatfs,
} from "node:fs/promises";
import { createServer } from "node:net";
import { arch as nodeArch, platform as nodePlatform } from "node:os";
import { dirname, resolve } from "node:path";
import type {
  PreflightRuntimeReader,
  PreflightRuntimeSnapshot,
} from "./preflightProbe.js";
import type { RepositoryContext } from "./repoContext.js";
import type {
  VerificationExecFile,
  VerificationExecResult,
} from "./verificationRunner.js";

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
        const unavailable =
          error?.code === "ENOENT" ||
          error?.code === "ETIMEDOUT" ||
          error?.killed === true ||
          error?.signal != null;
        const exitCode =
          error === null
            ? 0
            : unavailable
              ? null
              : typeof error.code === "number"
                ? error.code
                : null;
        resolveResult({ exitCode, stdout, stderr });
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
  readonly access: (path: string) => Promise<void>;
  readonly statfs: (path: string) => Promise<{
    readonly bavail: number | bigint;
    readonly bsize: number | bigint;
  }>;
};

export const nodePreflightFileSystem: NodePreflightFileSystem = {
  readFile: (path) => nodeReadFile(path, "utf8"),
  access: (path) => nodeAccess(path),
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
  readonly supportedNodeMajors: readonly number[];
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
    inspect: async (_request, repo) => {
      const exec = (file: string, args: readonly string[]) =>
        input.execFile(file, args, {
          cwd: repo.sourceRoot,
          timeoutMs: input.policy.metadataTimeoutMs,
          maxBufferBytes: input.policy.maxBufferBytes,
        });
      const [
        rootManifest,
        templateManifest,
        convexManifest,
        cliManifest,
        packManifest,
        pnpm,
        corepack,
        gitVersion,
        gitWorktree,
        commit,
        canonicalBase,
        canonicalTag,
        dirty,
        generatedDrift,
        sourceExists,
        templateExists,
        targetExists,
        dependenciesInstalled,
        hostIntegrationInstalled,
        disk,
        portsReady,
        templateInstanceText,
      ] = await Promise.all([
        readJson(input.fs, resolve(repo.sourceRoot, "package.json")),
        readJson(input.fs, resolve(repo.templateRoot, "package.json")),
        readJson(
          input.fs,
          resolve(repo.sourceRoot, "packages/convex/package.json"),
        ),
        readJson(input.fs, resolve(repo.sourceRoot, "apps/cli/package.json")),
        readJson(
          input.fs,
          resolve(repo.sourceRoot, "tooling/agent-pack/package.json"),
        ),
        safeExec(exec, "pnpm", ["--version"]),
        safeExec(exec, "corepack", ["--version"]),
        safeExec(exec, "git", ["--version"]),
        safeExec(exec, "git", ["worktree", "list", "--porcelain"]),
        safeExec(exec, "git", ["rev-parse", "HEAD"]),
        safeExec(exec, "git", [
          "symbolic-ref",
          "--short",
          "refs/remotes/origin/HEAD",
        ]),
        safeExec(exec, "git", ["describe", "--tags", "--abbrev=0"]),
        safeExec(exec, "git", ["status", "--porcelain=v1"]),
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
        exists(
          input.fs,
          resolve(repo.sourceRoot, ".agents/skills/maestro/SKILL.md"),
        ),
        diskPosture(input.fs, repo.targetRoot, input.policy.minimumDiskBytes),
        portPosture(input.policy.requiredPorts, portAvailable),
        optionalText(
          input.fs,
          resolve(repo.targetRoot, "template-instance.json"),
        ),
      ]);

      const currentNode = nodeVersion().replace(/^v/, "");
      const currentNodeMajor = numericPrefix(currentNode);
      const currentPnpm = successfulText(pnpm) ?? "unavailable";
      const requiredPnpm = packageManagerVersion(rootManifest);
      const currentGit =
        successfulText(gitVersion)?.match(/(\d+(?:\.\d+){1,2})/)?.[1] ??
        "unavailable";
      const worktreeSupported = gitWorktree.exitCode === 0;
      const versions = packageVersions(
        rootManifest,
        templateManifest,
        convexManifest,
        cliManifest,
        packManifest,
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
      const nodeSupported =
        currentNodeMajor !== undefined &&
        input.policy.supportedNodeMajors.includes(currentNodeMajor);
      const pnpmSupported =
        requiredPnpm !== "unavailable" && currentPnpm === requiredPnpm;
      const packageVersionsAvailable = Object.values(versions).every(
        (version) => version !== "unavailable",
      );

      return {
        host: {
          os,
          architecture: architecture(),
          osSupported: input.policy.supportedPlatforms.includes(os),
          node: {
            current: currentNode,
            required: `major ${input.policy.supportedNodeMajors.join(" or ")}`,
            supported: nodeSupported,
          },
          pnpm: {
            current: currentPnpm,
            required: requiredPnpm,
            supported: pnpmSupported,
          },
          corepack: corepack.exitCode === 0 ? "ready" : "missing",
          git: {
            current: currentGit,
            required: "worktree support",
            supported: gitVersion.exitCode === 0 && worktreeSupported,
            worktree: worktreeSupported,
          },
        },
        prerequisites: {
          dependencies: dependenciesInstalled ? "installed" : "missing",
          disk,
          ports: portsReady,
        },
        repository: {
          ...repository,
          commit: successfulText(commit) ?? "unavailable",
          canonicalBase:
            successfulText(canonicalBase)?.replace(/^origin\//, "") ??
            "unavailable",
          canonicalTag: successfulText(canonicalTag) ?? "unavailable",
          dirty: dirty.exitCode !== 0 || dirty.stdout.trim().length > 0,
          generatedDrift:
            generatedDrift.exitCode !== 0 ||
            generatedDrift.stdout.trim().length > 0,
          collisions: [],
          hostIntegration: hostIntegrationInstalled
            ? "current"
            : "not-installed",
        },
        network: "unknown",
        auth: "not-required",
        versionsCompatible:
          input.policy.supportedPlatforms.includes(os) &&
          nodeSupported &&
          pnpmSupported &&
          corepack.exitCode === 0 &&
          gitVersion.exitCode === 0 &&
          worktreeSupported &&
          packageVersionsAvailable &&
          !workflow.publishedDrift,
        versions,
        workflow,
        availableEnvironmentNames: Object.entries(environment())
          .filter(
            ([, value]) => typeof value === "string" && value.trim() !== "",
          )
          .map(([name]) => name)
          .sort(),
        templateInstanceText,
        observedAt: now(),
      } satisfies PreflightRuntimeSnapshot;
    },
  };
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
    policy.supportedNodeMajors.length === 0 ||
    !positive.every((value) => Number.isSafeInteger(value) && value > 0) ||
    !Number.isSafeInteger(policy.minimumDiskBytes) ||
    policy.minimumDiskBytes < 0 ||
    !policy.supportedNodeMajors.every(
      (major) => Number.isSafeInteger(major) && major > 0,
    ) ||
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
  template: PackageManifest,
  convex: PackageManifest,
  cli: PackageManifest,
  pack: PackageManifest,
): PreflightRuntimeSnapshot["versions"] {
  const dependencies = {
    ...record(root?.dependencies),
    ...record(root?.devDependencies),
    ...record(convex?.dependencies),
    ...record(convex?.devDependencies),
  };
  return {
    pack: manifestVersion(pack),
    cli: manifestVersion(cli),
    template: manifestVersion(template),
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

function manifestVersion(manifest: PackageManifest): string {
  if (manifest === undefined) return "unavailable";
  return typeof manifest.version === "string" ? manifest.version : "workspace";
}

function dependencyVersion(
  dependencies: Record<string, unknown>,
  name: string,
): string {
  const value = dependencies[name];
  return typeof value === "string" ? value : "unavailable";
}

function successfulText(result: VerificationExecResult): string | undefined {
  if (result.exitCode !== 0) return undefined;
  const value = result.stdout.trim();
  return value.length > 0 ? value : undefined;
}

function numericPrefix(version: string): number | undefined {
  const value = Number.parseInt(version.match(/^\d+/)?.[0] ?? "", 10);
  return Number.isSafeInteger(value) ? value : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
