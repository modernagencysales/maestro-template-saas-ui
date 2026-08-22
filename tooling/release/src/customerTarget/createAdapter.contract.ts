import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import type { CustomerReleaseManifest } from "./manifest.js";

export type CreateFailureCode =
  | "collision"
  | "dirty-source"
  | "release-unavailable"
  | "stale-preflight"
  | "unsafe-target";

export type CreateFailure = {
  readonly ok: false;
  readonly code: CreateFailureCode;
  readonly message: string;
};

export type CustomerReleaseAdapterFacts = {
  readonly version: string;
  readonly tag: string;
  readonly sourceCommit: string;
  readonly sourceChecksum: string;
  readonly cliCompatibility: string;
  readonly agentPackCompatibility: string;
  readonly ownershipManifest: string;
  readonly ownershipManifestChecksum: string;
  readonly extensionSeams: readonly string[];
};

export type CustomerReleaseAdapterOptions = {
  readonly repositoryRoot: string;
  readonly manifestPath: string;
  readonly ownershipManifestChecksum: string;
  readonly tag: string;
  readonly homeRoot: string;
  readonly temporaryRoot?: string;
  readonly sourceCommit?: string;
  readonly blueprintManifestPath: string;
  readonly blueprintManifestChecksum: string;
  readonly blueprintAuthorityManifestPath?: string;
  readonly blueprintAuthorityManifestChecksum?: string;
};

export type PrepareRequest = {
  readonly repo: {
    readonly workingDirectory: string;
    readonly sourceRoot: string;
  };
  readonly target: string;
  readonly templateInstance: (
    facts: CustomerReleaseAdapterFacts,
    blueprint: BlueprintTargetFacts,
  ) => string;
  readonly blueprintTargetPlan: () => BlueprintTargetPlan;
};

export type BlueprintTargetFacts = {
  readonly id: string;
  readonly digest: string;
  readonly provenance: string;
};

export type BlueprintTargetPlan = BlueprintTargetFacts & {
  readonly schemaVersion: 1;
  readonly registrations: readonly string[];
  readonly parameterizedEntries?: readonly string[];
  readonly entries: readonly ({
    readonly path: string;
    readonly sha256: string;
    readonly content: string;
    readonly replaces?: "copy" | "generate";
  } & (
    | {
        readonly ownership: "generated";
        readonly action: "generate";
        readonly upgrade: "regenerate";
      }
    | {
        readonly ownership: "customer-extension";
        readonly action: "copy";
        readonly upgrade: "preserve";
      }
  ))[];
};

const targetEntryIdentity = (
  entry: BlueprintTargetPlan["entries"][number],
) => ({
  path: entry.path,
  ownership: entry.ownership,
  action: entry.action,
  upgrade: entry.upgrade,
  sha256: entry.sha256,
  ...(entry.replaces === undefined ? {} : { replaces: entry.replaces }),
});

export const blueprintTargetPlanDigest = (value: BlueprintTargetPlan): string =>
  sha256(
    JSON.stringify({
      schemaVersion: value.schemaVersion,
      id: value.id,
      provenance: value.provenance,
      registrations: value.registrations,
      entries: value.entries.map(targetEntryIdentity),
    }),
  );

export function validateBlueprintTargetPlan(
  value: BlueprintTargetPlan,
): BlueprintTargetPlan {
  const paths = value.entries.map(({ path }) => path);
  if (
    value.schemaVersion !== 1 ||
    value.id.length === 0 ||
    value.provenance.length === 0 ||
    value.registrations.length === 0 ||
    new Set(paths).size !== paths.length ||
    value.registrations.some((path) => !paths.includes(path)) ||
    new Set(value.registrations).size !== value.registrations.length ||
    (value.parameterizedEntries !== undefined &&
      (!Array.isArray(value.parameterizedEntries) ||
        value.parameterizedEntries.some((path) => !paths.includes(path)) ||
        new Set(value.parameterizedEntries).size !==
          value.parameterizedEntries.length)) ||
    value.entries.some(
      (entry) =>
        !(
          (entry.ownership === "generated" &&
            entry.action === "generate" &&
            entry.upgrade === "regenerate") ||
          (entry.ownership === "customer-extension" &&
            entry.action === "copy" &&
            entry.upgrade === "preserve")
        ) ||
        (entry.replaces !== undefined &&
          entry.replaces !== "copy" &&
          entry.replaces !== "generate") ||
        entry.path === "template-instance.json" ||
        sha256(entry.content) !== entry.sha256,
    )
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint target plan is incomplete or contains drift.",
    );
  }
  if (blueprintTargetPlanDigest(value) !== value.digest) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint target plan digest does not match its exact operations.",
    );
  }
  return value;
}

export function assertReviewedBlueprintTargetPlan(
  options: CustomerReleaseAdapterOptions,
  plan: BlueprintTargetPlan,
): void {
  const authorityPath =
    options.blueprintAuthorityManifestPath ?? options.blueprintManifestPath;
  const authorityChecksum =
    options.blueprintAuthorityManifestChecksum ??
    options.blueprintManifestChecksum;
  if (
    (options.blueprintAuthorityManifestPath === undefined) !==
    (options.blueprintAuthorityManifestChecksum === undefined)
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint hardening authority is incomplete.",
    );
  }
  const bytes = readFileSync(authorityPath);
  if (sha256(bytes) !== authorityChecksum) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint authority manifest checksum is not reviewed.",
    );
  }
  const manifest = parseManifest(bytes);
  if (!isRecord(manifest) || !Array.isArray(manifest.entries)) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint ownership manifest is invalid.",
    );
  }
  const parameterizedEntries = Array.isArray(manifest.parameterizedEntries)
    ? manifest.parameterizedEntries
    : [];
  if (
    !parameterizedEntries.every((path) => typeof path === "string") ||
    new Set(parameterizedEntries).size !== parameterizedEntries.length
  ) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint parameterization authority is invalid.",
    );
  }
  const expectedEntries = manifest.entries;
  const actualEntries = plan.entries.map(targetEntryIdentity);
  const expected = JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    provenance: manifest.provenance,
    registrations: manifest.registrations,
  });
  const actual = JSON.stringify({
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
  });
  const parameterized = new Set(parameterizedEntries);
  const entriesMatch =
    actualEntries.length === expectedEntries.length &&
    actualEntries.every((entry, index) => {
      const reviewed = expectedEntries[index];
      if (!isRecord(reviewed) || reviewed.path !== entry.path) return false;
      if (!parameterized.has(entry.path))
        return JSON.stringify(entry) === JSON.stringify(reviewed);
      const actualShape = withoutSha256(entry);
      const reviewedShape = withoutSha256(reviewed);
      return JSON.stringify(actualShape) === JSON.stringify(reviewedShape);
    }) &&
    parameterizedEntries.every((path) =>
      expectedEntries.some((entry) => isRecord(entry) && entry.path === path),
    );
  if (actual !== expected || !entriesMatch) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Blueprint target plan is not owned by the reviewed release.",
    );
  }
}

export type PreparedRelease = {
  readonly ok: true;
  readonly token: object;
  readonly facts: CustomerReleaseAdapterFacts;
  readonly preview: {
    readonly preflightFingerprint: string;
    readonly writes: readonly {
      readonly path: string;
      readonly bytes: number;
    }[];
    readonly omissions: readonly string[];
    readonly collisions: readonly string[];
    readonly totalBytes: number;
  };
};

export type TokenState = {
  readonly request: PrepareRequest;
  readonly templateInstance: string;
  readonly blueprintDigest: string;
  readonly tagCommit: string;
};

export class CustomerReleaseAdapterError extends Error {
  readonly code: CreateFailureCode;

  constructor(code: CreateFailureCode, message: string) {
    super(message);
    this.name = "CustomerReleaseAdapterError";
    this.code = code;
  }
}

export const sha256 = (bytes: string | Buffer): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function readVerifiedManifest(
  options: CustomerReleaseAdapterOptions,
): Buffer {
  const bytes = readFileSync(options.manifestPath);
  if (sha256(bytes) !== options.ownershipManifestChecksum) {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Ownership manifest checksum does not match the reviewed release binding.",
    );
  }
  return bytes;
}

export function parseManifest(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new CustomerReleaseAdapterError(
      "release-unavailable",
      "Ownership manifest is not valid JSON.",
    );
  }
}

export function rawExpectedHashes(
  value: unknown,
): Readonly<Record<string, string>> {
  if (!isRecord(value) || !isRecord(value.expectedHashes)) return {};
  return Object.fromEntries(
    Object.entries(value.expectedHashes).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function releaseFacts(
  options: CustomerReleaseAdapterOptions,
  manifest: CustomerReleaseManifest,
): CustomerReleaseAdapterFacts {
  const manifestPath = relative(options.repositoryRoot, options.manifestPath);
  return {
    version: manifest.release.version,
    tag: manifest.release.tag,
    sourceCommit: manifest.release.sourceCommit,
    sourceChecksum: manifest.release.sourceChecksum,
    cliCompatibility: manifest.compatibility.cli,
    agentPackCompatibility: manifest.compatibility.agentPack,
    ownershipManifest:
      manifestPath === "" ||
      manifestPath === ".." ||
      manifestPath.startsWith(`..${sep}`)
        ? options.manifestPath
        : manifestPath.split(sep).join("/"),
    ownershipManifestChecksum: options.ownershipManifestChecksum,
    extensionSeams: manifest.extensionSeams.map(({ path }) => path),
  };
}

export function failure(error: unknown): CreateFailure {
  if (error instanceof CustomerReleaseAdapterError) {
    return { ok: false, code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : "unknown failure";
  if (/collision|non-empty|Target contains/i.test(message)) {
    return { ok: false, code: "collision", message };
  }
  if (/target|root|symbolic|path escape/i.test(message)) {
    return { ok: false, code: "unsafe-target", message };
  }
  if (/preflight|hash mismatch|changed/i.test(message)) {
    return { ok: false, code: "stale-preflight", message };
  }
  return {
    ok: false,
    code: "release-unavailable",
    message: "Immutable customer release verification failed.",
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withoutSha256(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "sha256"),
  );
}

export function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object";
}
