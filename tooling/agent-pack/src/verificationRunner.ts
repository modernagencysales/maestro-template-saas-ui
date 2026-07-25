import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import {
  validateDiagnosticDescriptor,
  type DiagnosticDescriptor,
} from "./diagnostics.js";
import type { RepositoryContext } from "./repoContext.js";
import type {
  VerificationRunObservation,
  VerificationRunRequest,
  VerificationRunner,
} from "./verify.js";

export type VerificationExecResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type VerificationExecFile = (
  file: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly timeoutMs: number;
    readonly maxBufferBytes: number;
  },
) => Promise<VerificationExecResult>;

export type VerificationReadFile = (
  path: string,
  options: { readonly maxBytes: number },
) => Promise<string>;

type FingerprintValue = string | number | boolean | null;
type ProviderPosture = "sample" | "local" | "test" | "live" | "missing";

export function createExecFileVerificationRunner(input: {
  readonly execFile: VerificationExecFile;
  readonly readFile: VerificationReadFile;
  readonly now: () => string;
  readonly environment: (
    repo: RepositoryContext,
  ) => Promise<Readonly<Record<string, FingerprintValue>>>;
  readonly providerPosture: (
    repo: RepositoryContext,
  ) => Promise<Readonly<Record<string, ProviderPosture>>>;
  readonly limits: {
    readonly metadataTimeoutMs: number;
    readonly focusedTimeoutMs: number;
    readonly fullTimeoutMs: number;
    readonly maxBufferBytes: number;
    readonly packageJsonMaxBytes: number;
  };
}): VerificationRunner {
  if (
    ![
      input.limits.metadataTimeoutMs,
      input.limits.focusedTimeoutMs,
      input.limits.fullTimeoutMs,
      input.limits.maxBufferBytes,
      input.limits.packageJsonMaxBytes,
    ].every((value) => Number.isSafeInteger(value) && value > 0)
  ) {
    throw new Error(
      "Verification execution limits must be positive safe integers.",
    );
  }
  return {
    inspect: async (repo) => {
      const commitResult = await safeExec(
        input.execFile,
        "git",
        ["rev-parse", "HEAD"],
        repo.sourceRoot,
        input.limits.metadataTimeoutMs,
        input.limits.maxBufferBytes,
      );
      const dirtyResult = await safeExec(
        input.execFile,
        "git",
        ["status", "--porcelain=v1"],
        repo.sourceRoot,
        input.limits.metadataTimeoutMs,
        input.limits.maxBufferBytes,
      );
      const [environment, providerPosture] = await Promise.all([
        safelyRead(() => input.environment(repo)),
        safelyRead(() => input.providerPosture(repo)),
      ]);
      const commit = commitResult?.stdout.trim() ?? "";
      const repositoryFingerprint =
        /^[0-9a-f]{7,64}$/i.test(commit) && dirtyResult?.exitCode === 0
          ? fingerprint("repository", {
              commit,
              status: dirtyResult.stdout
                .split(/\r?\n/)
                .filter(Boolean)
                .sort()
                .join("\n"),
            })
          : "repository_sha256:unavailable";

      return {
        createdAt: input.now(),
        subject: {
          commit: /^[0-9a-f]{7,64}$/i.test(commit) ? commit : "unavailable",
          dirty:
            dirtyResult?.exitCode !== 0 || dirtyResult.stdout.trim().length > 0,
        },
        repositoryFingerprint,
        environmentFingerprint: fingerprint("environment", environment),
        providerPostureFingerprint: fingerprint("providers", providerPosture),
      };
    },
    run: async (request) =>
      request.scope === "full"
        ? runFull(input.execFile, input.readFile, request, input.limits)
        : runFocused(
            input.execFile,
            request.repo.sourceRoot,
            request.descriptors,
            input.limits,
          ),
  };
}

async function runFocused(
  execFile: VerificationExecFile,
  cwd: string,
  descriptors: readonly DiagnosticDescriptor[],
  limits: {
    readonly focusedTimeoutMs: number;
    readonly maxBufferBytes: number;
  },
): Promise<readonly VerificationRunObservation[]> {
  return Promise.all(
    descriptors.map(async (descriptor) => {
      if (!validateDiagnosticDescriptor(descriptor).ok) {
        return unavailable(descriptor);
      }
      const [file, ...args] = descriptor.argv;
      const result = await safeExec(
        execFile,
        file,
        args,
        cwd,
        limits.focusedTimeoutMs,
        limits.maxBufferBytes,
      );
      if (result?.exitCode === null || result === undefined) {
        return unavailable(descriptor);
      }
      return {
        gateId: descriptor.gateId,
        status: result.exitCode === 0 ? "pass" : "fail",
        message:
          result.exitCode === 0
            ? `Verification gate ${descriptor.gateId} passed.`
            : `Verification gate ${descriptor.gateId} exited with code ${result.exitCode}.`,
        ...(descriptor.semanticRuleIds
          ? { semanticRuleIds: descriptor.semanticRuleIds }
          : {}),
      };
    }),
  );
}

async function runFull(
  execFile: VerificationExecFile,
  readFile: VerificationReadFile,
  request: VerificationRunRequest,
  limits: {
    readonly fullTimeoutMs: number;
    readonly maxBufferBytes: number;
    readonly packageJsonMaxBytes: number;
  },
): Promise<readonly VerificationRunObservation[]> {
  const [plan, result] = await Promise.all([
    readVerifyPlan(
      readFile,
      resolve(request.repo.sourceRoot, "package.json"),
      limits.packageJsonMaxBytes,
    ),
    safeExec(
      execFile,
      "just",
      ["verify"],
      request.repo.sourceRoot,
      limits.fullTimeoutMs,
      limits.maxBufferBytes,
    ),
  ]);
  if (!plan || result?.exitCode !== 0) {
    return request.descriptors.map(unavailable);
  }
  return request.descriptors.map((descriptor) =>
    validateDiagnosticDescriptor(descriptor).ok &&
    plan.has(argvKey(descriptor.argv))
      ? {
          gateId: descriptor.gateId,
          status: "pass",
          message: `Verification gate ${descriptor.gateId} passed.`,
          ...(descriptor.semanticRuleIds
            ? { semanticRuleIds: descriptor.semanticRuleIds }
            : {}),
        }
      : unavailable(descriptor),
  );
}

async function safeExec(
  execFile: VerificationExecFile,
  file: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  maxBufferBytes: number,
): Promise<VerificationExecResult | undefined> {
  try {
    return await execFile(file, args, { cwd, timeoutMs, maxBufferBytes });
  } catch {
    return undefined;
  }
}

async function safelyRead<T extends Readonly<Record<string, unknown>>>(
  read: () => Promise<T>,
): Promise<T | { readonly unavailable: true }> {
  try {
    return await read();
  } catch {
    return { unavailable: true };
  }
}

async function readVerifyPlan(
  readFile: VerificationReadFile,
  path: string,
  maxBytes: number,
): Promise<ReadonlySet<string> | undefined> {
  try {
    const text = await readFile(path, { maxBytes });
    if (Buffer.byteLength(text, "utf8") > maxBytes) return undefined;
    const manifest: unknown = JSON.parse(text);
    if (!isRecord(manifest) || !isRecord(manifest.scripts)) return undefined;
    const verify = manifest.scripts.verify;
    if (typeof verify !== "string" || verify.trim() === "") return undefined;
    const commands = verify.trim().split("&&");
    const plan = new Set<string>();
    for (const command of commands) {
      const match = /^pnpm ([a-z0-9][a-z0-9:_-]*)$/.exec(command.trim());
      const script = match?.[1];
      if (script === undefined || !script.includes(":")) return undefined;
      const member = argvKey(["pnpm", script]);
      if (plan.has(member)) return undefined;
      plan.add(member);
    }
    return plan.size > 0 ? plan : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function argvKey(argv: readonly string[]): string {
  return JSON.stringify(argv);
}

function unavailable(
  descriptor: Pick<DiagnosticDescriptor, "gateId" | "semanticRuleIds">,
): VerificationRunObservation {
  return {
    gateId: descriptor.gateId,
    status: "unavailable",
    message: `Verification evidence for ${descriptor.gateId} is unavailable.`,
    ...(descriptor.semanticRuleIds
      ? { semanticRuleIds: descriptor.semanticRuleIds }
      : {}),
  };
}

function fingerprint<
  const Kind extends "repository" | "environment" | "providers",
>(
  kind: Kind,
  value: Readonly<Record<string, unknown>>,
): `${Kind}_sha256:${string}` {
  const stable = JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
  return `${kind}_sha256:${createHash("sha256").update(stable).digest("hex")}` as `${Kind}_sha256:${string}`;
}
