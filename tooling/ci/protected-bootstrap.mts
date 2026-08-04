import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";

type Sha256 = `sha256:${string}`;
export type ProtectedBootstrapObservation = {
  readonly repository: string;
  readonly baseRef: "main";
  readonly protectedBaseOid: string;
  readonly controllerImageDigest: Sha256;
  readonly appId: number;
  readonly canonicalContext: "ci/woodpecker/pr/verify";
  readonly temporaryContext: `ci/woodpecker/pr/${string}`;
  readonly woodpeckerConfigDigest: Sha256;
  readonly githubRulesetDigest: Sha256;
};
export type ProtectedExternalDocument = {
  readonly kind:
    | "github-ruleset"
    | "woodpecker-repository"
    | "woodpecker-producer"
    | "woodpecker-secret-reference";
  readonly resourceId: string;
  readonly canonicalBody: Readonly<Record<string, unknown>>;
  readonly sha256: Sha256;
};
export type ProtectedInverseOperation = {
  readonly method: "PUT" | "PATCH" | "DELETE";
  readonly resourcePath: string;
  readonly canonicalBody?: Readonly<Record<string, unknown>>;
};
export type ProtectedTransitionJournal = {
  readonly schemaVersion: 1;
  readonly operationNonce: string;
  readonly operatorIdentity: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedConfirmations: readonly string[];
  readonly observation: ProtectedBootstrapObservation;
  readonly steps: readonly {
    readonly id: string;
    readonly preimage: readonly ProtectedExternalDocument[];
    readonly forwardPostimage?: readonly ProtectedExternalDocument[];
    readonly inverse?: readonly ProtectedInverseOperation[];
    readonly inverseAllowedOnlyFrom?: Sha256;
    readonly progress?: readonly {
      readonly resourceId: string;
      readonly state:
        | "pending"
        | "forward-intent"
        | "forward-written"
        | "forward-verified"
        | "inverse-intent"
        | "inverse-written"
        | "inverse-verified";
    }[];
  }[];
};

export type ProtectedControllerEndpoint = {
  readonly observe: (
    document: ProtectedExternalDocument,
  ) => Promise<ProtectedExternalDocument>;
  readonly write: (input: {
    readonly method: ProtectedInverseOperation["method"];
    readonly document: ProtectedExternalDocument;
  }) => Promise<void>;
};

/** The only capability boundary permitted to reach the CI control plane. */
export type ProtectedControllerApi = {
  readonly github: ProtectedControllerEndpoint;
  readonly woodpecker: ProtectedControllerEndpoint;
  readonly controller: ProtectedControllerEndpoint;
  readonly observeSecurityCodeownerApproval?: (input: {
    readonly repository: string;
    readonly pullRequestNumber: number;
    readonly candidateCommit: string;
  }) => Promise<Readonly<Record<string, unknown>>>;
};

function httpEndpoint(input: {
  readonly baseUrl: string;
  readonly token: string;
  readonly contractVersion?: string;
}): ProtectedControllerEndpoint {
  const base = new URL(input.baseUrl);
  const testHttp =
    process.env.NODE_ENV === "test" &&
    process.env.PROTECTED_BOOTSTRAP_TEST_HTTP === "1" &&
    base.protocol === "http:" &&
    ["127.0.0.1", "::1", "localhost"].includes(base.hostname);
  if (base.protocol !== "https:" && !testHttp)
    throw new Error("protected controller endpoints require HTTPS");
  const request = async (
    method: ProtectedInverseOperation["method"] | "GET",
    document: ProtectedExternalDocument,
  ): Promise<ProtectedExternalDocument> => {
    const path = document.resourceId.startsWith("/")
      ? document.resourceId
      : `/${document.resourceId}`;
    const url = new URL(path, base);
    if (
      url.origin !== base.origin ||
      path.startsWith("//") ||
      path.includes("\\")
    )
      throw new Error(
        "protected controller resource path escaped its base origin",
      );
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.token}`,
        ...(input.contractVersion
          ? { "x-maestro-contract-version": input.contractVersion }
          : {}),
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(providerWriteBody(document)),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(
        `protected controller ${method} ${path}: ${response.status}`,
      );
    const body =
      method === "DELETE"
        ? {}
        : ((await response.json()) as Record<string, unknown>);
    return sanitizedDocument({
      ...document,
      canonicalBody: body,
    });
  };
  return {
    observe: (document) => request("GET", document),
    write: async ({ method, document }) => {
      await request(method, document);
    },
  };
}

export function createProtectedControllerHttpAdapter(): ProtectedControllerApi {
  const githubToken = process.env.GITHUB_TOKEN;
  const woodpeckerToken = process.env.WOODPECKER_TOKEN;
  const controllerToken = process.env.PROTECTED_CONTROLLER_TOKEN;
  const controllerUrl = process.env.PROTECTED_CONTROLLER_API_URL;
  const controllerVersion = process.env.PROTECTED_CONTROLLER_API_VERSION;
  if (!githubToken || !woodpeckerToken || !controllerToken || !controllerUrl)
    throw new Error("protected controller credentials are unavailable");
  if (controllerVersion !== "maestro.protected-ci/v1")
    throw new Error("unsupported protected controller API contract version");
  const controller = httpEndpoint({
    baseUrl: controllerUrl,
    token: controllerToken,
    contractVersion: controllerVersion,
  });
  return {
    github: httpEndpoint({
      baseUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
      token: githubToken,
    }),
    woodpecker: httpEndpoint({
      baseUrl: process.env.WOODPECKER_SERVER ?? "https://ci.maestrogtm.com",
      token: woodpeckerToken,
    }),
    controller,
    observeSecurityCodeownerApproval: async (input) => {
      const resourceId = `/v1/security-codeowner-approvals/${encodeURIComponent(input.repository)}/${input.pullRequestNumber}?candidate=${input.candidateCommit}`;
      const observed = await controller.observe(
        normalizeProtectedExternalDocument({
          kind: "woodpecker-secret-reference",
          resourceId,
          canonicalBody: {},
          sha256: `sha256:${"0".repeat(64)}`,
        }),
      );
      return observed.canonicalBody;
    },
  };
}

function providerWriteBody(
  document: ProtectedExternalDocument,
): Readonly<Record<string, unknown>> {
  const body = document.canonicalBody;
  if (document.kind === "github-ruleset")
    return Object.fromEntries(
      [
        "name",
        "target",
        "enforcement",
        "bypass_actors",
        "conditions",
        "rules",
      ].flatMap((key) => (body[key] === undefined ? [] : [[key, body[key]]])),
    );
  if (document.kind === "woodpecker-repository")
    return Object.fromEntries(
      ["trusted", "config_file", "visibility"].flatMap((key) =>
        body[key] === undefined ? [] : [[key, body[key]]],
      ),
    );
  return body;
}

export function verifyProtectedBootstrap(
  observation: ProtectedBootstrapObservation,
): readonly string[] {
  const findings: string[] = [];
  if (observation.baseRef !== "main") findings.push("baseRef must be main");
  if (!/^[a-f0-9]{40}$/u.test(observation.protectedBaseOid))
    findings.push("protectedBaseOid must be a full Git OID");
  if (!Number.isSafeInteger(observation.appId) || observation.appId <= 0)
    findings.push("appId must be a positive integer");
  if (observation.canonicalContext !== "ci/woodpecker/pr/verify")
    findings.push("canonicalContext is not canonical");
  if (observation.temporaryContext === observation.canonicalContext)
    findings.push("temporaryContext must differ from canonicalContext");
  for (const [name, value] of Object.entries(observation).filter(([name]) =>
    name.endsWith("Digest"),
  ))
    if (!/^sha256:[a-f0-9]{64}$/u.test(String(value)))
      findings.push(`${name} must be sha256`);
  return findings;
}

export function planProtectedTransition(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly expectedLiveDigest: Sha256;
  readonly stepId?: string;
}): {
  readonly previewFingerprint: `protected_transition_sha256:${string}`;
  readonly confirmationArgv: readonly string[];
} {
  const errors = verifyProtectedBootstrap(input.journal.observation);
  if (errors.length) throw new Error(errors.join("; "));
  const fingerprint = `protected_transition_sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        action: input.action,
        journal: input.journal,
        expectedLiveDigest: input.expectedLiveDigest,
        stepId: input.stepId,
      }),
    )
    .digest("hex")}` as const;
  return {
    previewFingerprint: fingerprint,
    confirmationArgv: [
      input.action,
      ...(input.stepId ? ["--step", input.stepId] : []),
      "--expected-live-digest",
      input.expectedLiveDigest,
      "--confirm",
      fingerprint,
      "--operation-nonce",
      input.journal.operationNonce,
      "--operator",
      input.journal.operatorIdentity,
    ],
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      /token|secret|password|credential/iu.test(key) &&
      !/reference|name|id|event/iu.test(key)
        ? []
        : [[key, sanitize(entry)]],
    ),
  );
}

function sanitizedDocument(
  document: ProtectedExternalDocument,
): ProtectedExternalDocument {
  const canonicalBody = sanitize(document.canonicalBody) as Readonly<
    Record<string, unknown>
  >;
  return {
    ...document,
    canonicalBody,
    sha256: `sha256:${createHash("sha256").update(canonical(canonicalBody)).digest("hex")}`,
  };
}

export function normalizeProtectedExternalDocument(
  document: ProtectedExternalDocument,
): ProtectedExternalDocument {
  return sanitizedDocument(document);
}

export function digestProtectedDocuments(
  documents: readonly ProtectedExternalDocument[],
): Sha256 {
  const normalized = documents
    .map(sanitizedDocument)
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  return `sha256:${createHash("sha256").update(canonical(normalized)).digest("hex")}`;
}

function redactJournal(
  journal: ProtectedTransitionJournal,
): ProtectedTransitionJournal {
  return {
    ...journal,
    observation: sanitize(journal.observation) as ProtectedBootstrapObservation,
    steps: journal.steps.map((step) => ({
      ...step,
      preimage: step.preimage.map(sanitizedDocument),
      forwardPostimage: step.forwardPostimage?.map(sanitizedDocument),
      inverse: step.inverse?.map((inverse) => ({
        ...inverse,
        canonicalBody: inverse.canonicalBody
          ? (sanitize(inverse.canonicalBody) as Readonly<
              Record<string, unknown>
            >)
          : undefined,
      })),
    })),
  };
}

function assertDocumentOperationBinding(
  observation: ProtectedBootstrapObservation,
  document: Pick<ProtectedExternalDocument, "kind" | "resourceId">,
): void {
  const prefix =
    document.kind === "github-ruleset"
      ? `/repos/${observation.repository}/rulesets/`
      : document.kind === "woodpecker-repository"
        ? `/api/repos/${observation.repository}`
        : `/v1/repositories/${observation.repository}/`;
  if (
    !document.resourceId.startsWith(prefix) ||
    (document.kind === "woodpecker-repository" &&
      document.resourceId !== prefix &&
      !document.resourceId.startsWith(`${prefix}/`))
  )
    throw new Error(
      `protected transition operation binding rejected ${document.resourceId}`,
    );
}

function assertJournalOperationBinding(
  journal: ProtectedTransitionJournal,
): void {
  for (const step of journal.steps) {
    for (const document of [...step.preimage, ...(step.forwardPostimage ?? [])])
      assertDocumentOperationBinding(journal.observation, document);
    for (const inverse of step.inverse ?? []) {
      const matching = [
        ...step.preimage,
        ...(step.forwardPostimage ?? []),
      ].find((entry) => entry.resourceId === inverse.resourcePath);
      if (!matching)
        throw new Error(
          `protected transition operation binding rejected inverse ${inverse.resourcePath}`,
        );
      assertDocumentOperationBinding(journal.observation, matching);
    }
  }
}

export function saveProtectedTransitionJournal(
  path: string,
  journal: ProtectedTransitionJournal,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(
    temporary,
    `${JSON.stringify(redactJournal(journal), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  renameSync(temporary, path);
}

export function loadProtectedTransitionJournal(
  path: string,
): ProtectedTransitionJournal {
  const journal = JSON.parse(
    readFileSync(path, "utf8"),
  ) as ProtectedTransitionJournal;
  if (journal.schemaVersion !== 1 || !Array.isArray(journal.steps))
    throw new Error("invalid protected transition journal");
  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(journal.operationNonce) ||
    !journal.operatorIdentity ||
    !Array.isArray(journal.consumedConfirmations) ||
    !Number.isFinite(Date.parse(journal.createdAt)) ||
    !Number.isFinite(Date.parse(journal.expiresAt))
  )
    throw new Error("invalid protected transition operation binding");
  const errors = verifyProtectedBootstrap(journal.observation);
  if (errors.length) throw new Error(errors.join("; "));
  assertJournalOperationBinding(journal);
  return redactJournal(journal);
}

export async function withProtectedJournalLock<Value>(
  journalPath: string,
  operation: () => Promise<Value>,
): Promise<Value> {
  const lockPath = `${journalPath}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
  } catch {
    throw new Error(`protected transition journal is locked: ${journalPath}`);
  }
  try {
    return await operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockPath);
  }
}

function endpointFor(
  api: ProtectedControllerApi | undefined,
  document: ProtectedExternalDocument,
): ProtectedControllerEndpoint {
  if (!api)
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  if (document.kind === "github-ruleset") return api.github;
  if (document.kind === "woodpecker-repository") return api.woodpecker;
  return api.controller;
}

function forwardMethod(
  document: ProtectedExternalDocument,
): ProtectedInverseOperation["method"] {
  return document.kind === "woodpecker-repository" ? "PATCH" : "PUT";
}

async function observeDocument(
  api: ProtectedControllerApi | undefined,
  document: ProtectedExternalDocument,
): Promise<ProtectedExternalDocument> {
  const observed = sanitizedDocument(
    await endpointFor(api, document).observe(document),
  );
  if (
    observed.kind !== document.kind ||
    observed.resourceId !== document.resourceId
  )
    throw new Error(
      "protected controller post-read operation binding mismatch",
    );
  return observed;
}

export async function observeSecurityCodeownerApproval(input: {
  readonly repository: string;
  readonly pullRequestNumber: number;
  readonly candidateCommit: string;
  readonly api?: ProtectedControllerApi;
}): Promise<{
  readonly repository: string;
  readonly pullRequestNumber: number;
  readonly candidateCommit: string;
  readonly approver: string;
}> {
  if (!/^[a-f0-9]{40}$/u.test(input.candidateCommit))
    throw new Error("security approval requires a full candidate commit OID");
  if (
    !Number.isSafeInteger(input.pullRequestNumber) ||
    input.pullRequestNumber <= 0
  )
    throw new Error(
      "security approval requires a positive pull request number",
    );
  const observe = input.api?.observeSecurityCodeownerApproval;
  if (observe === undefined)
    throw new Error(
      "protected controller adapter is required; candidate input cannot assert security approval",
    );
  const body = await observe(input);
  if (
    body.repository !== input.repository ||
    body.pullRequestNumber !== input.pullRequestNumber ||
    body.candidateCommit !== input.candidateCommit ||
    body.dedicatedAuthPolicyPr !== true ||
    body.currentHeadApproved !== true ||
    body.securityCodeownerApproved !== true ||
    typeof body.approver !== "string" ||
    body.approver.length === 0
  )
    throw new Error(
      "auth-policy weakening requires a dedicated PR with current-head security CODEOWNER approval",
    );
  return {
    repository: input.repository,
    pullRequestNumber: input.pullRequestNumber,
    candidateCommit: input.candidateCommit,
    approver: body.approver,
  };
}

/**
 * Reads all control-plane documents through the injected protected controller.
 * It deliberately persists only the sanitized canonical preimage.
 */
export async function observeProtectedBootstrap(input: {
  readonly observation: ProtectedBootstrapObservation;
  readonly documents: readonly ProtectedExternalDocument[];
  readonly api?: ProtectedControllerApi;
  readonly operationNonce?: string;
  readonly operatorIdentity?: string;
  readonly createdAt?: string;
  readonly expiresAt?: string;
}): Promise<ProtectedTransitionJournal> {
  const errors = verifyProtectedBootstrap(input.observation);
  if (errors.length) throw new Error(errors.join("; "));
  const preimage = await Promise.all(
    input.documents.map(async (document) =>
      observeDocument(input.api, document),
    ),
  );
  return {
    schemaVersion: 1,
    operationNonce: input.operationNonce ?? randomUUID(),
    operatorIdentity:
      input.operatorIdentity ?? process.env.PROTECTED_OPERATOR_ID ?? "unknown",
    createdAt: input.createdAt ?? new Date().toISOString(),
    expiresAt:
      input.expiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString(),
    consumedConfirmations: [],
    observation: input.observation,
    steps: [{ id: "observation", preimage }],
  };
}

/** Applies a previously previewed journal entry only while its recorded state remains live. */
export async function executeProtectedTransition(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly api?: ProtectedControllerApi;
  readonly expectedLiveDigest: Sha256;
  readonly confirmation: string;
  readonly operatorIdentity?: string;
  readonly stepId?: string;
  readonly persistJournal?: () => void | Promise<void>;
}): Promise<void> {
  assertJournalOperationBinding(input.journal);
  const step =
    input.action === "rollback"
      ? input.stepId
        ? input.journal.steps.find((entry) => entry.id === input.stepId)
        : [...input.journal.steps]
            .reverse()
            .find((entry) => entry.forwardPostimage?.length)
      : input.journal.steps.find((entry) => entry.id === input.action);
  if (!step || !step.forwardPostimage?.length)
    throw new Error(`missing transition step for ${input.action}`);
  if (
    step.progress?.some(
      (entry) =>
        entry.state === "forward-intent" || entry.state === "inverse-intent",
    )
  )
    throw new Error("transition has unresolved write intent; reconcile first");
  const plan = planProtectedTransition({
    action: input.action,
    journal: input.journal,
    expectedLiveDigest: input.expectedLiveDigest,
    stepId: input.stepId,
  });
  if (!isDeepStrictEqual(input.confirmation, plan.previewFingerprint))
    throw new Error(
      "confirmation fingerprint does not match live-state preview",
    );
  const expected = expectedProtectedTransitionDocuments({
    action: input.action,
    journal: input.journal,
    stepId: input.stepId,
  });
  if (digestProtectedDocuments(expected) !== input.expectedLiveDigest)
    throw new Error("expected live digest does not match transition preimage");
  if (
    input.action === "rollback" &&
    step.inverseAllowedOnlyFrom !==
      digestProtectedDocuments(step.forwardPostimage.map(sanitizedDocument))
  )
    throw new Error(
      "inverse condition does not match the recorded forward postimage",
    );
  for (const document of expected) {
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256)
      throw new Error(`compare-and-swap drift for ${document.resourceId}`);
  }
  const progress = ensureStepProgress(
    step,
    input.action === "rollback" ? "forward-verified" : "pending",
  );
  await input.persistJournal?.();
  if (input.action === "rollback") {
    if (!step.inverse?.length)
      throw new Error(`missing inverse for ${step.id}`);
    for (const inverse of step.inverse) {
      const forward = step.forwardPostimage.find(
        (entry) => entry.resourceId === inverse.resourcePath,
      );
      if (!forward)
        throw new Error(
          `inverse has no forward document: ${inverse.resourcePath}`,
        );
      const state = progress.find(
        (entry) => entry.resourceId === forward.resourceId,
      );
      if (!state) throw new Error(`missing progress for ${forward.resourceId}`);
      if (state.state === "pending" || state.state === "inverse-verified") {
        state.state = "inverse-verified";
        await input.persistJournal?.();
        continue;
      }
      const live = await observeDocument(input.api, forward);
      if (live.sha256 !== sanitizedDocument(forward).sha256)
        throw new Error(`compare-and-swap drift for ${forward.resourceId}`);
      const document = sanitizedDocument({
        ...forward,
        resourceId: inverse.resourcePath,
        canonicalBody: inverse.canonicalBody ?? {},
      });
      state.state = "inverse-intent";
      await input.persistJournal?.();
      await endpointFor(input.api, document).write({
        method: inverse.method,
        document,
      });
      state.state = "inverse-written";
      await input.persistJournal?.();
      const restored = await observeDocument(input.api, document);
      if (restored.sha256 !== document.sha256)
        throw new Error(
          `inverse postimage mismatch for ${document.resourceId}`,
        );
      state.state = "inverse-verified";
      await input.persistJournal?.();
    }
    return;
  }
  for (const forward of step.forwardPostimage) {
    const document = sanitizedDocument(forward);
    const state = progress.find(
      (entry) => entry.resourceId === document.resourceId,
    );
    if (!state) throw new Error(`missing progress for ${document.resourceId}`);
    if (state.state === "forward-verified") continue;
    if (state.state === "forward-written") {
      const live = await observeDocument(input.api, document);
      if (live.sha256 === document.sha256) {
        state.state = "forward-verified";
        await input.persistJournal?.();
        continue;
      }
      const before = step.preimage.find(
        (entry) => entry.resourceId === document.resourceId,
      );
      if (!before || live.sha256 !== sanitizedDocument(before).sha256)
        throw new Error(`compare-and-swap drift for ${document.resourceId}`);
    }
    state.state = "forward-intent";
    await input.persistJournal?.();
    await endpointFor(input.api, document).write({
      method: forwardMethod(document),
      document,
    });
    state.state = "forward-written";
    await input.persistJournal?.();
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256)
      throw new Error(`postimage mismatch for ${document.resourceId}`);
    state.state = "forward-verified";
    await input.persistJournal?.();
  }
}

function transitionStepFor(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly stepId?: string;
}) {
  return input.action === "rollback"
    ? input.stepId
      ? input.journal.steps.find((entry) => entry.id === input.stepId)
      : [...input.journal.steps]
          .reverse()
          .find((entry) => entry.forwardPostimage?.length)
    : input.journal.steps.find((entry) => entry.id === input.action);
}

function ensureStepProgress(
  step: ProtectedTransitionJournal["steps"][number],
  defaultState: "pending" | "forward-verified",
): Array<{
  resourceId: string;
  state:
    | "pending"
    | "forward-intent"
    | "forward-written"
    | "forward-verified"
    | "inverse-intent"
    | "inverse-written"
    | "inverse-verified";
}> {
  const mutable = step as unknown as {
    progress?: Array<{
      resourceId: string;
      state:
        | "pending"
        | "forward-intent"
        | "forward-written"
        | "forward-verified"
        | "inverse-intent"
        | "inverse-written"
        | "inverse-verified";
    }>;
  };
  mutable.progress ??= (step.forwardPostimage ?? []).map((entry) => ({
    resourceId: entry.resourceId,
    state: defaultState,
  }));
  return mutable.progress;
}

export async function reconcileProtectedTransitionJournal(input: {
  readonly journal: ProtectedTransitionJournal;
  readonly api: ProtectedControllerApi;
  readonly stepId: string;
  readonly persistJournal?: () => void | Promise<void>;
}): Promise<void> {
  const step = input.journal.steps.find((entry) => entry.id === input.stepId);
  if (!step?.forwardPostimage)
    throw new Error(`missing transition step for ${input.stepId}`);
  const progress = ensureStepProgress(step, "pending");
  for (const state of progress) {
    if (state.state !== "forward-intent" && state.state !== "inverse-intent")
      continue;
    const forward = step.forwardPostimage.find(
      (entry) => entry.resourceId === state.resourceId,
    );
    const before = step.preimage.find(
      (entry) => entry.resourceId === state.resourceId,
    );
    if (!forward || !before)
      throw new Error(`missing recovery documents for ${state.resourceId}`);
    const live = await observeDocument(input.api, forward);
    if (live.sha256 === sanitizedDocument(forward).sha256)
      state.state = "forward-verified";
    else if (live.sha256 === sanitizedDocument(before).sha256)
      state.state =
        state.state === "inverse-intent" ? "inverse-verified" : "pending";
    else throw new Error(`reconciliation drift for ${state.resourceId}`);
    await input.persistJournal?.();
  }
}

function expectedProtectedTransitionDocuments(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly stepId?: string;
}): readonly ProtectedExternalDocument[] {
  const step = transitionStepFor(input);
  if (!step?.forwardPostimage?.length)
    throw new Error(`missing transition step for ${input.action}`);
  const states = new Map(
    (step.progress ?? []).map((entry) => [entry.resourceId, entry.state]),
  );
  return step.forwardPostimage.map((forward) => {
    const state =
      states.get(forward.resourceId) ??
      (input.action === "rollback" ? "forward-verified" : "pending");
    const before = step.preimage.find(
      (entry) => entry.resourceId === forward.resourceId,
    );
    if (!before) throw new Error(`missing preimage for ${forward.resourceId}`);
    return state === "forward-written" || state === "forward-verified"
      ? sanitizedDocument(forward)
      : sanitizedDocument(before);
  });
}

export function expectedProtectedTransitionDigest(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly stepId?: string;
}): Sha256 {
  return digestProtectedDocuments(expectedProtectedTransitionDocuments(input));
}

export async function runProtectedTransition(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly expectedLiveDigest: Sha256;
  readonly confirmation?: string;
  readonly api?: ProtectedControllerApi;
  readonly journalPath?: string;
  readonly operatorIdentity?: string;
  readonly stepId?: string;
}): Promise<{
  readonly mode: "preview" | "applied";
  readonly previewFingerprint: `protected_transition_sha256:${string}`;
  readonly confirmationArgv: readonly string[];
}> {
  const plan = planProtectedTransition(input);
  if (!input.confirmation) return { mode: "preview", ...plan };
  if (Date.now() >= Date.parse(input.journal.expiresAt))
    throw new Error("protected transition operation expired");
  if (
    (input.operatorIdentity ?? input.journal.operatorIdentity) !==
    input.journal.operatorIdentity
  )
    throw new Error("protected transition operator identity mismatch");
  if (input.journal.consumedConfirmations.includes(input.confirmation))
    throw new Error(
      "protected transition confirmation was consumed; replay rejected",
    );
  if (!input.api)
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  const journalPath = input.journalPath;
  if (journalPath) saveProtectedTransitionJournal(journalPath, input.journal);
  await executeProtectedTransition({
    ...input,
    confirmation: input.confirmation,
    persistJournal: journalPath
      ? () => saveProtectedTransitionJournal(journalPath, input.journal)
      : undefined,
  });
  (
    input.journal as unknown as { consumedConfirmations: string[] }
  ).consumedConfirmations = [
    ...input.journal.consumedConfirmations,
    input.confirmation,
  ];
  if (journalPath) saveProtectedTransitionJournal(journalPath, input.journal);
  return { mode: "applied", ...plan };
}

function workflowDocuments(input: {
  readonly repository: string;
  readonly githubRulesetId: number;
}): readonly ProtectedExternalDocument[] {
  const resources: Array<readonly [ProtectedExternalDocument["kind"], string]> =
    [
      [
        "github-ruleset",
        `/repos/${input.repository}/rulesets/${input.githubRulesetId}`,
      ],
      ["woodpecker-repository", `/api/repos/${input.repository}`],
      ["woodpecker-producer", `/v1/repositories/${input.repository}/producer`],
      [
        "woodpecker-secret-reference",
        `/v1/repositories/${input.repository}/secret-references`,
      ],
    ];
  return resources.map(([kind, resourceId]) =>
    sanitizedDocument({
      kind,
      resourceId,
      canonicalBody: {},
      sha256: `sha256:${"0".repeat(64)}`,
    }),
  );
}

function workflowPostimage(
  documents: readonly ProtectedExternalDocument[],
  input: {
    readonly observation: ProtectedBootstrapObservation;
    readonly contexts: readonly string[];
  },
): readonly ProtectedExternalDocument[] {
  return documents.map((document) => {
    const body = { ...document.canonicalBody };
    if (document.kind === "github-ruleset") {
      const rules = body.rules as Array<Record<string, unknown>>;
      body.rules = [
        ...rules.filter((rule) => rule.type !== "required_status_checks"),
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: input.contexts.map((context) => ({
              context,
              integration_id: input.observation.appId,
            })),
            strict_required_status_checks_policy: true,
          },
        },
      ];
    }
    if (document.kind === "woodpecker-producer") {
      body.protected_contexts = input.contexts;
      body.controller_image_digest = input.observation.controllerImageDigest;
      body.protected_base_oid = input.observation.protectedBaseOid;
      body.github_app_id = input.observation.appId;
    }
    if (document.kind === "woodpecker-secret-reference") {
      body.references = (
        body.references as Array<{
          readonly name: string;
          readonly events: readonly string[];
        }>
      ).map((reference) => ({
        ...reference,
        events: reference.events.filter((event) => event !== "pull_request"),
      }));
    }
    return sanitizedDocument({ ...document, canonicalBody: body });
  });
}

function transitionStep(
  id: string,
  preimage: readonly ProtectedExternalDocument[],
  forwardPostimage: readonly ProtectedExternalDocument[],
): ProtectedTransitionJournal["steps"][number] {
  const changed = forwardPostimage.flatMap((forward) => {
    const before = preimage.find(
      (entry) => entry.resourceId === forward.resourceId,
    );
    return before && before.sha256 !== forward.sha256
      ? [{ before, forward }]
      : [];
  });
  const changedPreimage = changed.map(({ before }) => before);
  const changedPostimage = changed.map(({ forward }) => forward);
  return {
    id,
    preimage: changedPreimage,
    forwardPostimage: changedPostimage,
    inverse: changedPreimage.map((entry) => ({
      method: forwardMethod(entry),
      resourcePath: entry.resourceId,
      canonicalBody: entry.canonicalBody,
    })),
    inverseAllowedOnlyFrom: digestProtectedDocuments(changedPostimage),
    progress: changedPostimage.map((entry) => ({
      resourceId: entry.resourceId,
      state: "pending" as const,
    })),
  };
}

function assertProviderContract(
  repository: string,
  document: ProtectedExternalDocument,
): void {
  const body = document.canonicalBody;
  const valid = (() => {
    if (document.kind === "github-ruleset")
      return (
        typeof body.name === "string" &&
        typeof body.enforcement === "string" &&
        Array.isArray(body.rules)
      );
    if (document.kind === "woodpecker-repository")
      return (
        Number.isSafeInteger(body.id) &&
        body.full_name === repository &&
        typeof body.trusted === "boolean"
      );
    if (document.kind === "woodpecker-producer")
      return (
        body.schema_version === 1 &&
        body.repository === repository &&
        Array.isArray(body.protected_contexts)
      );
    return (
      body.schema_version === 1 &&
      body.repository === repository &&
      Array.isArray(body.references) &&
      body.references.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as Record<string, unknown>).name === "string" &&
          Array.isArray((entry as Record<string, unknown>).events) &&
          !("value" in (entry as Record<string, unknown>)),
      )
    );
  })();
  if (!valid)
    throw new Error(`provider contract rejected ${document.resourceId}`);
}

export async function buildProtectedWorkflowJournal(input: {
  readonly repository: string;
  readonly baseRef: "main";
  readonly protectedBaseOid: string;
  readonly controllerImageDigest: Sha256;
  readonly appId: number;
  readonly githubRulesetId: number;
  readonly temporaryContext: `ci/woodpecker/pr/${string}`;
  readonly operatorIdentity: string;
  readonly expiresAt: string;
  readonly operationNonce?: string;
  readonly api: ProtectedControllerApi;
}): Promise<ProtectedTransitionJournal> {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(input.repository))
    throw new Error("repository must be owner/name");
  if (
    !Number.isSafeInteger(input.githubRulesetId) ||
    input.githubRulesetId <= 0
  )
    throw new Error("githubRulesetId must be positive");
  const preimage = await Promise.all(
    workflowDocuments(input).map((entry) => observeDocument(input.api, entry)),
  );
  for (const document of preimage)
    assertProviderContract(input.repository, document);
  const github = preimage.find((entry) => entry.kind === "github-ruleset");
  const woodpecker = preimage.filter(
    (entry) => entry.kind !== "github-ruleset",
  );
  if (!github) throw new Error("GitHub ruleset observation is missing");
  const observation: ProtectedBootstrapObservation = {
    repository: input.repository,
    baseRef: input.baseRef,
    protectedBaseOid: input.protectedBaseOid,
    controllerImageDigest: input.controllerImageDigest,
    appId: input.appId,
    canonicalContext: "ci/woodpecker/pr/verify",
    temporaryContext: input.temporaryContext,
    woodpeckerConfigDigest: digestProtectedDocuments(woodpecker),
    githubRulesetDigest: github.sha256,
  };
  const temporary = workflowPostimage(preimage, {
    observation,
    contexts: [observation.temporaryContext],
  });
  const overlap = workflowPostimage(temporary, {
    observation,
    contexts: [observation.temporaryContext, observation.canonicalContext],
  });
  const canonical = workflowPostimage(overlap, {
    observation,
    contexts: [observation.canonicalContext],
  });
  return {
    schemaVersion: 1,
    operationNonce: input.operationNonce ?? randomUUID(),
    operatorIdentity: input.operatorIdentity,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    consumedConfirmations: [],
    observation,
    steps: [
      transitionStep("install-temporary", preimage, temporary),
      transitionStep("enable-canonical", temporary, overlap),
      transitionStep("remove-temporary", overlap, canonical),
    ],
  };
}

export async function verifyProtectedWorkflow(input: {
  readonly journal: ProtectedTransitionJournal;
  readonly stage: "temporary" | "canonical-overlap" | "canonical";
  readonly api: ProtectedControllerApi;
}): Promise<void> {
  const id = {
    temporary: "install-temporary",
    "canonical-overlap": "enable-canonical",
    canonical: "remove-temporary",
  }[input.stage];
  const expected = input.journal.steps.find(
    (entry) => entry.id === id,
  )?.forwardPostimage;
  if (!expected) throw new Error(`missing workflow stage ${input.stage}`);
  for (const document of expected) {
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256)
      throw new Error(
        `protected workflow verification drift for ${document.resourceId}`,
      );
  }
}

function redact(value: unknown): unknown {
  return sanitize(value);
}

function flag(flagName: string): string | undefined {
  const index = process.argv.indexOf(flagName);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function protectedControllerApi(): Promise<ProtectedControllerApi> {
  if (
    flag("--adapter-module") ||
    process.env.PROTECTED_BOOTSTRAP_ADAPTER_MODULE
  )
    throw new Error("protected operator does not load adapter modules");
  return createProtectedControllerHttpAdapter();
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (!action || action === "freeze") return;
  const journalPath = flag("--journal");
  if (!journalPath) throw new Error("--journal is required");
  if (action === "observe") {
    if (flag("--observation") || flag("--documents"))
      throw new Error(
        "observe accepts typed repository flags, not opaque documents",
      );
    const repository = flag("--repository");
    const baseRef = flag("--base-ref");
    const protectedBaseOid = flag("--base-oid");
    const controllerImageDigest = flag("--controller-image-digest") as
      Sha256 | undefined;
    const appId = Number(flag("--app-id"));
    const githubRulesetId = Number(flag("--github-ruleset-id"));
    const temporaryContext = flag("--temporary-context") as
      `ci/woodpecker/pr/${string}` | undefined;
    const operatorIdentity = flag("--operator");
    if (
      !repository ||
      baseRef !== "main" ||
      !protectedBaseOid ||
      !controllerImageDigest ||
      !Number.isSafeInteger(appId) ||
      !Number.isSafeInteger(githubRulesetId) ||
      !temporaryContext ||
      !operatorIdentity
    )
      throw new Error(
        "observe requires repository, main base, base OID, controller digest, App ID, ruleset ID, temporary context, and operator",
      );
    const journal = await buildProtectedWorkflowJournal({
      repository,
      baseRef,
      protectedBaseOid,
      controllerImageDigest,
      appId,
      githubRulesetId,
      temporaryContext,
      operatorIdentity,
      expiresAt:
        flag("--expires-at") ??
        new Date(Date.now() + 30 * 60_000).toISOString(),
      operationNonce: flag("--operation-nonce"),
      api: await protectedControllerApi(),
    });
    saveProtectedTransitionJournal(journalPath, journal);
    console.log(JSON.stringify(redact(journal), null, 2));
    return;
  }
  if (action === "verify") {
    const stage = flag("--stage") as
      "temporary" | "canonical-overlap" | "canonical" | undefined;
    if (!stage) throw new Error("verify requires --stage");
    await verifyProtectedWorkflow({
      journal: loadProtectedTransitionJournal(journalPath),
      stage,
      api: await protectedControllerApi(),
    });
    console.log(JSON.stringify({ verified: stage }));
    return;
  }
  const expectedLiveDigest = flag("--expected-live-digest") as
    Sha256 | undefined;
  if (!expectedLiveDigest)
    throw new Error("--expected-live-digest is required (compare-and-swap)");
  const result = await withProtectedJournalLock(journalPath, async () => {
    const journal = loadProtectedTransitionJournal(journalPath);
    if (flag("--operation-nonce") !== journal.operationNonce)
      throw new Error("operation nonce does not match journal");
    const rollbackStep = flag("--step");
    if (
      action === "rollback" &&
      (!rollbackStep ||
        !journal.steps.some((entry) => entry.id === rollbackStep))
    )
      throw new Error("rollback requires a known --step");
    const stepId = action === "rollback" ? rollbackStep : action;
    if (stepId === undefined) throw new Error("transition step is required");
    const hasIntent = journal.steps
      .find((entry) => entry.id === stepId)
      ?.progress?.some(
        (entry) =>
          entry.state === "forward-intent" || entry.state === "inverse-intent",
      );
    let api: ProtectedControllerApi | undefined;
    if (hasIntent) {
      api = await protectedControllerApi();
      await reconcileProtectedTransitionJournal({
        journal,
        api,
        stepId,
        persistJournal: () =>
          saveProtectedTransitionJournal(journalPath, journal),
      });
      const reconciledDigest = expectedProtectedTransitionDigest({
        action: action as Parameters<
          typeof planProtectedTransition
        >[0]["action"],
        journal,
        stepId: rollbackStep,
      });
      if (reconciledDigest !== expectedLiveDigest)
        throw new Error(
          `journal reconciled after uncertain write; rerun with --expected-live-digest ${reconciledDigest}`,
        );
    }
    return runProtectedTransition({
      action: action as Parameters<typeof planProtectedTransition>[0]["action"],
      journal,
      expectedLiveDigest,
      confirmation: flag("--confirm"),
      operatorIdentity: flag("--operator"),
      stepId: rollbackStep,
      api:
        api ?? (flag("--confirm") ? await protectedControllerApi() : undefined),
      journalPath,
    });
  });
  console.log(JSON.stringify(redact(result), null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
