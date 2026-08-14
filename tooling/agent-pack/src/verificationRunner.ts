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
};
type PackageScripts = Readonly<Record<string, unknown>>;
type ExecutionContext = {
  readonly execFile: VerificationExecFile;
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly maxBufferBytes: number;
};
type ExecutionCommand = {
  readonly file: string;
  readonly args: readonly string[];
};

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
      const [repository, environment, providerPosture] = await Promise.all([
        readRepositoryState(
          input.execFile,
          repo.sourceRoot,
          input.limits.metadataTimeoutMs,
          input.limits.maxBufferBytes,
        ),
        safelyRead(() => input.environment(repo)),
        safelyRead(() => input.providerPosture(repo)),
      ]);
      return describeRepository(
        input.now(),
        repository,
        environment,
        providerPosture,
      );
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

async function readRepositoryState(
  execFile: VerificationExecFile,
  cwd: string,
  timeoutMs: number,
  maxBufferBytes: number,
): Promise<{
  readonly commitResult: VerificationExecResult | undefined;
  readonly dirtyResult: VerificationExecResult | undefined;
}> {
  const context = { execFile, cwd, timeoutMs, maxBufferBytes };
  const [commitResult, dirtyResult] = await Promise.all([
    safeExec(context, { file: "git", args: ["rev-parse", "HEAD"] }),
    safeExec(context, { file: "git", args: ["status", "--porcelain=v1"] }),
  ]);
  return { commitResult, dirtyResult };
}

function describeRepository(
  createdAt: string,
  repository: {
    readonly commitResult: VerificationExecResult | undefined;
    readonly dirtyResult: VerificationExecResult | undefined;
  },
  environment: Readonly<Record<string, FingerprintValue>> | undefined,
  providerPosture: Readonly<Record<string, unknown>> | undefined,
) {
  const commit = repository.commitResult?.stdout.trim() ?? "";
  return {
    createdAt,
    subject: repositorySubject(commit, repository.dirtyResult),
    repositoryFingerprint: repositoryFingerprint(
      commit,
      repository.dirtyResult,
    ),
    environmentFingerprint: optionalFingerprint("environment", environment),
    providerPostureFingerprint: optionalFingerprint(
      "providers",
      providerPosture,
    ),
  };
}

function repositorySubject(
  commit: string,
  dirtyResult: VerificationExecResult | undefined,
) {
  return {
    commit: /^[0-9a-f]{7,64}$/i.test(commit) ? commit : "unavailable",
    dirty:
      dirtyResult?.exitCode !== 0 || dirtyResult?.stdout.trim().length !== 0,
  };
}

function repositoryFingerprint(
  commit: string,
  dirtyResult: VerificationExecResult | undefined,
): `repository_sha256:${string}` | "repository_sha256:unavailable" {
  if (!/^[0-9a-f]{7,64}$/i.test(commit) || dirtyResult?.exitCode !== 0) {
    return "repository_sha256:unavailable";
  }
  return fingerprint("repository", {
    commit,
    status: dirtyResult.stdout.split(/\r?\n/).filter(Boolean).sort().join("\n"),
  });
}

function optionalFingerprint<const Kind extends "environment" | "providers">(
  kind: Kind,
  value: Readonly<Record<string, unknown>> | undefined,
): `${Kind}_sha256:${string}` | `${Kind}_sha256:unavailable` {
  return value === undefined
    ? `${kind}_sha256:unavailable`
    : fingerprint(kind, value);
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
  const rootScripts = descriptors.some(({ argv }) => isRootPnpmScript(argv))
    ? await readPackageScripts(
        readFile,
        resolve(cwd, "package.json"),
        limits.packageJsonMaxBytes,
      )
    : undefined;
  return Promise.all(
    descriptors.map((descriptor) => {
      if (!validateDiagnosticDescriptor(descriptor).ok) {
        return unavailable(descriptor);
      }
      if (
        isRootPnpmScript(descriptor.argv) &&
        !hasCurrentRootScript(descriptor.argv, rootScripts)
      ) {
        return unavailable(
          descriptor,
          `the target root package script for ${descriptor.argv.join(" ")} is unavailable`,
        );
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
      {
        execFile,
        cwd: request.repo.sourceRoot,
        timeoutMs: limits.fullTimeoutMs,
        maxBufferBytes: limits.maxBufferBytes,
      },
      { file: "pnpm", args: ["verify"] },
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
      unavailable(descriptor, "pnpm verify was unavailable"),
    );
  }
  if (result.exitCode !== 0) {
    return attributeFailedFull(execFile, request, plan, limits);
  }
  const planned = new Set(plan.map(({ argv }) => argvKey(argv)));
  return request.descriptors.map((descriptor) => {
    if (!validateDiagnosticDescriptor(descriptor).ok) {
      return unavailable(descriptor);
    }
    if (!planned.has(argvKey(descriptor.argv))) {
      return unavailable(
        descriptor,
        "the gate is not a member of the canonical full verify plan",
      );
    }
    return successfulFullObservation(descriptor);
  });
}

function successfulFullObservation(
  descriptor: DiagnosticDescriptor,
): VerificationRunObservation {
  return {
    gateId: descriptor.gateId,
    status: "pass",
    message: `Verification gate ${descriptor.gateId} passed during the canonical pnpm verify run.`,
    ...(descriptor.semanticRuleIds
      ? { semanticRuleIds: descriptor.semanticRuleIds }
      : {}),
  };
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
  const replay = await replayFullPlan(
    {
      execFile,
      cwd: request.repo.sourceRoot,
      timeoutMs: limits.fullTimeoutMs,
      maxBufferBytes: limits.maxBufferBytes,
    },
    plan,
    byCommand,
  );
  return [
    ...attributeFullObservations(request.descriptors, plan, replay),
    fullVerifyFailure(replay.blocker),
  ];
}

type FullReplay = {
  readonly observations: ReadonlyMap<string, VerificationRunObservation>;
  readonly blocker?: string;
};

async function replayFullPlan(
  context: ExecutionContext,
  plan: readonly VerifyPlanEntry[],
  byCommand: ReadonlyMap<string, DiagnosticDescriptor>,
): Promise<FullReplay> {
  const observations = new Map<string, VerificationRunObservation>();
  for (const entry of plan) {
    const replay = await replayFullEntry(
      context,
      entry,
      byCommand.get(argvKey(entry.argv)),
    );
    if (replay.observation !== undefined) {
      observations.set(replay.observation.gateId, replay.observation);
    }
    if (replay.blocker !== undefined)
      return { observations, blocker: replay.blocker };
  }
  return { observations };
}

async function replayFullEntry(
  context: ExecutionContext,
  entry: VerifyPlanEntry,
  descriptor: DiagnosticDescriptor | undefined,
): Promise<{
  readonly observation?: VerificationRunObservation;
  readonly blocker?: string;
}> {
  const rendered = entry.argv.join(" ");
  const prerequisiteBlocker =
    descriptor === undefined
      ? undefined
      : await unavailablePrerequisite(
          context.execFile,
          descriptor,
          context.cwd,
          context.timeoutMs,
          context.maxBufferBytes,
        );
  if (prerequisiteBlocker !== undefined && descriptor !== undefined) {
    return {
      blocker: prerequisiteBlocker,
      observation: unavailable(descriptor, prerequisiteBlocker),
    };
  }
  const [file, ...args] = entry.argv;
  const result = await safeExec(context, { file, args });
  if (result === undefined || result.exitCode === null) {
    return {
      blocker: rendered,
      ...(descriptor === undefined
        ? {}
        : {
            observation: unavailable(descriptor, `${rendered} was unavailable`),
          }),
    };
  }
  return {
    ...(descriptor === undefined
      ? {}
      : {
          observation: attributedObservation(
            descriptor,
            rendered,
            result.exitCode,
          ),
        }),
    ...(result.exitCode === 0 ? {} : { blocker: rendered }),
  };
}

function attributedObservation(
  descriptor: DiagnosticDescriptor,
  rendered: string,
  exitCode: number,
): VerificationRunObservation {
  return {
    gateId: descriptor.gateId,
    status: exitCode === 0 ? "pass" : "fail",
    message:
      exitCode === 0
        ? `Verification gate ${descriptor.gateId} passed during deterministic full-run attribution.`
        : `${rendered} exited with code ${exitCode}.`,
    ...(descriptor.semanticRuleIds
      ? { semanticRuleIds: descriptor.semanticRuleIds }
      : {}),
  };
}

function attributeFullObservations(
  descriptors: readonly DiagnosticDescriptor[],
  plan: readonly VerifyPlanEntry[],
  replay: FullReplay,
): readonly VerificationRunObservation[] {
  return descriptors.map((descriptor) => {
    const observation = replay.observations.get(descriptor.gateId);
    if (observation !== undefined) return observation;
    return unavailable(
      descriptor,
      unavailableFullReason(descriptor, plan, replay.blocker),
    );
  });
}

function unavailableFullReason(
  descriptor: DiagnosticDescriptor,
  plan: readonly VerifyPlanEntry[],
  blocker: string | undefined,
): string {
  if (blocker !== undefined) return `blocked by ${blocker}`;
  return plan.some(({ argv }) => argvKey(argv) === argvKey(descriptor.argv))
    ? "pnpm verify failed although its exact attribution replay passed"
    : "the gate is not a member of the canonical full verify plan";
}

function fullVerifyFailure(
  blocker: string | undefined,
): VerificationRunObservation {
  const stopped =
    blocker === undefined ? " found no gate blocker" : ` stopped at ${blocker}`;
  return {
    gateId: "maestro/full-verify",
    status: "fail",
    message: `pnpm verify exited with code; deterministic attribution${stopped}.`,
    diagnostic: {
      code: "AGENT_PACK_FULL_VERIFY_FAILED",
      severity: "error",
      message:
        blocker === undefined
          ? "pnpm verify failed although every attributable command passed on replay."
          : `pnpm verify failed; deterministic attribution stopped at ${blocker}.`,
      safeToContinue: false,
      nextAction:
        "Repair the reported invariant in its owning source; do not edit or weaken a gate.",
      rerun: "pnpm verify",
    },
  };
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
    { execFile, cwd, timeoutMs, maxBufferBytes },
    { file, args },
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
    { execFile, cwd, timeoutMs, maxBufferBytes },
    { file, args },
  );
  return result?.exitCode === 0
    ? undefined
    : `required prerequisite ${rendered} was unavailable`;
}

async function safeExec(
  { execFile, cwd, timeoutMs, maxBufferBytes }: ExecutionContext,
  { file, args }: ExecutionCommand,
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
  return parseVerifyPlan(scripts, scripts.verify);
}

function parseVerifyPlan(
  scripts: PackageScripts,
  verify: unknown,
): readonly VerifyPlanEntry[] | undefined {
  if (typeof verify !== "string" || verify.trim() === "") return undefined;
  const commands = verify.trim().split("&&");
  const plan: VerifyPlanEntry[] = [];
  const members = new Set<string>();
  for (const command of commands) {
    const argv = parseVerifyPlanEntry(command, scripts);
    if (argv === undefined) return undefined;
    const member = argvKey(argv);
    if (members.has(member)) return undefined;
    members.add(member);
    plan.push({ argv });
  }
  return plan.length > 0 ? plan : undefined;
}

function parseVerifyPlanEntry(
  command: string,
  scripts: PackageScripts,
): readonly ["pnpm", string] | undefined {
  const script = /^pnpm ([a-z0-9][a-z0-9:_-]*)$/.exec(command.trim())?.[1];
  if (script === undefined) return undefined;
  return hasCurrentRootScript(["pnpm", script], scripts)
    ? ["pnpm", script]
    : undefined;
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

function isRootPnpmScript(
  argv: readonly string[],
): argv is readonly ["pnpm", string] {
  return argv[0] === "pnpm" && argv.length === 2 && argv[1] !== undefined;
}

function hasCurrentRootScript(
  argv: readonly ["pnpm", string],
  scripts: PackageScripts | undefined,
): boolean {
  const script = argv[1];
  const scriptBody = scripts?.[script];
  return (
    Object.hasOwn(scripts ?? {}, script) &&
    typeof scriptBody === "string" &&
    scriptBody.trim() !== ""
  );
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
