import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SHA256 = /^[a-f0-9]{64}$/u;
const ABSOLUTE_PATH = /(?:^|[\s":])\/(?!\/)[^\s"`]+/u;
const ANSI_ESCAPE = new RegExp(
  `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
  "gu",
);

export type GoldenServerErrorEvent = Readonly<{
  schemaVersion: 1;
  authority: GoldenAuthority;
  sequence: number;
  stream: "stdout" | "stderr";
  marker: "renderToReadableStream" | "uncaught-error" | "process-error";
  message: string;
}>;

type ServerOutputStream = "stdout" | "stderr";

const serverErrorEventPath = (input: {
  evidenceRoot: string;
  authority: GoldenAuthority;
}) => join(input.evidenceRoot, `server-errors-${input.authority}.jsonl`);

function serverErrorMarker(
  value: string,
): GoldenServerErrorEvent["marker"] | undefined {
  if (/^\s*(?:warning|warn|deprecationwarning)\b/iu.test(value))
    return undefined;
  if (/Error in renderToReadableStream/iu.test(value))
    return "renderToReadableStream";
  if (/\buncaught\b[^\n]*(?:ReferenceError|TypeError|Error)\b/iu.test(value))
    return "uncaught-error";
  return undefined;
}

function redactServerErrorMessage(value: string): string {
  return value
    .replace(ANSI_ESCAPE, "")
    .replace(/(?:https?|file):\/\/[^\s"']+/giu, "[url]")
    .replace(ABSOLUTE_PATH, "$1[path]")
    .replace(/\{[^\n]*\}/gu, "[payload]")
    .replace(/\b(?:body|data|payload)=\S+/giu, "[payload]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 240);
}

export function readGoldenServerErrorEvents(input: {
  evidenceRoot: string;
  authority: GoldenAuthority;
}): readonly GoldenServerErrorEvent[] {
  const path = serverErrorEventPath(input);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) =>
      parseGoldenServerErrorEvent(line, index, input.authority),
    );
}

function parseGoldenServerErrorEvent(
  line: string,
  index: number,
  authority: GoldenAuthority,
): GoldenServerErrorEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error(`Invalid golden server error event at line ${index + 1}`);
  }
  if (!isGoldenServerErrorEvent(value, authority))
    throw new Error(`Invalid golden server error event at line ${index + 1}`);
  return value;
}

function isGoldenServerErrorEvent(
  value: unknown,
  authority: GoldenAuthority,
): value is GoldenServerErrorEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<GoldenServerErrorEvent>;
  return (
    event.schemaVersion === 1 &&
    event.authority === authority &&
    typeof event.sequence === "number" &&
    isServerOutputStream(event.stream) &&
    isServerErrorMarker(event.marker) &&
    typeof event.message === "string"
  );
}

function isServerOutputStream(value: unknown): value is ServerOutputStream {
  return value === "stdout" || value === "stderr";
}

function isServerErrorMarker(
  value: unknown,
): value is GoldenServerErrorEvent["marker"] {
  return (
    value === "renderToReadableStream" ||
    value === "uncaught-error" ||
    value === "process-error"
  );
}

export function createGoldenServerErrorRecorder(input: {
  evidenceRoot: string;
  authority: GoldenAuthority;
}) {
  mkdirSync(input.evidenceRoot, { recursive: true });
  const path = serverErrorEventPath(input);
  appendFileSync(path, "", "utf8");
  let sequence = readGoldenServerErrorEvents(input).reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  );
  const pending = new Map<ServerOutputStream, string>([
    ["stdout", ""],
    ["stderr", ""],
  ]);

  const recordLine = (stream: ServerOutputStream, line: string) => {
    const marker = serverErrorMarker(line);
    if (marker === undefined) return;
    sequence += 1;
    const event: GoldenServerErrorEvent = {
      schemaVersion: 1,
      authority: input.authority,
      sequence,
      stream,
      marker,
      message: redactServerErrorMessage(line),
    };
    appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
  };

  return {
    baseline: () => sequence,
    recordChunk(stream: ServerOutputStream, chunk: string | Uint8Array) {
      const lines =
        `${pending.get(stream) ?? ""}${typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")}`.split(
          "\n",
        );
      pending.set(stream, lines.pop() ?? "");
      for (const line of lines) recordLine(stream, line);
    },
    recordProcessError(message: string) {
      sequence += 1;
      const event: GoldenServerErrorEvent = {
        schemaVersion: 1,
        authority: input.authority,
        sequence,
        stream: "stderr",
        marker: "process-error",
        message: redactServerErrorMessage(message),
      };
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
    },
    close() {
      for (const stream of ["stdout", "stderr"] as const) {
        const remainder = pending.get(stream) ?? "";
        if (remainder.length > 0) recordLine(stream, remainder);
        pending.set(stream, "");
      }
    },
  };
}

export function baselineGoldenServerErrors(input: {
  evidenceRoot: string;
  authority: GoldenAuthority;
}): number {
  return readGoldenServerErrorEvents(input).reduce(
    (highest, event) => Math.max(highest, event.sequence),
    0,
  );
}

export function assertNoNewGoldenServerErrors(input: {
  evidenceRoot: string;
  authority: GoldenAuthority;
  baseline: number;
}): void {
  const events = readGoldenServerErrorEvents(input).filter(
    (event) => event.sequence > input.baseline,
  );
  if (events.length > 0) {
    throw new Error(
      `${input.authority} server runtime errors: ${events
        .map((event) => `${event.marker}: ${event.message}`)
        .join("; ")}`,
    );
  }
}

export type GoldenAuthority = "reference" | "generated";

export type GoldenAuthorityMetadata = Readonly<{
  schemaVersion: 1;
  authority: GoldenAuthority;
  root: "factory-reference" | "materialized-generated-target";
  digest: string;
  provenance:
    | Readonly<{
        repository: "starter";
        commit: string;
        path: "apps/web";
        contentDigest: string;
        sourceContentDigest: string;
        receiptPath: "docs/template/saas-ui-starter-files.json";
        receiptDigest: string;
        mappedFileCount: number;
        adaptedFileCount: number;
      }>
    | Readonly<{
        repository: "generated-target";
        source: "buildSaasApplicationTargetPlan";
        contentDigest: string;
      }>;
}>;

function assertDigest(value: string, label: string): void {
  if (!SHA256.test(value)) throw new Error(`${label} must be a SHA-256 digest`);
}

export function createReferenceAuthorityMetadata(input: {
  starterPin: string;
  starterContentDigest: string;
  servedContentDigest: string;
  receiptDigest: string;
  receiptPath: "docs/template/saas-ui-starter-files.json";
  mappedFileCount: number;
  adaptedFileCount: number;
}): GoldenAuthorityMetadata {
  assertDigest(input.starterContentDigest, "starterContentDigest");
  assertDigest(input.servedContentDigest, "servedContentDigest");
  assertDigest(input.receiptDigest, "receiptDigest");
  if (input.mappedFileCount <= 0)
    throw new Error("mappedFileCount must be positive");
  if (
    input.adaptedFileCount < 0 ||
    input.adaptedFileCount > input.mappedFileCount
  )
    throw new Error("adaptedFileCount must be within mappedFileCount");
  return {
    schemaVersion: 1,
    authority: "reference",
    root: "factory-reference",
    digest: input.servedContentDigest,
    provenance: {
      repository: "starter",
      commit: input.starterPin,
      path: "apps/web",
      contentDigest: input.servedContentDigest,
      sourceContentDigest: input.starterContentDigest,
      receiptPath: input.receiptPath,
      receiptDigest: input.receiptDigest,
      mappedFileCount: input.mappedFileCount,
      adaptedFileCount: input.adaptedFileCount,
    },
  };
}

export function proveReferenceServedFiles(input: {
  starterPin: string;
  starterContentDigest: string;
  receiptDigest: string;
  receiptPath: "docs/template/saas-ui-starter-files.json";
  files: readonly Readonly<{
    destination: string;
    content: Uint8Array;
    sourceSha256: string;
    sha256: string;
    adapted: boolean;
  }>[];
}): GoldenAuthorityMetadata {
  const files = [...input.files].sort((left, right) =>
    left.destination.localeCompare(right.destination, "en"),
  );
  if (files.length === 0)
    throw new Error("Reference served file receipt has no files");
  const destinations = new Set<string>();
  let adaptedFileCount = 0;
  const hash = createHash("sha256");
  for (const file of files) {
    if (destinations.has(file.destination))
      throw new Error(`Duplicate reference served file: ${file.destination}`);
    destinations.add(file.destination);
    assertDigest(file.sourceSha256, `sourceSha256 for ${file.destination}`);
    assertDigest(file.sha256, `sha256 for ${file.destination}`);
    const actual = createHash("sha256").update(file.content).digest("hex");
    if (actual !== file.sha256)
      throw new Error(
        `Reference served file hash mismatch: ${file.destination}`,
      );
    if (file.adapted) adaptedFileCount += 1;
    hash.update(file.destination);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return createReferenceAuthorityMetadata({
    starterPin: input.starterPin,
    starterContentDigest: input.starterContentDigest,
    servedContentDigest: hash.digest("hex"),
    receiptDigest: input.receiptDigest,
    receiptPath: input.receiptPath,
    mappedFileCount: files.length,
    adaptedFileCount,
  });
}

export function createGeneratedAuthorityMetadata(input: {
  generatedDigest: string;
}): GoldenAuthorityMetadata {
  assertDigest(input.generatedDigest, "generatedDigest");
  return {
    schemaVersion: 1,
    authority: "generated",
    root: "materialized-generated-target",
    digest: input.generatedDigest,
    provenance: {
      repository: "generated-target",
      source: "buildSaasApplicationTargetPlan",
      contentDigest: input.generatedDigest,
    },
  };
}

export function assertDistinctAuthorities(
  reference: GoldenAuthorityMetadata,
  generated: GoldenAuthorityMetadata,
): void {
  if (
    reference.authority !== "reference" ||
    generated.authority !== "generated" ||
    reference.root === generated.root ||
    reference.digest === generated.digest
  ) {
    throw new Error(
      "Generated golden authority must have a distinct root and digest",
    );
  }
}

export function serializeAuthorityMetadata(
  metadata: GoldenAuthorityMetadata,
): string {
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`;
  if (ABSOLUTE_PATH.test(serialized))
    throw new Error(
      "Authority metadata must not contain host or temporary paths",
    );
  return serialized;
}
