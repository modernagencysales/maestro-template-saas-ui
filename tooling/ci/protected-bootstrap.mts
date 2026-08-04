import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      /token|secret|password|credential/iu.test(key) &&
      !/reference|name|id/iu.test(key)
        ? [key, "[REDACTED]"]
        : [key, redact(entry)],
    ]),
  );
}

function main(): void {
  const action = process.argv[2];
  if (!action || action === "freeze") return;
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  const journalPath = value("--journal");
  if (!journalPath) throw new Error("--journal is required");
  if (action === "observe") {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          repository: value("--repository"),
          baseRef: value("--base-ref"),
          protectedBaseOid: value("--base-oid"),
          journal: journalPath,
        },
        null,
        2,
      ),
    );
    return;
  }
  const journal = JSON.parse(
    readFileSync(journalPath, "utf8"),
  ) as ProtectedTransitionJournal;
  const expectedLiveDigest = value("--expected-live-digest") as
    Sha256 | undefined;
  if (!expectedLiveDigest)
    throw new Error("--expected-live-digest is required (compare-and-swap)");
  const plan = planProtectedTransition({
    action: action as Parameters<typeof planProtectedTransition>[0]["action"],
    journal,
    expectedLiveDigest,
  });
  const confirmation = value("--confirm");
  if (!confirmation) {
    console.log(JSON.stringify(redact({ mode: "preview", ...plan }), null, 2));
    return;
  }
  if (!isDeepStrictEqual(confirmation, plan.previewFingerprint))
    throw new Error(
      "confirmation fingerprint does not match live-state preview",
    );
  throw new Error(
    "external write adapter is intentionally unavailable in candidate source; run from the protected controller",
  );
}

main();
