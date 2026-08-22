import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

export type ProtectedControllerAdapterFactory = () =>
  ProtectedControllerApi | Promise<ProtectedControllerApi>;

function httpEndpoint(input: {
  readonly baseUrl: string;
  readonly token: string;
}): ProtectedControllerEndpoint {
  const base = new URL(input.baseUrl);
  if (base.protocol !== "https:")
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
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(document.canonicalBody),
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
  if (!githubToken || !woodpeckerToken)
    throw new Error("protected controller credentials are unavailable");
  return {
    github: httpEndpoint({
      baseUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
      token: githubToken,
    }),
    woodpecker: httpEndpoint({
      baseUrl: process.env.WOODPECKER_SERVER ?? "https://ci.maestrogtm.com",
      token: woodpeckerToken,
    }),
  };
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
      }),
    )
    .digest("hex")}` as const;
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
      const live = await observeDocument(input.api, forward);
      if (live.sha256 !== sanitizedDocument(forward).sha256)
        throw new Error(`compare-and-swap drift for ${forward.resourceId}`);
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
  const written: ProtectedExternalDocument[] = [];
  for (const forward of step.forwardPostimage) {
    const document = sanitizedDocument(forward);
    await endpointFor(input.api, document).write({ method: "PUT", document });
    written.push(document);
    const live = await observeDocument(input.api, document);
    if (live.sha256 !== document.sha256) {
      for (const entry of written.reverse()) {
        const live = await observeDocument(input.api, entry);
        if (live.sha256 !== entry.sha256) continue;
        const inverse = step.inverse?.find(
          (candidate) => candidate.resourcePath === entry.resourceId,
        );
        if (!inverse) continue;
        await endpointFor(input.api, entry).write({
          method: inverse.method,
          document: sanitizedDocument({
            ...entry,
            resourceId: inverse.resourcePath,
            canonicalBody: inverse.canonicalBody ?? {},
          }),
        });
      }
      throw new Error(`postimage mismatch for ${document.resourceId}`);
    }
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

function flag(flagName: string): string | undefined {
  const index = process.argv.indexOf(flagName);
  return index === -1 ? undefined : process.argv[index + 1];
}

function jsonFlag<Value>(flagName: string): Value {
  const value = flag(flagName);
  if (!value) throw new Error(`${flagName} is required`);
  return JSON.parse(value) as Value;
}

async function protectedControllerApi(): Promise<ProtectedControllerApi> {
  const adapterModule =
    flag("--adapter-module") ?? process.env.PROTECTED_BOOTSTRAP_ADAPTER_MODULE;
  if (!adapterModule && process.env.PROTECTED_CONTROLLER_HTTP === "1")
    return createProtectedControllerHttpAdapter();
  if (!adapterModule)
    throw new Error(
      "protected controller adapter is required; candidate mode cannot access external writes",
    );
  const moduleUrl = adapterModule.startsWith("file:")
    ? adapterModule
    : pathToFileURL(resolve(adapterModule)).href;
  const loaded = (await import(moduleUrl)) as {
    readonly createProtectedControllerAdapter?: ProtectedControllerAdapterFactory;
  };
  if (typeof loaded.createProtectedControllerAdapter !== "function")
    throw new Error(
      "protected controller adapter must export createProtectedControllerAdapter",
    );
  return loaded.createProtectedControllerAdapter();
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (!action || action === "freeze") return;
  const journalPath = flag("--journal");
  if (!journalPath) throw new Error("--journal is required");
  if (action === "observe") {
    const journal = await observeProtectedBootstrap({
      observation: jsonFlag<ProtectedBootstrapObservation>("--observation"),
      documents: jsonFlag<readonly ProtectedExternalDocument[]>("--documents"),
      api: await protectedControllerApi(),
    });
    saveProtectedTransitionJournal(journalPath, journal);
    console.log(JSON.stringify(redact(journal), null, 2));
    return;
  }
  const journal = loadProtectedTransitionJournal(journalPath);
  const expectedLiveDigest = flag("--expected-live-digest") as
    Sha256 | undefined;
  if (!expectedLiveDigest)
    throw new Error("--expected-live-digest is required (compare-and-swap)");
  const result = await runProtectedTransition({
    action: action as Parameters<typeof planProtectedTransition>[0]["action"],
    journal,
    expectedLiveDigest,
    confirmation: flag("--confirm"),
    api: flag("--confirm") ? await protectedControllerApi() : undefined,
    journalPath,
  });
  console.log(JSON.stringify(redact(result), null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
