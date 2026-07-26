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

type ScenarioContract = {
  readonly artifactId: string;
  readonly command: { readonly id: string; readonly args: readonly string[] };
};

export const forwardScenarioContracts: Readonly<
  Record<ForwardScenarioId, ScenarioContract>
> = {
  "greenfield-tagged-customer": {
    artifactId: "materialization-receipt",
    command: { id: "architecture-gates", args: ["check:gates"] },
  },
  "prototype-adoption": {
    artifactId: "adoption-work-package",
    command: { id: "architecture-gates", args: ["check:gates"] },
  },
  "safe-convex-dev": {
    artifactId: "convex-setup-receipt",
    command: { id: "convex-ai-files", args: ["check:convex-ai-files"] },
  },
  "generated-capability-workflow": {
    artifactId: "generated-workflow-receipt",
    command: { id: "workflow-fast-gates", args: ["check:workflow:fast"] },
  },
  "architecture-gate-repair": {
    artifactId: "gate-repair-receipt",
    command: { id: "architecture-gates", args: ["check:gates"] },
  },
  "active-v1-version-bump": {
    artifactId: "version-bump-receipt",
    command: {
      id: "workflow-version-immutability",
      args: ["check:workflow-version-immutability"],
    },
  },
  "workflow-adversarial-repairs": {
    artifactId: "workflow-repair-receipt",
    command: { id: "workflow-semantics", args: ["check:workflow-semantics"] },
  },
  "promotion-upgrade-refusal": {
    artifactId: "manual-resolution-packet",
    command: { id: "promotion-boundary", args: ["check:promotion-boundary"] },
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

export async function verifyForwardScenario(input: {
  readonly workspace: string;
  readonly sessionDir: string;
  readonly candidateSha: string;
  readonly scenarioId: ForwardScenarioId;
  readonly evidence: ForwardRunEvidence;
  readonly ports?: Partial<ForwardVerifierPorts>;
}): Promise<readonly AssertionFailure[]> {
  const failures: AssertionFailure[] = [];
  const fail = (code: string, path: string, message: string): void => {
    failures.push({ code, path, message });
  };
  const contract = forwardScenarioContracts[input.scenarioId];
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
      command: "pnpm",
      args: contract.command.args,
      cwd: input.workspace,
      env: safeVerifierEnvironment(input.sessionDir),
    });
    const receipt = input.evidence.commands[0];
    if (
      receipt.exitCode !== result.exitCode ||
      receipt.resultCode !== (result.exitCode === 0 ? "passed" : "failed") ||
      receipt.outputSha256 !== commandOutputSha256(result)
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
  return failures.sort((left, right) =>
    `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`),
  );
}

export function commandOutputSha256(input: {
  readonly stdout: string;
  readonly stderr: string;
}): `sha256:${string}` {
  return sha256(`${input.stdout}\n---stderr---\n${input.stderr}`);
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
