import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
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
  readonly observation: ProtectedBootstrapObservation;
  readonly steps: readonly {
    readonly id: string;
    readonly preimage: readonly ProtectedExternalDocument[];
    readonly forwardPostimage?: readonly ProtectedExternalDocument[];
    readonly inverse?: readonly ProtectedInverseOperation[];
    readonly inverseAllowedOnlyFrom?: Sha256;
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
};

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
}): {
  readonly previewFingerprint: `protected_transition_sha256:${string}`;
  readonly confirmationArgv: readonly string[];
} {
  const errors = verifyProtectedBootstrap(input.journal.observation);
  if (errors.length) throw new Error(errors.join("; "));
  const fingerprint =
    `protected_transition_sha256:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}` as const;
  return {
    previewFingerprint: fingerprint,
    confirmationArgv: [
      input.action,
      "--expected-live-digest",
      input.expectedLiveDigest,
      "--confirm",
      fingerprint,
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

export function saveProtectedTransitionJournal(
  path: string,
  journal: ProtectedTransitionJournal,
): void {
  writeFileSync(
    path,
    `${JSON.stringify(redactJournal(journal), null, 2)}\n`,
    "utf8",
  );
}

export function loadProtectedTransitionJournal(
  path: string,
): ProtectedTransitionJournal {
  const journal = JSON.parse(
    readFileSync(path, "utf8"),
  ) as ProtectedTransitionJournal;
  if (journal.schemaVersion !== 1 || !Array.isArray(journal.steps))
    throw new Error("invalid protected transition journal");
  const errors = verifyProtectedBootstrap(journal.observation);
  if (errors.length) throw new Error(errors.join("; "));
  return redactJournal(journal);
}

function endpointFor(
  api: ProtectedControllerApi | undefined,
  document: ProtectedExternalDocument,
): ProtectedControllerEndpoint {
  if (!api)
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  return document.kind === "github-ruleset" ? api.github : api.woodpecker;
}

async function observeDocument(
  api: ProtectedControllerApi | undefined,
  document: ProtectedExternalDocument,
): Promise<ProtectedExternalDocument> {
  return sanitizedDocument(await endpointFor(api, document).observe(document));
}

/**
 * Reads all control-plane documents through the injected protected controller.
 * It deliberately persists only the sanitized canonical preimage.
 */
export async function observeProtectedBootstrap(input: {
  readonly observation: ProtectedBootstrapObservation;
  readonly documents: readonly ProtectedExternalDocument[];
  readonly api?: ProtectedControllerApi;
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
}): Promise<void> {
  const step =
    input.action === "rollback"
      ? [...input.journal.steps]
          .reverse()
          .find((entry) => entry.forwardPostimage?.length)
      : input.journal.steps.find((entry) => entry.id === input.action);
  if (!step || !step.forwardPostimage?.length)
    throw new Error(`missing transition step for ${input.action}`);
  const plan = planProtectedTransition({
    action: input.action,
    journal: input.journal,
    expectedLiveDigest: input.expectedLiveDigest,
  });
  if (!isDeepStrictEqual(input.confirmation, plan.previewFingerprint))
    throw new Error(
      "confirmation fingerprint does not match live-state preview",
    );
  const expected = (
    input.action === "rollback" ? step.forwardPostimage : step.preimage
  ).map(sanitizedDocument);
  if (digestProtectedDocuments(expected) !== input.expectedLiveDigest)
    throw new Error("expected live digest does not match transition preimage");
  if (
    input.action === "rollback" &&
    step.inverseAllowedOnlyFrom !== input.expectedLiveDigest
  )
    throw new Error(
      "inverse condition does not match the recorded forward postimage",
    );
  for (const document of expected) {
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256)
      throw new Error(`compare-and-swap drift for ${document.resourceId}`);
  }
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
      const document = sanitizedDocument({
        ...forward,
        resourceId: inverse.resourcePath,
        canonicalBody: inverse.canonicalBody ?? {},
      });
      await endpointFor(input.api, document).write({
        method: inverse.method,
        document,
      });
    }
    return;
  }
  for (const forward of step.forwardPostimage) {
    const document = sanitizedDocument(forward);
    await endpointFor(input.api, document).write({ method: "PUT", document });
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256)
      throw new Error(`postimage mismatch for ${document.resourceId}`);
  }
}

export async function runProtectedTransition(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly expectedLiveDigest: Sha256;
  readonly confirmation?: string;
  readonly api?: ProtectedControllerApi;
  readonly journalPath?: string;
}): Promise<{
  readonly mode: "preview" | "applied";
  readonly previewFingerprint: `protected_transition_sha256:${string}`;
  readonly confirmationArgv: readonly string[];
}> {
  const plan = planProtectedTransition(input);
  if (!input.confirmation) return { mode: "preview", ...plan };
  if (!input.api)
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  if (input.journalPath)
    saveProtectedTransitionJournal(input.journalPath, input.journal);
  await executeProtectedTransition({
    ...input,
    confirmation: input.confirmation,
  });
  if (input.journalPath)
    saveProtectedTransitionJournal(input.journalPath, input.journal);
  return { mode: "applied", ...plan };
}

function redact(value: unknown): unknown {
  return sanitize(value);
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (!action || action === "freeze") return;
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  const journalPath = value("--journal");
  if (!journalPath) throw new Error("--journal is required");
  if (action === "observe") {
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  }
  const journal = loadProtectedTransitionJournal(journalPath);
  const expectedLiveDigest = value("--expected-live-digest") as
    Sha256 | undefined;
  if (!expectedLiveDigest)
    throw new Error("--expected-live-digest is required (compare-and-swap)");
  const result = await runProtectedTransition({
    action: action as Parameters<typeof planProtectedTransition>[0]["action"],
    journal,
    expectedLiveDigest,
    confirmation: value("--confirm"),
    journalPath,
  });
  console.log(JSON.stringify(redact(result), null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
