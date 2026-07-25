import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  EvaluationError,
  isRecord,
  type ExecutableEvidence,
  type WalkingSkeletonResult,
} from "./contract.js";

export type VerifierCommandResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
};
export type VerifierCommand = (input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}) => Promise<VerifierCommandResult>;
export type UrlProbe = (url: string) => Promise<{
  readonly statusCode: number;
  readonly body: string;
}>;
export type ExecutableEvidencePorts = {
  readonly command: VerifierCommand;
  readonly probeUrl: UrlProbe;
};

export async function verifyExecutableEvidence(input: {
  readonly workspace: string;
  readonly candidateSha: string;
  readonly sessionDir: string;
  readonly result: WalkingSkeletonResult;
  readonly ports?: Partial<ExecutableEvidencePorts>;
}): Promise<ExecutableEvidence> {
  const command = input.ports?.command ?? executeVerifierCommand;
  const probeUrl = input.ports?.probeUrl ?? probeLoopbackUrl;
  const customerRoot = safePath(input.workspace, input.result.customerTarget);
  if (!customerRoot) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "customerTarget must remain inside the clean clone.",
    );
  }
  for (const [path, code] of [
    [input.result.evidence.manifestPath, "EVAL_MANIFEST_INVALID"],
    [input.result.evidence.receiptPath, "EVAL_GATE_RECEIPT_INVALID"],
    [input.result.evidence.recordPath, "EVAL_RECORD_EVIDENCE_INVALID"],
  ] as const) {
    const absolute = safePath(input.workspace, path);
    if (!absolute || !isWithin(customerRoot, absolute)) {
      throw new EvaluationError(
        code,
        `Customer evidence must remain inside the target: ${path}`,
      );
    }
  }
  await verifyProvenance(
    input.workspace,
    input.candidateSha,
    command,
    input.sessionDir,
  );
  await verifyPrerequisites(input.workspace);
  await verifyForbiddenHostConfiguration(customerRoot);

  const manifest = await readJsonEvidence(
    input.workspace,
    input.result.evidence.manifestPath,
    "EVAL_MANIFEST_INVALID",
  );
  validateManifest(manifest, input.candidateSha);
  const receipt = await readJsonEvidence(
    input.workspace,
    input.result.evidence.receiptPath,
    "EVAL_GATE_RECEIPT_INVALID",
  );
  const gateSet = validateReceipt(receipt);
  const verticalSlice = await validateVerticalSlice(
    input.workspace,
    customerRoot,
    input.result.evidence.verticalSlicePaths,
  );
  const firstRecord = await validateFirstRecord(
    input.workspace,
    input.result.evidence.recordPath,
    input.result.evidence.recordId,
  );
  const serverProof = await verifyServer(
    input.workspace,
    input.result.evidence.visibleUrl,
    input.result.evidence.serverProofPath,
    input.result.evidence.recordId,
    probeUrl,
  );

  const check = await command({
    command: "pnpm",
    args: ["maestro", "--", "check", "--mode", "fake", "--json"],
    cwd: customerRoot,
    env: safeVerifierEnvironment(input.sessionDir),
    timeoutMs: 10 * 60 * 1000,
  });
  if (check.exitCode !== 0 || check.stdout.trim().length === 0) {
    throw new EvaluationError(
      "EVAL_GATE_RECEIPT_INVALID",
      "The harness-owned fake-mode check rerun did not pass with nonempty output.",
    );
  }

  return {
    canonicalHashes: {
      manifest: hashCanonical(manifest),
      gateSet: hashCanonical(gateSet),
      verticalSlice: hashCanonical(verticalSlice),
      firstRecord: hashCanonical(firstRecord),
      checkExecution: hashCanonical({
        command: "pnpm maestro -- check --mode fake --json",
        exitCode: 0,
        gateSet,
      }),
    },
    serverProof,
  };
}

export function safeVerifierEnvironment(
  sessionDir: string,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (!source.PATH) {
    throw new EvaluationError(
      "EVAL_PREREQUISITE_EVIDENCE_MISSING",
      "PATH is unavailable.",
    );
  }
  return {
    PATH: source.PATH,
    HOME: sessionDir,
    TMPDIR: sessionDir,
    TMP: sessionDir,
    TEMP: sessionDir,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    CI: "1",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
}

async function verifyProvenance(
  workspace: string,
  candidateSha: string,
  command: VerifierCommand,
  sessionDir: string,
): Promise<void> {
  const env = safeVerifierEnvironment(sessionDir);
  const head = await command({
    command: "git",
    args: ["rev-parse", "HEAD"],
    cwd: workspace,
    env,
    timeoutMs: 10_000,
  });
  const tracked = await command({
    command: "git",
    args: ["status", "--porcelain", "--untracked-files=no"],
    cwd: workspace,
    env,
    timeoutMs: 10_000,
  });
  if (
    head.exitCode !== 0 ||
    head.stdout.trim() !== candidateSha ||
    tracked.exitCode !== 0 ||
    tracked.stdout.trim().length > 0
  ) {
    throw new EvaluationError(
      "EVAL_PROVENANCE_CHANGED",
      "The host changed candidate HEAD or tracked factory files.",
    );
  }
}

async function verifyPrerequisites(workspace: string): Promise<void> {
  for (const path of ["pnpm-lock.yaml", "node_modules/.modules.yaml"]) {
    const absolute = resolve(workspace, path);
    try {
      if ((await stat(absolute)).size < 32) throw new Error("empty");
    } catch {
      throw new EvaluationError(
        "EVAL_PREREQUISITE_EVIDENCE_MISSING",
        `Frozen-install evidence is missing or empty: ${path}`,
      );
    }
  }
}

async function verifyForbiddenHostConfiguration(
  customerRoot: string,
): Promise<void> {
  const forbidden = new Set([
    ".mcp.json",
    ".claude-plugin",
    ".codex/config.toml",
    ".claude/settings.json",
    ".claude/settings.local.json",
  ]);
  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const absolute = resolve(directory, entry.name);
      const path = relative(customerRoot, absolute).replaceAll("\\", "/");
      if (
        [...forbidden].some(
          (item) => path === item || path.startsWith(`${item}/`),
        )
      ) {
        throw new EvaluationError(
          "EVAL_FORBIDDEN_HOST_CONFIG",
          `Stale plugin or MCP configuration must be removed before rerun: ${path}`,
        );
      }
      if (entry.isDirectory()) await walk(absolute);
    }
  };
  try {
    await walk(customerRoot);
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError(
      "EVAL_MANIFEST_INVALID",
      "Customer target is missing or unreadable.",
    );
  }
}

function validateManifest(value: unknown, candidateSha: string): void {
  if (!isRecord(value)) invalidManifest();
  const release = isRecord(value.release) ? value.release : undefined;
  const compatibility = isRecord(value.compatibility)
    ? value.compatibility
    : undefined;
  if (
    value.schemaVersion !== 1 ||
    value.materializationStatus !== "materializable" ||
    !release ||
    release.sourceCommit !== candidateSha ||
    typeof release.version !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(release.sourceChecksum)) ||
    !compatibility ||
    typeof compatibility.cli !== "string" ||
    typeof compatibility.agentPack !== "string" ||
    !Array.isArray(value.paths) ||
    value.paths.length === 0 ||
    !isRecord(value.expectedHashes) ||
    Object.keys(value.expectedHashes).length === 0 ||
    !Array.isArray(value.extensionSeams)
  ) {
    invalidManifest();
  }
}

function invalidManifest(): never {
  throw new EvaluationError(
    "EVAL_MANIFEST_INVALID",
    "Customer manifest is empty, malformed, non-materializable, or not pinned to the candidate.",
  );
}

function validateReceipt(value: unknown): readonly unknown[] {
  if (!isRecord(value)) invalidReceipt();
  const command = isRecord(value.command) ? value.command : undefined;
  const fingerprints = isRecord(value.fingerprints)
    ? value.fingerprints
    : undefined;
  if (
    value.schemaVersion !== 1 ||
    !command ||
    typeof command.id !== "string" ||
    !fingerprints ||
    !String(fingerprints.repository).startsWith("repository_sha256:") ||
    !Array.isArray(value.gates) ||
    value.gates.length === 0
  ) {
    invalidReceipt();
  }
  const gates = value.gates as readonly unknown[];
  const canonical = gates.map((gate) => {
    if (
      !isRecord(gate) ||
      typeof gate.gateId !== "string" ||
      typeof gate.status !== "string"
    ) {
      invalidReceipt();
    }
    if (gate.posture === "required" && gate.status !== "pass") invalidReceipt();
    if (gate.status === "fail") invalidReceipt();
    return {
      gateId: gate.gateId,
      posture: gate.posture,
      evidenceClass: gate.evidenceClass,
      status: gate.status,
      semanticRuleIds: Array.isArray(gate.semanticRuleIds)
        ? [...gate.semanticRuleIds].sort()
        : [],
    };
  });
  return canonical.sort((left, right) =>
    String(left.gateId).localeCompare(String(right.gateId)),
  );
}

function invalidReceipt(): never {
  throw new EvaluationError(
    "EVAL_GATE_RECEIPT_INVALID",
    "Verification receipt is empty, malformed, or contains a failing required gate.",
  );
}

async function validateVerticalSlice(
  workspace: string,
  customerRoot: string,
  paths: readonly string[],
): Promise<readonly { readonly path: string; readonly sha256: string }[]> {
  if (paths.length === 0) invalidVertical();
  const artifacts = [];
  for (const path of [...paths].sort()) {
    const absolute = safePath(workspace, path);
    if (!absolute || !isWithin(customerRoot, absolute)) invalidVertical();
    let content: string;
    try {
      content = await readFile(absolute, "utf8");
    } catch {
      invalidVertical();
    }
    if (
      content.trim().length < 80 ||
      /^\s*(?:export\s*\{\};?)?\s*$/u.test(content)
    ) {
      invalidVertical();
    }
    artifacts.push({
      path: relative(customerRoot, absolute).replaceAll("\\", "/"),
      sha256: hash(content),
    });
  }
  return artifacts;
}

function invalidVertical(): never {
  throw new EvaluationError(
    "EVAL_VERTICAL_SLICE_INVALID",
    "Vertical-slice evidence is missing, outside the target, empty, or placeholder-only.",
  );
}

async function validateFirstRecord(
  workspace: string,
  path: string,
  recordId: string,
): Promise<unknown> {
  const value = await readJsonEvidence(
    workspace,
    path,
    "EVAL_RECORD_EVIDENCE_INVALID",
  );
  const records = Array.isArray(value) ? value : [value];
  const record = records.find(
    (entry) =>
      isRecord(entry) && entry.id === recordId && entry.synthetic === false,
  );
  if (!record || Object.keys(record).length < 3) {
    throw new EvaluationError(
      "EVAL_RECORD_EVIDENCE_INVALID",
      "Persisted-record evidence must contain the created non-synthetic record.",
    );
  }
  return record;
}

async function verifyServer(
  workspace: string,
  url: string,
  proofPath: string | undefined,
  recordId: string,
  probe: UrlProbe,
): Promise<ExecutableEvidence["serverProof"]> {
  if (!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/u.test(url)) {
    throw new EvaluationError(
      "EVAL_BROWSER_PROOF_UNAVAILABLE",
      "Visible URL is not loopback-only.",
    );
  }
  try {
    const response = await probe(url);
    if (
      response.statusCode >= 200 &&
      response.statusCode < 300 &&
      response.body.length > 0 &&
      response.body.includes(recordId)
    ) {
      return {
        url,
        statusCode: response.statusCode,
        responseBytes: Buffer.byteLength(response.body),
        bodySha256: hash(response.body),
        source: "live-probe",
      };
    }
  } catch {
    // Captured proof is the explicit offline fallback.
  }
  if (proofPath) {
    const proof = await readJsonEvidence(
      workspace,
      proofPath,
      "EVAL_BROWSER_PROOF_UNAVAILABLE",
    );
    const bodyPath = isRecord(proof) ? proof.bodyPath : undefined;
    const bodyAbsolute =
      typeof bodyPath === "string" ? safePath(workspace, bodyPath) : null;
    let body = "";
    try {
      body = bodyAbsolute ? await readFile(bodyAbsolute, "utf8") : "";
    } catch {
      body = "";
    }
    if (
      isRecord(proof) &&
      proof.url === url &&
      typeof proof.statusCode === "number" &&
      proof.statusCode >= 200 &&
      proof.statusCode < 300 &&
      typeof proof.responseBytes === "number" &&
      proof.responseBytes > 0 &&
      /^sha256:[0-9a-f]{64}$/u.test(String(proof.bodySha256)) &&
      Buffer.byteLength(body) === proof.responseBytes &&
      hash(body) === proof.bodySha256 &&
      body.includes(recordId) &&
      Number.isFinite(Date.parse(String(proof.capturedAt)))
    ) {
      return {
        url,
        statusCode: proof.statusCode,
        responseBytes: proof.responseBytes,
        bodySha256: String(proof.bodySha256),
        source: "captured-proof",
      };
    }
  }
  throw new EvaluationError(
    "EVAL_BROWSER_PROOF_UNAVAILABLE",
    "The local URL was unreachable and no valid captured server proof exists.",
  );
}

async function readJsonEvidence(
  workspace: string,
  path: string,
  code:
    | "EVAL_MANIFEST_INVALID"
    | "EVAL_GATE_RECEIPT_INVALID"
    | "EVAL_RECORD_EVIDENCE_INVALID"
    | "EVAL_BROWSER_PROOF_UNAVAILABLE",
): Promise<unknown> {
  const absolute = safePath(workspace, path);
  if (!absolute)
    throw new EvaluationError(code, `Unsafe evidence path: ${path}`);
  try {
    const content = await readFile(absolute, "utf8");
    if (content.trim().length < 3 || content.length > 2 * 1024 * 1024)
      throw new Error("size");
    return JSON.parse(content);
  } catch {
    throw new EvaluationError(
      code,
      `Evidence is missing or invalid JSON: ${path}`,
    );
  }
}

function safePath(root: string, path: string): string | null {
  if (!path || isAbsolute(path)) return null;
  const absolute = resolve(root, path);
  return isWithin(root, absolute) ? absolute : null;
}

function isWithin(root: string, absolute: string): boolean {
  const path = relative(root, absolute);
  return (
    path !== ".." &&
    !path.startsWith("../") &&
    !path.startsWith("..\\") &&
    !isAbsolute(path)
  );
}

function hash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hashCanonical(value: unknown): string {
  return hash(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function executeVerifierCommand(input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}): Promise<VerifierCommandResult> {
  return new Promise((resolveResult) => {
    nodeExecFile(
      input.command,
      [...input.args],
      {
        cwd: input.cwd,
        env: input.env,
        timeout: input.timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code = error && "code" in error ? error.code : null;
        resolveResult({
          exitCode: error === null ? 0 : typeof code === "number" ? code : null,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      },
    );
  });
}

export async function probeLoopbackUrl(
  url: string,
): Promise<{ statusCode: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });
    return { statusCode: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}
