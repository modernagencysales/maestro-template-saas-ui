import { createHash } from "node:crypto";
import {
  validateDiagnosticDescriptor,
  type DiagnosticDescriptor,
  type GateObservationStatus,
} from "./diagnostics.js";
import type {
  VerificationRunObservation,
  VerificationRunRequest,
  VerificationRunner,
} from "./verify.js";

export const VERIFICATION_EVIDENCE_PREFIX = "MAESTRO_GATE_EVIDENCE ";

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

type FingerprintValue = string | number | boolean | null;
type ProviderPosture = "sample" | "local" | "test" | "live" | "missing";

export function createExecFileVerificationRunner(input: {
  readonly execFile: VerificationExecFile;
  readonly now: () => string;
  readonly environment: () => Promise<
    Readonly<Record<string, FingerprintValue>>
  >;
  readonly providerPosture: () => Promise<
    Readonly<Record<string, ProviderPosture>>
  >;
  readonly limits: {
    readonly metadataTimeoutMs: number;
    readonly focusedTimeoutMs: number;
    readonly fullTimeoutMs: number;
    readonly maxBufferBytes: number;
  };
}): VerificationRunner {
  if (
    ![
      input.limits.metadataTimeoutMs,
      input.limits.focusedTimeoutMs,
      input.limits.fullTimeoutMs,
      input.limits.maxBufferBytes,
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
        safelyRead(input.environment),
        safelyRead(input.providerPosture),
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
        ? runFull(input.execFile, request, input.limits)
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
        return unavailable(descriptor.gateId);
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
        return unavailable(descriptor.gateId);
      }
      const evidence = parseEvidence(result.stdout, descriptor.gateId);
      if (result.stdout.includes(VERIFICATION_EVIDENCE_PREFIX) && !evidence) {
        return unavailable(descriptor.gateId);
      }
      return {
        gateId: descriptor.gateId,
        status: result.exitCode === 0 ? "pass" : "fail",
        message:
          result.exitCode === 0
            ? `Verification gate ${descriptor.gateId} passed.`
            : `Verification gate ${descriptor.gateId} exited with code ${result.exitCode}.`,
        ...(evidence?.semanticRuleIds
          ? { semanticRuleIds: evidence.semanticRuleIds }
          : {}),
      };
    }),
  );
}

async function runFull(
  execFile: VerificationExecFile,
  request: VerificationRunRequest,
  limits: {
    readonly fullTimeoutMs: number;
    readonly maxBufferBytes: number;
  },
): Promise<readonly VerificationRunObservation[]> {
  const result = await safeExec(
    execFile,
    "just",
    ["verify"],
    request.repo.sourceRoot,
    limits.fullTimeoutMs,
    limits.maxBufferBytes,
  );
  if (!result)
    return request.descriptors.map(({ gateId }) => unavailable(gateId));
  return request.descriptors.map(
    ({ gateId }) => parseEvidence(result.stdout, gateId) ?? unavailable(gateId),
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

function parseEvidence(
  output: string,
  expectedGateId: string,
): VerificationRunObservation | undefined {
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(VERIFICATION_EVIDENCE_PREFIX)) continue;
    try {
      const parsed: unknown = JSON.parse(
        line.slice(VERIFICATION_EVIDENCE_PREFIX.length),
      );
      if (!isEvidence(parsed) || parsed.gateId !== expectedGateId) continue;
      return {
        gateId: parsed.gateId,
        status: parsed.status,
        message: parsed.message,
        ...(parsed.semanticRuleIds
          ? { semanticRuleIds: parsed.semanticRuleIds }
          : {}),
      };
    } catch {
      continue;
    }
  }
  return undefined;
}

function isEvidence(value: unknown): value is {
  readonly gateId: string;
  readonly status: GateObservationStatus;
  readonly message: string;
  readonly semanticRuleIds?: readonly string[];
} {
  if (typeof value !== "object" || value === null) return false;
  const status = "status" in value ? value.status : undefined;
  const semanticRuleIds =
    "semanticRuleIds" in value ? value.semanticRuleIds : undefined;
  return (
    "gateId" in value &&
    typeof value.gateId === "string" &&
    (status === "pass" ||
      status === "fail" ||
      status === "skipped" ||
      status === "unavailable") &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    (semanticRuleIds === undefined ||
      (Array.isArray(semanticRuleIds) &&
        semanticRuleIds.every((id) => typeof id === "string")))
  );
}

function unavailable(gateId: string): VerificationRunObservation {
  return {
    gateId,
    status: "unavailable",
    message: `Verification evidence for ${gateId} is unavailable.`,
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
