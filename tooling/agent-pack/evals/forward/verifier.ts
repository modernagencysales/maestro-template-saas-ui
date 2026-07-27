import { execFile as nodeExecFile } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { AssertionFailure } from "../assertions/forbiddenActions.js";
import type { ForwardRunEvidence } from "../scenarios/evidence.js";
import {
  forwardScenarios,
  type ForwardScenarioId,
} from "../scenarios/forward.js";
import { safeVerifierEnvironment } from "../walking-skeleton/verifier.js";
import { sha256 } from "./contract.js";

const REVIEWED_RELEASE_PATH = "releases/v0.2.0-alpha.1/manifest.json";

type ScenarioContract = {
  readonly artifactId: string;
  readonly command: {
    readonly id: string;
    readonly executable: string;
    readonly args: readonly string[];
  };
};

const gateCommand = (
  id: string,
  gate: string,
): ScenarioContract["command"] => ({
  id,
  executable: "node",
  args: ["tooling/agent-pack/evals/forward/gate-launcher.mjs", gate],
});

export const forwardScenarioContracts: Readonly<
  Record<ForwardScenarioId, ScenarioContract>
> = {
  "greenfield-tagged-customer": {
    artifactId: "materialization-receipt",
    command: gateCommand("architecture-gates", "check:gates"),
  },
  "prototype-adoption": {
    artifactId: "adoption-work-package",
    command: gateCommand("architecture-gates", "check:gates"),
  },
  "safe-convex-dev": {
    artifactId: "convex-setup-receipt",
    command: gateCommand("convex-ai-files", "check:convex-ai-files"),
  },
  "generated-capability-workflow": {
    artifactId: "generated-workflow-receipt",
    command: gateCommand("workflow-fast-gates", "check:workflow:fast"),
  },
  "architecture-gate-repair": {
    artifactId: "gate-repair-receipt",
    command: gateCommand("architecture-gates", "check:gates"),
  },
  "active-v1-version-bump": {
    artifactId: "version-bump-receipt",
    command: gateCommand(
      "workflow-version-immutability",
      "check:workflow-version-immutability",
    ),
  },
  "workflow-adversarial-repairs": {
    artifactId: "workflow-repair-receipt",
    command: gateCommand("workflow-semantics", "check:workflow-semantics"),
  },
  "promotion-upgrade-refusal": {
    artifactId: "manual-resolution-packet",
    command: gateCommand("promotion-boundary", "check:promotion-boundary"),
  },
};

export type ForwardVerifierCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type ForwardVerifierPorts = {
  readonly execute: (input: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
  }) => Promise<ForwardVerifierCommandResult>;
};

export type ForwardVerificationResult = {
  readonly failures: readonly AssertionFailure[];
  readonly commandResult?: ForwardVerifierCommandResult;
};

export async function verifyForwardScenario(input: {
  readonly workspace: string;
  readonly sessionDir: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
  readonly evidence: ForwardRunEvidence;
  readonly ports?: Partial<ForwardVerifierPorts>;
}): Promise<ForwardVerificationResult> {
  const failures: AssertionFailure[] = [];
  const fail = (code: string, path: string, message: string): void => {
    failures.push({ code, path, message });
  };
  const contract = forwardScenarioContracts[input.scenarioId];
  let verifiedCommandResult: ForwardVerifierCommandResult | undefined;
  if (
    input.evidence.artifacts.length !== 1 ||
    input.evidence.artifacts[0]?.id !== contract.artifactId
  ) {
    fail(
      "ARTIFACT_CONTRACT_MISMATCH",
      "artifacts",
      `Scenario requires exactly artifact ${contract.artifactId}.`,
    );
  } else {
    const artifactPath = join(
      input.workspace,
      ".maestro-eval",
      "artifacts",
      `${contract.artifactId}.json`,
    );
    try {
      await assertSafeFile(input.workspace, artifactPath, true);
      const bytes = await readFile(artifactPath);
      if (sha256(bytes) !== input.evidence.artifacts[0].sha256) {
        fail(
          "ARTIFACT_HASH_MISMATCH",
          "artifacts.0.sha256",
          "Artifact evidence does not match retained bytes.",
        );
      }
      await verifyOutcomeArtifact({
        bytes,
        workspace: input.workspace,
        candidateSha: input.candidateSha,
        scenarioId: input.scenarioId,
      });
    } catch (error) {
      fail(
        "ARTIFACT_INVALID",
        "artifacts.0",
        error instanceof Error ? error.message : "Artifact is invalid.",
      );
    }
  }
  if (
    input.evidence.commands.length !== 1 ||
    input.evidence.commands[0]?.id !== contract.command.id
  ) {
    fail(
      "COMMAND_CONTRACT_MISMATCH",
      "commands",
      `Scenario requires exactly command ${contract.command.id}.`,
    );
  } else {
    const execute = input.ports?.execute ?? executeCommand;
    const result = await execute({
      command: contract.command.executable,
      args: contract.command.args,
      cwd: input.workspace,
      env: safeVerifierEnvironment(input.sessionDir),
    });
    verifiedCommandResult = result;
    const receipt = input.evidence.commands[0];
    const resultCode = result.exitCode === 0 ? "passed" : "failed";
    if (
      receipt.exitCode !== result.exitCode ||
      receipt.resultCode !== resultCode ||
      receipt.attestationSha256 !==
        forwardCommandAttestationSha256({
          candidateSha: input.candidateSha,
          scenarioId: input.scenarioId,
          command: contract.command,
          exitCode: result.exitCode,
        })
    ) {
      fail(
        "COMMAND_RECEIPT_MISMATCH",
        "commands.0",
        "Command receipt does not match the harness rerun.",
      );
    }
  }
  if (input.evidence.receiptSha256 !== forwardReceiptSha256(input.evidence)) {
    fail(
      "RECEIPT_HASH_MISMATCH",
      "receiptSha256",
      "Canonical receipt hash does not match verified evidence.",
    );
  }
  return {
    failures: failures.sort((left, right) =>
      `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`),
    ),
    ...(verifiedCommandResult ? { commandResult: verifiedCommandResult } : {}),
  };
}

export function forwardCommandAttestationSha256(input: {
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
  readonly command: {
    readonly id: string;
    readonly executable: string;
    readonly args: readonly string[];
  };
  readonly exitCode: number;
  readonly diagnostics?: {
    readonly stdout: string;
    readonly stderr: string;
  };
}): `sha256:${string}` {
  return sha256(
    JSON.stringify({
      schemaVersion: 1,
      candidateSha: input.candidateSha,
      scenarioId: input.scenarioId,
      command: {
        id: input.command.id,
        executable: input.command.executable,
        args: input.command.args,
      },
      exitCode: input.exitCode,
      resultCode: input.exitCode === 0 ? "passed" : "failed",
    }),
  );
}

export function forwardReceiptSha256(
  evidence: Pick<
    ForwardRunEvidence,
    | "candidateSha"
    | "scenarioId"
    | "artifacts"
    | "commands"
    | "forbiddenActions"
  >,
): `sha256:${string}` {
  return sha256(
    JSON.stringify({
      candidateSha: evidence.candidateSha,
      scenarioId: evidence.scenarioId,
      artifacts: evidence.artifacts,
      commands: evidence.commands,
      forbiddenActions: evidence.forbiddenActions,
    }),
  );
}

async function verifyOutcomeArtifact(input: {
  readonly bytes: Buffer;
  readonly workspace: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
}): Promise<void> {
  const value = JSON.parse(input.bytes.toString("utf8")) as unknown;
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "schemaVersion",
      "scenarioId",
      "candidateSha",
      "outcome",
      "files",
    ]) ||
    value.schemaVersion !== 1 ||
    value.scenarioId !== input.scenarioId ||
    value.candidateSha !== input.candidateSha ||
    value.outcome !==
      forwardScenarios.find(({ id }) => id === input.scenarioId)?.outcome ||
    !Array.isArray(value.files) ||
    value.files.length === 0
  ) {
    throw new Error(
      "Outcome artifact does not match the closed scenario contract.",
    );
  }
  for (const [index, file] of value.files.entries()) {
    if (
      !isRecord(file) ||
      !onlyKeys(file, ["path", "sha256"]) ||
      typeof file.path !== "string" ||
      !/^sha256:[a-f0-9]{64}$/u.test(String(file.sha256))
    ) {
      throw new Error(`Outcome artifact file ${String(index)} is invalid.`);
    }
    const path = resolve(input.workspace, file.path);
    const rel = relative(resolve(input.workspace), path);
    if (
      rel === "" ||
      rel === ".." ||
      rel.startsWith("../") ||
      rel === ".maestro-eval" ||
      rel.startsWith(".maestro-eval/")
    ) {
      throw new Error(
        `Outcome artifact file ${String(index)} escapes product evidence.`,
      );
    }
    await assertSafeFile(input.workspace, path, true);
    if (sha256(await readFile(path)) !== file.sha256) {
      throw new Error(
        `Outcome artifact file ${String(index)} hash mismatches.`,
      );
    }
  }
  if (input.scenarioId === "greenfield-tagged-customer") {
    await verifyGreenfieldCustomerMaterialization({
      workspace: input.workspace,
      files: value.files,
    });
  }
}

async function verifyGreenfieldCustomerMaterialization(input: {
  readonly workspace: string;
  readonly files: readonly unknown[];
}): Promise<void> {
  const instanceEntries = input.files.filter(
    (file): file is { readonly path: string; readonly sha256: string } =>
      isRecord(file) &&
      typeof file.path === "string" &&
      /^[^/\\]+\/template-instance\.json$/u.test(file.path),
  );
  if (instanceEntries.length !== 1) {
    throw new Error(
      "Greenfield materialization requires exactly one separate direct-child customer target template-instance.json.",
    );
  }
  const instanceEntry = instanceEntries[0];
  if (!instanceEntry) throw new Error("Customer instance evidence is missing.");
  const targetName = instanceEntry.path.slice(
    0,
    -"/template-instance.json".length,
  );
  const targetRoot = resolve(input.workspace, targetName);
  await assertSafeDirectory(input.workspace, targetRoot);

  const reviewedManifestPath = resolve(input.workspace, REVIEWED_RELEASE_PATH);
  await assertSafeFile(input.workspace, reviewedManifestPath, true);
  const reviewedManifestBytes = await readFile(reviewedManifestPath);
  const reviewedManifestSha256 = sha256(reviewedManifestBytes);
  const reviewedManifest = parseRecord(
    reviewedManifestBytes,
    "Reviewed customer release manifest is invalid.",
  );
  const reviewedRelease = recordField(
    reviewedManifest,
    "release",
    "Reviewed customer release binding is missing.",
  );
  const additionalPaths = arrayField(
    reviewedManifest,
    "additionalPaths",
    "Reviewed customer ownership additions are missing.",
  );
  if (
    reviewedManifest.schemaVersion !== 1 ||
    reviewedManifest.kind !== "composed-customer-release" ||
    reviewedManifest.materializationStatus !== "materializable"
  ) {
    throw new Error("Reviewed customer release posture is invalid.");
  }

  const instance = parseRecord(
    await readFile(resolve(targetRoot, "template-instance.json")),
    "Customer template-instance.json is invalid.",
  );
  const instanceRelease = recordField(
    instance,
    "release",
    "Customer release binding is missing.",
  );
  if (
    typeof reviewedRelease.version !== "string" ||
    typeof reviewedRelease.tag !== "string" ||
    typeof reviewedRelease.sourceCommit !== "string" ||
    instanceRelease.version !== reviewedRelease.version ||
    instanceRelease.tag !== reviewedRelease.tag ||
    instanceRelease.sourceCommit !== reviewedRelease.sourceCommit
  ) {
    throw new Error(
      "Customer template instance does not match the reviewed version, tag, and source commit.",
    );
  }
  const ownership = recordField(
    instance,
    "ownership",
    "Customer ownership evidence is missing.",
  );
  if (
    ownership.manifest !== REVIEWED_RELEASE_PATH ||
    ownership.manifestChecksum !== reviewedManifestSha256
  ) {
    throw new Error(
      "Customer ownership manifest path or checksum does not match reviewed authority.",
    );
  }

  const baseManifest = recordField(
    reviewedManifest,
    "baseManifest",
    "Reviewed base ownership manifest is missing.",
  );
  if (
    baseManifest.path !== "../v0.1.0-alpha.1/manifest.json" ||
    typeof baseManifest.sha256 !== "string"
  ) {
    throw new Error("Reviewed base ownership binding is invalid.");
  }
  const basePath = resolve(
    input.workspace,
    "releases/v0.2.0-alpha.1",
    baseManifest.path,
  );
  await assertSafeFile(input.workspace, basePath, true);
  const baseBytes = await readFile(basePath);
  if (sha256(baseBytes) !== baseManifest.sha256) {
    throw new Error("Base ownership manifest checksum does not match.");
  }
  const base = parseRecord(baseBytes, "Base ownership manifest is invalid.");
  const ownershipRules = [
    ...arrayField(base, "paths", "Base ownership paths are missing."),
    ...additionalPaths,
  ];
  const factoryOnlyPaths = ownershipRules.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      (entry.match !== "exact" && entry.match !== "subtree") ||
      entry.ownership !== "factory-only" ||
      entry.action !== "omit" ||
      entry.upgrade !== "remove"
    ) {
      return [];
    }
    if (!safeRelativePath(entry.path)) {
      throw new Error("Factory-only ownership path is unsafe.");
    }
    return [entry.path];
  });
  if (factoryOnlyPaths.length === 0) {
    throw new Error("Reviewed ownership has no factory-only exclusions.");
  }
  for (const path of factoryOnlyPaths) {
    if (await pathExists(resolve(targetRoot, path))) {
      throw new Error(`Factory-only path leaked into customer target: ${path}`);
    }
  }
}

function parseRecord(bytes: Buffer, message: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (isRecord(value)) return value;
  } catch {
    // Project the stable closed error below.
  }
  throw new Error(message);
}

function recordField(
  value: Record<string, unknown>,
  key: string,
  message: string,
): Record<string, unknown> {
  const field = value[key];
  if (isRecord(field)) return field;
  throw new Error(message);
}

function arrayField(
  value: Record<string, unknown>,
  key: string,
  message: string,
): readonly unknown[] {
  const field = value[key];
  if (Array.isArray(field)) return field;
  throw new Error(message);
}

function safeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

async function assertSafeDirectory(root: string, path: string): Promise<void> {
  const rel = relative(resolve(root), resolve(path));
  if (rel === "" || rel === ".." || rel.startsWith("../")) {
    throw new Error("Customer target must be separate inside the workspace.");
  }
  let current = resolve(root);
  for (const part of rel.split(/[\\/]/u)) {
    current = join(current, part);
    const entry = await lstat(current);
    if (entry.isSymbolicLink())
      throw new Error("Customer target traverses a symlink.");
    if (current === resolve(path) && !entry.isDirectory())
      throw new Error("Customer target is not a directory.");
  }
}

async function assertSafeFile(
  root: string,
  path: string,
  mustExist: boolean,
): Promise<void> {
  const rel = relative(resolve(root), resolve(path));
  if (rel === "" || rel === ".." || rel.startsWith("../")) {
    throw new Error("Evidence path escapes the workspace.");
  }
  let current = resolve(root);
  for (const part of rel.split(/[\\/]/u)) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink())
        throw new Error("Evidence path traverses a symlink.");
      if (current === resolve(path) && !entry.isFile())
        throw new Error("Evidence path is not a regular file.");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT" && !mustExist) return;
      throw error;
    }
  }
}

function executeCommand(input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<ForwardVerifierCommandResult> {
  return new Promise((resolveResult) => {
    nodeExecFile(
      input.command,
      [...input.args],
      {
        cwd: input.cwd,
        env: input.env,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15 * 60 * 1000,
      },
      (error, stdout, stderr) => {
        resolveResult({
          exitCode:
            error && "code" in error && typeof error.code === "number"
              ? error.code
              : error
                ? 1
                : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });
}

function onlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const expected = [...keys].sort();
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
