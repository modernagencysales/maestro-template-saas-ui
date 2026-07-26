import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { platform as nodePlatform } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  EvaluationError,
  isRecord,
  type BrowserOpenResult,
  type BrowserOpener,
  type ExecutableEvidence,
  type WalkingSkeletonResult,
} from "./contract.js";

const REVIEWED_RELEASE_PATH = "releases/v0.2.0-alpha.1/manifest.json";
export type CandidateProjection = {
  readonly id: string;
  readonly provenance: string;
  readonly digest: string;
  readonly entries: readonly {
    readonly path: string;
    readonly sha256: string;
  }[];
};
export type CandidateProjectionBuilder = (input: {
  readonly name: string;
  readonly outcome: string;
}) => CandidateProjection | Promise<CandidateProjection>;

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
export type ProductProof = {
  readonly url: string;
  readonly create: { readonly statusCode: number; readonly record: unknown };
  readonly read: { readonly statusCode: number; readonly record: unknown };
};
export type ProductProofRunner = (input: {
  readonly workspace: string;
  readonly customerRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly command: VerifierCommand;
  readonly withLiveRuntime: (proof: ProductProof) => Promise<void>;
}) => Promise<void>;
export type BrowserOpenPort = (input: {
  readonly url: string;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly command: VerifierCommand;
}) => Promise<BrowserOpenResult>;
export type ExecutableEvidencePorts = {
  readonly command: VerifierCommand;
  readonly productProof: ProductProofRunner;
  readonly browserOpen: BrowserOpenPort;
  readonly candidateProjection: CandidateProjectionBuilder;
};

export async function verifyExecutableEvidence(input: {
  readonly workspace: string;
  readonly candidateSha: string;
  readonly expectedProductName: string;
  readonly sessionDir: string;
  readonly result: WalkingSkeletonResult;
  readonly ports?: Partial<ExecutableEvidencePorts>;
}): Promise<ExecutableEvidence> {
  const command = input.ports?.command ?? executeVerifierCommand;
  const customerRoot = safePath(input.workspace, input.result.customerTarget);
  if (!customerRoot) {
    throw new EvaluationError(
      "EVAL_RESULT_INVALID",
      "customerTarget must remain inside the clean clone.",
    );
  }
  const manifestPath = safePath(
    input.workspace,
    input.result.evidence.manifestPath,
  );
  if (
    !manifestPath ||
    manifestPath !== resolve(customerRoot, "template-instance.json")
  ) {
    throw new EvaluationError(
      "EVAL_MANIFEST_INVALID",
      "Manifest evidence must be the generated customer template-instance.json.",
    );
  }
  const receiptPath = safePath(
    input.workspace,
    input.result.evidence.receiptPath,
  );
  if (!receiptPath || !isWithin(customerRoot, receiptPath)) {
    throw new EvaluationError(
      "EVAL_GATE_RECEIPT_INVALID",
      "Gate receipt evidence must remain inside the customer target.",
    );
  }

  await verifyProvenance(
    input.workspace,
    input.candidateSha,
    command,
    input.sessionDir,
  );
  await verifyPrerequisites(input.workspace);
  const releaseProjection = await verifyReviewedReleaseProjection(
    input.workspace,
    customerRoot,
    manifestPath,
    input.candidateSha,
    input.expectedProductName,
    input.ports?.candidateProjection ??
      createTrustedCandidateProjectionBuilder(),
  );
  await verifyForbiddenHostConfiguration(
    customerRoot,
    releaseProjection.projectedFiles,
  );
  const receipt = await readJsonFile(receiptPath, "EVAL_GATE_RECEIPT_INVALID");
  const gateSet = validateReceipt(receipt);

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

  const productProofRunner = input.ports?.productProof ?? runProductOwnedProof;
  const browserOpen = input.ports?.browserOpen ?? createNativeBrowserOpenPort();
  let liveEvidence:
    | {
        readonly productProof: ProductProof;
        readonly record: unknown;
        readonly browserOpenResult: BrowserOpenResult;
      }
    | undefined;
  await productProofRunner({
    workspace: input.workspace,
    customerRoot,
    env: safeVerifierEnvironment(input.sessionDir),
    command,
    withLiveRuntime: async (productProof) => {
      if (liveEvidence) {
        throw new EvaluationError(
          "EVAL_PRODUCT_PROOF_UNAVAILABLE",
          "Product-owned proof exposed more than one live runtime.",
        );
      }
      const record = validateProductProof(productProof);
      let browserOpenResult: BrowserOpenResult;
      try {
        browserOpenResult = await browserOpen({
          url: productProof.url,
          cwd: customerRoot,
          env: safeVerifierEnvironment(input.sessionDir),
          command,
        });
      } catch {
        browserOpenResult = {
          status: "headless-fallback",
          reason: "opener-failed",
        };
      }
      liveEvidence = { productProof, record, browserOpenResult };
    },
  });
  if (!liveEvidence) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "Product-owned proof did not expose its validated live runtime.",
    );
  }
  const { productProof, record, browserOpenResult } = liveEvidence;
  const recordBytes = stableStringify(record);

  return {
    canonicalHashes: {
      manifest: hashCanonical(releaseProjection.binding),
      gateSet: hashCanonical(gateSet),
      verticalSlice: hashCanonical(releaseProjection.projectedFiles),
      firstRecord: hash(recordBytes),
      checkExecution: hashCanonical({
        command: "pnpm maestro -- check --mode fake --json",
        exitCode: 0,
        gateSet,
      }),
    },
    browserOpen: {
      ...browserOpenResult,
      proofUrl: productProof.url,
    },
    serverProof: {
      url: productProof.url,
      statusCode: productProof.read.statusCode,
      responseBytes: Buffer.byteLength(recordBytes),
      bodySha256: hash(recordBytes),
      source: "live-probe",
    },
  };
}

export function createNativeBrowserOpenPort(
  platform: NodeJS.Platform = nodePlatform(),
): BrowserOpenPort {
  return async (input) => {
    const opener = nativeBrowserOpener(platform, input.url);
    if (!opener) {
      return {
        status: "headless-fallback",
        reason: "unsupported-platform",
      };
    }
    let result: VerifierCommandResult;
    try {
      result = await input.command({
        command: opener.command,
        args: opener.args,
        cwd: input.cwd,
        env: input.env,
        timeoutMs: 10_000,
      });
    } catch {
      return {
        status: "headless-fallback",
        opener: opener.opener,
        reason: "opener-failed",
      };
    }
    if (result.exitCode === 0) {
      return { status: "opened", opener: opener.opener };
    }
    return {
      status: "headless-fallback",
      opener: opener.opener,
      reason: "opener-failed",
    };
  };
}

function nativeBrowserOpener(
  platform: NodeJS.Platform,
  url: string,
):
  | {
      readonly opener: BrowserOpener;
      readonly command: string;
      readonly args: readonly string[];
    }
  | undefined {
  if (platform === "darwin") {
    return { opener: "open", command: "open", args: [url] };
  }
  if (platform === "linux") {
    return { opener: "xdg-open", command: "xdg-open", args: [url] };
  }
  if (platform === "win32") {
    return {
      opener: "explorer.exe",
      command: "explorer.exe",
      args: [url],
    };
  }
  return undefined;
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

async function verifyReviewedReleaseProjection(
  workspace: string,
  customerRoot: string,
  instancePath: string,
  candidateSha: string,
  expectedProductName: string,
  candidateProjection: CandidateProjectionBuilder,
): Promise<{
  readonly binding: unknown;
  readonly projectedFiles: readonly {
    readonly path: string;
    readonly sha256: string;
  }[];
}> {
  const releasePath = resolve(workspace, REVIEWED_RELEASE_PATH);
  const [releaseBytes, instance] = await Promise.all([
    readFile(releasePath),
    readJsonFile(instancePath, "EVAL_MANIFEST_INVALID"),
  ]).catch(() => {
    throw new EvaluationError(
      "EVAL_MANIFEST_INVALID",
      "Candidate reviewed release projection is unavailable.",
    );
  });
  const release = parseJsonBuffer(releaseBytes, "EVAL_MANIFEST_INVALID");
  if (!isRecord(release) || !isRecord(instance)) {
    invalidManifest();
  }
  const reviewedBinding = isRecord(release.release)
    ? release.release
    : undefined;
  const instanceBinding = isRecord(instance.release)
    ? instance.release
    : undefined;
  const ownership = isRecord(instance.ownership)
    ? instance.ownership
    : undefined;
  const instanceBlueprint = isRecord(instance.blueprint)
    ? instance.blueprint
    : undefined;
  const compatibility = isRecord(instance.compatibility)
    ? instance.compatibility
    : undefined;
  const personalization = isRecord(instance.personalization)
    ? instance.personalization
    : undefined;
  if (
    !personalization ||
    typeof personalization.name !== "string" ||
    typeof personalization.firstOutcome !== "string" ||
    personalization.name !== expectedProductName
  ) {
    invalidManifest();
  }
  const blueprint = await candidateProjection({
    name: personalization.name,
    outcome: personalization.firstOutcome,
  });
  const authorityChecksum = hash(
    JSON.stringify({
      kind: "unreleased-current-composition",
      candidate: { sourceCommit: candidateSha },
      base: {
        manifestChecksum: hashBuffer(releaseBytes),
        tag: reviewedBinding?.tag,
        sourceCommit: reviewedBinding?.sourceCommit,
        sourceChecksum: reviewedBinding?.sourceChecksum,
      },
      blueprint: {
        id: blueprint.id,
        provenance: blueprint.provenance,
        digest: blueprint.digest,
      },
    }),
  );
  const candidateBinding = {
    version: "unreleased-current",
    tag: "unreleased-current",
    sourceCommit: candidateSha,
    sourceChecksum: authorityChecksum,
  };
  if (
    release.schemaVersion !== 1 ||
    release.materializationStatus !== "materializable" ||
    !reviewedBinding ||
    !instanceBinding ||
    stableStringify(instanceBinding) !== stableStringify(candidateBinding) ||
    !compatibility ||
    compatibility.cli !== "unreleased-current" ||
    compatibility.agentPack !== "unreleased-current" ||
    !ownership ||
    ownership.manifest !== "unreleased-current-composition" ||
    ownership.manifestChecksum !== authorityChecksum ||
    !instanceBlueprint ||
    instanceBlueprint.id !== blueprint.id ||
    instanceBlueprint.provenance !== blueprint.provenance ||
    instanceBlueprint.digest !== blueprint.digest ||
    !Array.isArray(blueprint.entries) ||
    blueprint.entries.length === 0
  ) {
    invalidManifest();
  }
  const projectedFiles = [];
  for (const entry of blueprint.entries) {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(String(entry.sha256))
    ) {
      invalidManifest();
    }
    const targetPath = safePath(customerRoot, entry.path);
    if (!targetPath) invalidManifest();
    let bytes: Buffer;
    try {
      bytes = await readFile(targetPath);
    } catch {
      invalidManifest();
    }
    const actual = hashBuffer(bytes);
    if (actual !== entry.sha256) invalidManifest();
    projectedFiles.push({ path: entry.path, sha256: actual });
  }
  return {
    binding: {
      release: candidateBinding,
      baseManifestChecksum: hashBuffer(releaseBytes),
      ownershipManifestChecksum: authorityChecksum,
      blueprintDigest: blueprint.digest,
      blueprintId: blueprint.id,
      blueprintProvenance: blueprint.provenance,
    },
    projectedFiles,
  };
}

export function createTrustedCandidateProjectionBuilder(): CandidateProjectionBuilder {
  return async ({ name, outcome }) => {
    const modulePath = resolve(
      import.meta.dirname,
      "../../../generators/src/blueprints/saasApplication.ts",
    );
    const loaded = (await import(pathToFileURL(modulePath).href)) as {
      readonly buildSaasApplicationTargetPlan?: (input: {
        readonly name: string;
        readonly firstOutcome: string;
      }) => CandidateProjection;
    };
    if (typeof loaded.buildSaasApplicationTargetPlan !== "function") {
      invalidManifest();
    }
    return loaded.buildSaasApplicationTargetPlan({
      name,
      firstOutcome: outcome,
    });
  };
}

function invalidManifest(): never {
  throw new EvaluationError(
    "EVAL_MANIFEST_INVALID",
    "Customer instance does not match the candidate reviewed release binding and projection.",
  );
}

export async function runProductOwnedProof(input: {
  readonly workspace: string;
  readonly customerRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly command: VerifierCommand;
  readonly withLiveRuntime: (proof: ProductProof) => Promise<void>;
}): Promise<void> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(
      await readFile(resolve(input.customerRoot, "package.json"), "utf8"),
    );
  } catch {
    manifest = undefined;
  }
  const scripts =
    isRecord(manifest) && isRecord(manifest.scripts)
      ? manifest.scripts
      : undefined;
  if (
    !scripts ||
    scripts["maestro:crud-proof"] !==
      "tsx tooling/generators/src/crud-proof.ts --mode fake"
  ) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "Generated customer app lacks a product-owned maestro:crud-proof command that launches fake mode and exercises create plus read after host exit.",
    );
  }
  const commandResult = await input.command({
    command: "pnpm",
    args: ["run", "maestro:crud-proof", "--", "--json"],
    cwd: input.customerRoot,
    env: input.env,
    timeoutMs: 5 * 60 * 1000,
  });
  if (commandResult.exitCode !== 0) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof command failed.",
    );
  }
  let commandProof: ProductProof;
  try {
    const parsed = JSON.parse(commandResult.stdout) as unknown;
    commandProof = parseCommandProductProof(parsed);
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof command returned invalid evidence.",
    );
  }
  let liveRuntimeSeen = false;
  try {
    const productModule = (await import(
      pathToFileURL(
        resolve(input.workspace, "tooling/generators/src/crud-proof.ts"),
      ).href
    )) as Record<string, unknown>;
    if (typeof productModule.runCrudProof !== "function") {
      throw new Error("runCrudProof export unavailable");
    }
    const runCrudProof = productModule.runCrudProof as (options: {
      readonly cwd: string;
      readonly mode: string;
      readonly environment: NodeJS.ProcessEnv;
      readonly withLiveRuntime: (runtime: unknown) => Promise<void>;
    }) => Promise<unknown>;
    await runCrudProof({
      cwd: input.customerRoot,
      mode: "fake",
      environment: input.env,
      withLiveRuntime: async (runtime) => {
        if (liveRuntimeSeen) {
          throw new EvaluationError(
            "EVAL_PRODUCT_PROOF_UNAVAILABLE",
            "Product-owned proof exposed more than one live runtime.",
          );
        }
        liveRuntimeSeen = true;
        const liveProof = parseLiveProductProof(runtime);
        if (
          stableStringify({
            create: commandProof.create,
            read: commandProof.read,
          }) !==
          stableStringify({ create: liveProof.create, read: liveProof.read })
        ) {
          throw new EvaluationError(
            "EVAL_PRODUCT_PROOF_UNAVAILABLE",
            "Native and live product-owned CRUD proof evidence diverged.",
          );
        }
        await input.withLiveRuntime(liveProof);
      },
    });
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof module failed.",
    );
  }
  if (!liveRuntimeSeen) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof module did not expose a live runtime.",
    );
  }
}

function parseCommandProductProof(value: unknown): ProductProof {
  if (!isRecord(value) || typeof value.url !== "string") {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof command returned invalid evidence.",
    );
  }
  return parseProductProofParts(value.url, value.create, value.read);
}

function parseLiveProductProof(runtime: unknown): ProductProof {
  if (!isRecord(runtime) || typeof runtime.url !== "string") {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof module returned invalid live evidence.",
    );
  }
  const proof = isRecord(runtime.proof) ? runtime.proof : undefined;
  return parseProductProofParts(runtime.url, proof?.create, proof?.read);
}

function parseProductProofParts(
  url: string,
  createValue: unknown,
  readValue: unknown,
): ProductProof {
  const create = isRecord(createValue) ? createValue : undefined;
  const read = isRecord(readValue) ? readValue : undefined;
  if (
    !create ||
    !read ||
    typeof create.statusCode !== "number" ||
    typeof read.statusCode !== "number"
  ) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "The product-owned CRUD proof module returned invalid live evidence.",
    );
  }
  return {
    url,
    create: { statusCode: create.statusCode, record: create.record },
    read: { statusCode: read.statusCode, record: read.record },
  };
}

function validateProductProof(proof: ProductProof): unknown {
  if (
    !/^http:\/\/127\.0\.0\.1:\d+\//u.test(proof.url) ||
    !success(proof.create?.statusCode) ||
    !success(proof.read?.statusCode) ||
    !isRecord(proof.create?.record) ||
    !isRecord(proof.read?.record) ||
    stableStringify(proof.create.record) !==
      stableStringify(proof.read.record) ||
    typeof proof.read.record.id !== "string" ||
    proof.read.record.id.length === 0 ||
    proof.read.record.synthetic !== false
  ) {
    throw new EvaluationError(
      "EVAL_PRODUCT_PROOF_UNAVAILABLE",
      "Product-owned proof did not independently create and read the same non-synthetic local record.",
    );
  }
  return proof.read.record;
}

function success(value: number | undefined): boolean {
  return typeof value === "number" && value >= 200 && value < 300;
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
  reviewedFiles: readonly { readonly path: string; readonly sha256: string }[],
): Promise<void> {
  const reviewedSettings = reviewedFiles.find(
    ({ path }) => path === ".claude/settings.json",
  );
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
      if (path === ".claude/settings.json" && reviewedSettings) {
        let actual: string | undefined;
        try {
          actual = entry.isFile()
            ? hashBuffer(await readFile(absolute))
            : undefined;
        } catch {
          actual = undefined;
        }
        if (actual === reviewedSettings.sha256) continue;
      }
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
  const canonical = (value.gates as readonly unknown[]).map((gate) => {
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

async function readJsonFile(
  path: string,
  code: "EVAL_MANIFEST_INVALID" | "EVAL_GATE_RECEIPT_INVALID",
): Promise<unknown> {
  try {
    const content = await readFile(path, "utf8");
    if (content.trim().length < 3 || content.length > 4 * 1024 * 1024) {
      throw new Error("size");
    }
    return JSON.parse(content);
  } catch {
    throw new EvaluationError(
      code,
      `Evidence is missing or invalid JSON: ${path}`,
    );
  }
}

function parseJsonBuffer(
  value: Buffer,
  code: "EVAL_MANIFEST_INVALID",
): unknown {
  try {
    return JSON.parse(value.toString("utf8"));
  } catch {
    throw new EvaluationError(code, "Reviewed release JSON is invalid.");
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

function hashBuffer(value: Buffer): string {
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
