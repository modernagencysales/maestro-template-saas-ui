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
type VerifyPlanEntry = {
  readonly argv: readonly [string, ...string[]];
  readonly scriptBody: string;
};
type PackageScripts = Readonly<Record<string, unknown>>;

export function createExecFileVerificationRunner(input: {
  readonly execFile: VerificationExecFile;
  readonly readFile: VerificationReadFile;
  readonly now: () => string;
  readonly environment: (
    repo: RepositoryContext,
  ) => Promise<Readonly<Record<string, FingerprintValue>>>;
  readonly providerPosture: (
    repo: RepositoryContext,
  ) => Promise<Readonly<Record<string, unknown>>>;
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
        environmentFingerprint:
          environment === undefined
            ? "environment_sha256:unavailable"
            : fingerprint("environment", environment),
        providerPostureFingerprint:
          providerPosture === undefined
            ? "providers_sha256:unavailable"
            : fingerprint("providers", providerPosture),
      };
    },
    run: async (request) =>
      request.scope === "full"
        ? runFull(input.execFile, input.readFile, request, input.limits)
        : runFocused(
            input.execFile,
            input.readFile,
            request.repo.sourceRoot,
            request.descriptors,
            input.limits,
          ),
  };
}

async function runFocused(
  execFile: VerificationExecFile,
  readFile: VerificationReadFile,
  cwd: string,
  descriptors: readonly DiagnosticDescriptor[],
  limits: {
    readonly focusedTimeoutMs: number;
    readonly maxBufferBytes: number;
    readonly packageJsonMaxBytes: number;
  },
): Promise<readonly VerificationRunObservation[]> {
  const scripts = await readPackageScripts(
    readFile,
    resolve(cwd, "package.json"),
    limits.packageJsonMaxBytes,
  );
  if (scripts === undefined) {
    return descriptors.map((descriptor) =>
      unavailable(descriptor, "the focused package script plan is unavailable"),
    );
  }
  return Promise.all(
    descriptors.map((descriptor) => {
      if (!validateDiagnosticDescriptor(descriptor).ok) {
        return unavailable(descriptor);
      }
      const entry = focusedPlanEntry(descriptor, scripts);
      if (entry === undefined) {
        return unavailable(
          descriptor,
          `the target script body for ${descriptor.argv.join(" ")} is unavailable`,
        );
      }
      const scriptBlocker = canonicalScriptBlocker(descriptor, entry);
      if (scriptBlocker !== undefined) {
        return unavailable(descriptor, scriptBlocker);
      }
      return runDescriptor(
        execFile,
        descriptor,
        cwd,
        limits.focusedTimeoutMs,
        limits.maxBufferBytes,
      );
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
  if (!plan) {
    return request.descriptors.map((descriptor) =>
      unavailable(
        descriptor,
        "the canonical package verify plan is unavailable",
      ),
    );
  }
  if (result?.exitCode === null || result === undefined) {
    return request.descriptors.map((descriptor) =>
      unavailable(descriptor, "just verify was unavailable"),
    );
  }
  if (result.exitCode !== 0) {
    return attributeFailedFull(execFile, request, plan, limits);
  }
  const planned = new Map(
    plan.map((entry) => [argvKey(entry.argv), entry] as const),
  );
  return Promise.all(
    request.descriptors.map(async (descriptor) => {
      const entry = planned.get(argvKey(descriptor.argv));
      if (entry === undefined) {
        return unavailable(
          descriptor,
          "the gate is not a member of the canonical full verify plan",
        );
      }
      const scriptBlocker = canonicalScriptBlocker(descriptor, entry);
      if (scriptBlocker !== undefined) {
        return unavailable(descriptor, scriptBlocker);
      }
      return runDescriptor(
        execFile,
        descriptor,
        request.repo.sourceRoot,
        limits.fullTimeoutMs,
        limits.maxBufferBytes,
      );
    }),
  );
}

async function attributeFailedFull(
  execFile: VerificationExecFile,
  request: VerificationRunRequest,
  plan: readonly VerifyPlanEntry[],
  limits: { readonly fullTimeoutMs: number; readonly maxBufferBytes: number },
): Promise<readonly VerificationRunObservation[]> {
  const byCommand = new Map(
    request.descriptors.map((descriptor) => [
      argvKey(descriptor.argv),
      descriptor,
    ]),
  );
  const observations = new Map<string, VerificationRunObservation>();
  let blocker: string | undefined;

  for (const entry of plan) {
    if (blocker !== undefined) break;
    const { argv } = entry;
    const [file, ...args] = argv;
    const descriptor = byCommand.get(argvKey(argv));
    const rendered = argv.join(" ");
    if (descriptor !== undefined) {
      const scriptBlocker = canonicalScriptBlocker(descriptor, entry);
      if (scriptBlocker !== undefined) {
        blocker = scriptBlocker;
        observations.set(
          descriptor.gateId,
          unavailable(descriptor, scriptBlocker),
        );
        continue;
      }
      const prerequisiteBlocker = await unavailablePrerequisite(
        execFile,
        descriptor,
        request.repo.sourceRoot,
        limits.fullTimeoutMs,
        limits.maxBufferBytes,
      );
      if (prerequisiteBlocker !== undefined) {
        blocker = prerequisiteBlocker;
        observations.set(
          descriptor.gateId,
          unavailable(descriptor, prerequisiteBlocker),
        );
        continue;
      }
    }
    const result = await safeExec(
      execFile,
      file,
      args,
      request.repo.sourceRoot,
      limits.fullTimeoutMs,
      limits.maxBufferBytes,
    );
    if (result === undefined || result.exitCode === null) {
      blocker = rendered;
      if (descriptor !== undefined) {
        observations.set(
          descriptor.gateId,
          unavailable(descriptor, `${rendered} was unavailable`),
        );
      }
      continue;
    }
    if (descriptor !== undefined) {
      observations.set(descriptor.gateId, {
        gateId: descriptor.gateId,
        status: result.exitCode === 0 ? "pass" : "fail",
        message:
          result.exitCode === 0
            ? `Verification gate ${descriptor.gateId} passed during deterministic full-run attribution.`
            : `${rendered} exited with code ${result.exitCode}.`,
        ...(descriptor.semanticRuleIds
          ? { semanticRuleIds: descriptor.semanticRuleIds }
          : {}),
      });
    }
    if (result.exitCode !== 0) blocker = rendered;
  }

  const attributed = request.descriptors.map((descriptor) => {
    const observation = observations.get(descriptor.gateId);
    if (observation !== undefined) return observation;
    const isPlanned = plan.some(
      ({ argv }) => argvKey(argv) === argvKey(descriptor.argv),
    );
    return unavailable(
      descriptor,
      blocker === undefined
        ? isPlanned
          ? "just verify failed although its exact attribution replay passed"
          : "the gate is not a member of the canonical full verify plan"
        : `blocked by ${blocker}`,
    );
  });

  return [
    ...attributed,
    {
      gateId: "maestro/full-verify",
      status: "fail",
      message: `just verify exited with code; deterministic attribution${blocker === undefined ? " found no gate blocker" : ` stopped at ${blocker}`}.`,
      diagnostic: {
        code: "AGENT_PACK_FULL_VERIFY_FAILED",
        severity: "error",
        message:
          blocker === undefined
            ? "just verify failed although every attributable command passed on replay."
            : `just verify failed; deterministic attribution stopped at ${blocker}.`,
        safeToContinue: false,
        nextAction:
          "Repair the reported invariant in its owning source; do not edit or weaken a gate.",
        rerun: "just verify",
      },
    },
  ];
}

async function runDescriptor(
  execFile: VerificationExecFile,
  descriptor: DiagnosticDescriptor,
  cwd: string,
  timeoutMs: number,
  maxBufferBytes: number,
): Promise<VerificationRunObservation> {
  if (!validateDiagnosticDescriptor(descriptor).ok) {
    return unavailable(descriptor);
  }
  const prerequisiteBlocker = await unavailablePrerequisite(
    execFile,
    descriptor,
    cwd,
    timeoutMs,
    maxBufferBytes,
  );
  if (prerequisiteBlocker !== undefined) {
    return unavailable(descriptor, prerequisiteBlocker);
  }
  const [file, ...args] = descriptor.argv;
  const result = await safeExec(
    execFile,
    file,
    args,
    cwd,
    timeoutMs,
    maxBufferBytes,
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
}

function canonicalScriptBlocker(
  descriptor: DiagnosticDescriptor,
  entry: VerifyPlanEntry,
): string | undefined {
  return descriptor.canonicalScriptBody !== undefined &&
    entry.scriptBody === descriptor.canonicalScriptBody
    ? undefined
    : `the target script body for ${descriptor.argv.join(" ")} does not match the canonical gate binding`;
}

async function unavailablePrerequisite(
  execFile: VerificationExecFile,
  descriptor: DiagnosticDescriptor,
  cwd: string,
  timeoutMs: number,
  maxBufferBytes: number,
): Promise<string | undefined> {
  if (descriptor.prerequisiteCheck === undefined) return undefined;
  const [file, ...args] = descriptor.prerequisiteCheck;
  const rendered = descriptor.prerequisiteCheck.join(" ");
  const result = await safeExec(
    execFile,
    file,
    args,
    cwd,
    timeoutMs,
    maxBufferBytes,
  );
  return result?.exitCode === 0
    ? undefined
    : `required prerequisite ${rendered} was unavailable`;
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
): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

async function readVerifyPlan(
  readFile: VerificationReadFile,
  path: string,
  maxBytes: number,
): Promise<readonly VerifyPlanEntry[] | undefined> {
  const scripts = await readPackageScripts(readFile, path, maxBytes);
  if (scripts === undefined) return undefined;
  const verify = scripts.verify;
  if (typeof verify !== "string" || verify.trim() === "") return undefined;
  const commands = verify.trim().split("&&");
  const plan: VerifyPlanEntry[] = [];
  const members = new Set<string>();
  for (const command of commands) {
    const match = /^pnpm ([a-z0-9][a-z0-9:_-]*)$/.exec(command.trim());
    const script = match?.[1];
    const scriptBody = script === undefined ? undefined : scripts[script];
    if (
      script === undefined ||
      !Object.hasOwn(scripts, script) ||
      typeof scriptBody !== "string" ||
      scriptBody.trim() === ""
    ) {
      return undefined;
    }
    const argv = ["pnpm", script] as const;
    const member = argvKey(argv);
    if (members.has(member)) return undefined;
    members.add(member);
    plan.push({ argv, scriptBody });
  }
  return plan.length > 0 ? plan : undefined;
}

async function readPackageScripts(
  readFile: VerificationReadFile,
  path: string,
  maxBytes: number,
): Promise<PackageScripts | undefined> {
  try {
    const text = await readFile(path, { maxBytes });
    if (Buffer.byteLength(text, "utf8") > maxBytes) return undefined;
    const manifest: unknown = JSON.parse(text);
    if (!isRecord(manifest) || !isRecord(manifest.scripts)) return undefined;
    return manifest.scripts;
  } catch {
    return undefined;
  }
}

function focusedPlanEntry(
  descriptor: DiagnosticDescriptor,
  scripts: PackageScripts,
): VerifyPlanEntry | undefined {
  const [file, script, ...args] = descriptor.argv;
  const scriptBody =
    file === "pnpm" && script !== undefined && args.length === 0
      ? scripts[script]
      : undefined;
  return script !== undefined &&
    Object.hasOwn(scripts, script) &&
    typeof scriptBody === "string" &&
    scriptBody.trim() !== ""
    ? { argv: [file, script], scriptBody }
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function argvKey(argv: readonly string[]): string {
  return JSON.stringify(argv);
}

function unavailable(
  descriptor: Pick<DiagnosticDescriptor, "gateId" | "semanticRuleIds">,
  blocker?: string,
): VerificationRunObservation {
  return {
    gateId: descriptor.gateId,
    status: "unavailable",
    message:
      blocker === undefined
        ? `Verification evidence for ${descriptor.gateId} is unavailable.`
        : `Verification evidence for ${descriptor.gateId} is unavailable: ${blocker}. Rerun the gate after resolving that blocker.`,
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
  const stable = stableFingerprintJson(value);
  return `${kind}_sha256:${createHash("sha256").update(stable).digest("hex")}` as `${Kind}_sha256:${string}`;
}

export function createConfigurationBinding<
  const Kind extends "environment" | "providers",
>(kind: Kind, value: unknown): `${Kind}_binding_sha256:${string}` {
  const content = `${kind}-binding-v1\0${stableFingerprintJson(value)}`;
  return `${kind}_binding_sha256:${createHash("sha256").update(content).digest("hex")}` as `${Kind}_binding_sha256:${string}`;
}

function stableFingerprintJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableFingerprintJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${stableFingerprintJson(entry)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
