import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { BlueprintTargetPlan } from "./saasApplication";

export type Alpha2ArtifactIntegrity = Readonly<{
  encodedBytes: number;
  encodedSha256: `sha256:${string}`;
  compressedBytes: number;
  compressedSha256: `sha256:${string}`;
  canonicalBytes: number;
  canonicalSha256: `sha256:${string}`;
}>;

type Alpha2TargetPlanOptions = Readonly<{
  name: string;
  firstOutcome?: string;
}>;

type JsonRecord = Record<string, unknown>;

const FROZEN_ENTRY_COUNT = 277;
const FROZEN_AUTHORITY_SHA256 =
  "sha256:52e8bb06ff821baf8980b67279e69089d028d19c55c365518d4410b5778849d9";
const FROZEN_SOURCE_COMMIT = "3aefd456354b344b9595bddc44fc0782240e2b7d";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const STRICT_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const ALPHA2_ARTIFACT_INTEGRITY = Object.freeze({
  encodedBytes: 728_988,
  encodedSha256:
    "sha256:bf002cfc239a3aaec9a88ef6d1bcf640346c618a009b4a170c7a4938041b3a14",
  compressedBytes: 542_223,
  compressedSha256:
    "sha256:6d45ac2622e26f4200c52d5ad0d51d2e0c7b08e5a88ab69621a68c711825ee80",
  canonicalBytes: 2_489_464,
  canonicalSha256:
    "sha256:433f435c63385db02bdcc1b5e7e6b74cdfe49b45916eff4f64b168804dffeaf9",
}) satisfies Alpha2ArtifactIntegrity;

export const ALPHA2_ARTIFACT_FILE_INTEGRITY = Object.freeze({
  bytes: 728_989,
  sha256:
    "sha256:aba253540af7233c6b175a5a8b46b173273c335ddc742a8e920347057aa75377",
} as const);

const PARAMETERIZED_PATHS = Object.freeze([
  "examples/saas-application/seed/crud-scenario.json",
  "examples/saas-application/seed/records.json",
  "examples/saas-application/seed/workspace.json",
  "generated/blueprints/saas-application/application-contract.json",
] as const);

const CANONICAL_WORKSPACE = {
  id: "workspace_saas_application",
  slug: "saas-application",
  name: "SaaS Application Workspace",
  memberRole: "owner",
  synthetic: true,
};
const CANONICAL_RECORDS = [
  {
    id: "record_welcome",
    workspaceId: "workspace_saas_application",
    title: "Welcome record",
    detail: "A deterministic fake record that can be renamed or deleted.",
    synthetic: true,
  },
];
const CANONICAL_CRUD_SCENARIO = {
  workspaceId: "workspace_saas_application",
  initial: { records: [] },
  create: {
    title: "First record",
    detail: "Created in fake mode without provider setup.",
  },
  read: { by: "created-id", expectedTitle: "First record" },
};
const CANONICAL_APPLICATION_CONTRACT = {
  schemaVersion: 1,
  blueprint: "saas-application",
  entity: {
    singular: "record",
    renameable: true,
    tenantKey: "workspaceId",
  },
  primitive: "table-route-crud",
  workflowRequired: false,
  personalization: {
    name: "SaaS Application",
    firstOutcome: "Create and review records",
  },
  operations: [
    { id: "records.list", kind: "query", workspaceScoped: true },
    { id: "records.read", kind: "query", workspaceScoped: true },
    { id: "records.create", kind: "mutation", workspaceScoped: true },
  ],
  uiStates: ["loading", "empty", "error", "list", "detail", "create"],
  layers: {
    table: "packages/convex/confect/tables/records.ts",
    functions: "packages/convex/confect/records.{spec,impl}.ts",
    adapter: "apps/web/src/adapters/records.ts",
    feature: "apps/web/src/features/records/*",
    screen: "apps/web/src/screens/records-screen.tsx",
    route: "apps/web/src/routes/_workspace.records.tsx",
  },
  governedOperation: {
    generated: false,
    rule: "Use a capability only when an operation requires policy, approval, audit, or another governed boundary.",
  },
};

const canonicalOptions = Object.freeze({
  name: "SaaS Application",
  firstOutcome: "Create and review records",
});

const sha256 = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const fail = (message: string): never => {
  throw new Error(`Invalid frozen alpha.2 SaaS plan: ${message}`);
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): JsonRecord =>
  isRecord(value) ? value : fail(`${label} must be an object`);

const requireString = (value: unknown, label: string): string =>
  typeof value === "string" ? value : fail(`${label} must be a string`);

const requireStringArray = (
  value: unknown,
  label: string,
): readonly string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    fail(`${label} must be an array of strings`);
  return value as readonly string[];
};

const requireArray = (value: unknown, label: string): readonly unknown[] =>
  Array.isArray(value) ? value : fail(`${label} must be an array`);

const assertExactKeys = (
  value: JsonRecord,
  expected: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted))
    fail(`${label} fields do not match the frozen schema`);
};

const assertSafeUniquePaths = (
  paths: readonly string[],
  label: string,
): void => {
  const seen = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/");
    if (
      path.length === 0 ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\0") ||
      /^[A-Za-z]:/.test(path) ||
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    )
      fail(`${label} contains unsafe path ${JSON.stringify(path)}`);
    if (seen.has(path)) fail(`${label} contains duplicate path ${path}`);
    seen.add(path);
  }
};

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

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

const planIdentity = (plan: BlueprintTargetPlan) => ({
  schemaVersion: plan.schemaVersion,
  id: plan.id,
  provenance: plan.provenance,
  registrations: plan.registrations,
  entries: plan.entries.map(targetEntryIdentity),
});

const parseEntry = (
  value: unknown,
  index: number,
): BlueprintTargetPlan["entries"][number] => {
  const record = requireRecord(value, `entries[${index}]`);
  const hasReplaces = Object.hasOwn(record, "replaces");
  assertExactKeys(
    record,
    [
      "path",
      "ownership",
      "action",
      "upgrade",
      "sha256",
      "content",
      ...(hasReplaces ? ["replaces"] : []),
    ],
    `entries[${index}]`,
  );
  const path = requireString(record.path, `entries[${index}].path`);
  const sha = requireString(record.sha256, `entries[${index}].sha256`);
  const content = requireString(record.content, `entries[${index}].content`);
  if (!SHA256_PATTERN.test(sha)) fail(`entries[${index}].sha256 is malformed`);
  if (sha256(content) !== sha) fail(`body SHA-256 mismatch for ${path}`);
  const ownership = record.ownership;
  const action = record.action;
  const upgrade = record.upgrade;
  if (!(
    (ownership === "generated" &&
      action === "generate" &&
      upgrade === "regenerate") ||
    (ownership === "customer-extension" &&
      action === "copy" &&
      upgrade === "preserve")
  ))
    fail(`entries[${index}] has an invalid ownership/action/upgrade tuple`);
  const replaces = record.replaces;
  if (replaces !== undefined && replaces !== "copy" && replaces !== "generate")
    fail(`entries[${index}].replaces is invalid`);
  return {
    path,
    content,
    sha256: sha,
    ownership,
    action,
    upgrade,
    ...(replaces === undefined ? {} : { replaces }),
  } as BlueprintTargetPlan["entries"][number];
};

const parsePlan = (value: unknown): BlueprintTargetPlan => {
  const record = requireRecord(value, "plan");
  assertExactKeys(
    record,
    [
      "schemaVersion",
      "id",
      "provenance",
      "registrations",
      "parameterizedEntries",
      "entries",
      "digest",
    ],
    "plan",
  );
  if (record.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (record.id !== "saas-application") fail("id must be saas-application");
  if (record.provenance !== "@maestro-template/generators/saas-application@1")
    fail("provenance does not match alpha.2");
  const registrations = requireStringArray(
    record.registrations,
    "registrations",
  );
  const parameterizedEntries = requireStringArray(
    record.parameterizedEntries,
    "parameterizedEntries",
  );
  const rawEntries = requireArray(record.entries, "entries");
  const entries = rawEntries.map(parseEntry);
  const digest = requireString(record.digest, "digest");
  if (!SHA256_PATTERN.test(digest)) fail("plan digest is malformed");
  assertSafeUniquePaths(
    entries.map(({ path }) => path),
    "entries",
  );
  assertSafeUniquePaths(registrations, "registrations");
  assertSafeUniquePaths(parameterizedEntries, "parameterizedEntries");
  if (entries.length !== FROZEN_ENTRY_COUNT)
    fail(`entry count must be exactly ${FROZEN_ENTRY_COUNT}`);
  if (!same(parameterizedEntries, PARAMETERIZED_PATHS))
    fail("parameterized entry set or order differs from F037");
  const entryPaths = new Set(entries.map(({ path }) => path));
  for (const path of [...registrations, ...parameterizedEntries])
    if (!entryPaths.has(path))
      fail(`registered path is missing from entries: ${path}`);
  const plan = {
    schemaVersion: 1,
    id: "saas-application",
    provenance: "@maestro-template/generators/saas-application@1",
    registrations,
    parameterizedEntries,
    entries,
    digest,
  } satisfies BlueprintTargetPlan;
  if (sha256(JSON.stringify(planIdentity(plan))) !== digest)
    fail("plan digest does not match recomputed identity");
  return plan;
};

const validateAuthority = (
  plan: BlueprintTargetPlan,
  authorityValue: unknown,
): void => {
  const reviewed = requireRecord(authorityValue, "F037 authority");
  const projectionSource = requireRecord(
    reviewed.projectionSource,
    "F037 projectionSource",
  );
  if (projectionSource.sourceCommit !== FROZEN_SOURCE_COMMIT)
    fail("F037 authority source commit does not match alpha.2");
  if (reviewed.schemaVersion !== 1 || reviewed.id !== "saas-application")
    fail("F037 authority identity does not match alpha.2");
  if (reviewed.provenance !== plan.provenance)
    fail("F037 authority provenance does not match alpha.2");
  const registrations = requireStringArray(
    reviewed.registrations,
    "F037 registrations",
  );
  const parameterizedEntries = requireStringArray(
    reviewed.parameterizedEntries,
    "F037 parameterizedEntries",
  );
  const reviewedEntries = requireArray(reviewed.entries, "F037 entries");
  if (reviewedEntries.length !== FROZEN_ENTRY_COUNT)
    fail(`F037 entry count must be exactly ${FROZEN_ENTRY_COUNT}`);
  if (!same(registrations, plan.registrations))
    fail("registrations differ from F037 authority");
  if (!same(parameterizedEntries, PARAMETERIZED_PATHS))
    fail("F037 parameterized entry set or order is invalid");
  if (!same(parameterizedEntries, plan.parameterizedEntries))
    fail("parameterized entries differ from F037 authority");
  for (let index = 0; index < reviewedEntries.length; index += 1) {
    const entry =
      plan.entries[index] ?? fail(`entry is missing at index ${index}`);
    if (!same(reviewedEntries[index], targetEntryIdentity(entry)))
      fail(
        `entry identity or order differs from F037 authority at index ${index}`,
      );
  }
};

export function validateAlpha2SaasApplicationPlan(
  planValue: unknown,
  authority: unknown,
): BlueprintTargetPlan {
  const plan = parsePlan(planValue);
  validateAuthority(plan, authority);
  return plan;
}

const assertActualIntegrity = (
  label: string,
  bytes: number,
  digest: string,
  expectedBytes: number,
  expectedDigest: string,
): void => {
  if (bytes !== expectedBytes) fail(`${label} byte length mismatch`);
  if (digest !== expectedDigest) fail(`${label} SHA-256 mismatch`);
};

export function decodeAlpha2SaasApplicationArtifact(
  input: Readonly<{
    encodedArtifact: string;
    authority: unknown;
    integrity: Alpha2ArtifactIntegrity;
  }>,
): BlueprintTargetPlan {
  const { encodedArtifact, authority, integrity } = input;
  const encodedBytes = Buffer.byteLength(encodedArtifact);
  if (encodedBytes > ALPHA2_ARTIFACT_INTEGRITY.encodedBytes)
    fail("encoded artifact exceeds the strict decode limit");
  const encodedLines = encodedArtifact.split("\n");
  if (
    encodedLines.length > 1 &&
    encodedLines.some(
      (line, index) =>
        line.length === 0 ||
        line.length > 120 ||
        (index < encodedLines.length - 1 && line.length !== 120),
    )
  )
    fail("encoded artifact has non-canonical base64 line wrapping");
  const compactBase64 = encodedLines.join("");
  if (
    compactBase64.length === 0 ||
    compactBase64.length % 4 !== 0 ||
    !STRICT_BASE64_PATTERN.test(compactBase64)
  )
    fail("encoded artifact is not strict base64");
  assertActualIntegrity(
    "encoded artifact",
    encodedBytes,
    sha256(encodedArtifact),
    integrity.encodedBytes,
    integrity.encodedSha256,
  );
  const compressed = Buffer.from(compactBase64, "base64");
  if (compressed.toString("base64") !== compactBase64)
    fail("encoded artifact is not canonical base64");
  if (compressed.byteLength > ALPHA2_ARTIFACT_INTEGRITY.compressedBytes)
    fail("compressed artifact exceeds the strict decode limit");
  assertActualIntegrity(
    "compressed artifact",
    compressed.byteLength,
    sha256(compressed),
    integrity.compressedBytes,
    integrity.compressedSha256,
  );
  const canonical = (() => {
    try {
      return gunzipSync(compressed, {
        maxOutputLength: ALPHA2_ARTIFACT_INTEGRITY.canonicalBytes,
      });
    } catch (error) {
      return fail(
        `gzip decompression failed or exceeded the decompressed output limit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();
  assertActualIntegrity(
    "canonical plan",
    canonical.byteLength,
    sha256(canonical),
    integrity.canonicalBytes,
    integrity.canonicalSha256,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical.toString("utf8")) as unknown;
  } catch (error) {
    fail(
      `canonical plan is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateAlpha2SaasApplicationPlan(parsed, authority);
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const slugifyAlpha2 = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "my-app";

const requireCanonicalTemplate = (
  plan: BlueprintTargetPlan,
  path: (typeof PARAMETERIZED_PATHS)[number],
  expected: unknown,
): BlueprintTargetPlan["entries"][number] => {
  const matches = plan.entries.filter((entry) => entry.path === path);
  if (matches.length !== 1)
    fail(`expected one canonical alpha.2 template at ${path}`);
  const found =
    matches[0] ?? fail(`expected one canonical alpha.2 template at ${path}`);
  if (
    found.content !== json(expected) ||
    found.sha256 !== sha256(found.content)
  )
    fail(`canonical alpha.2 template value drifted at ${path}`);
  return found;
};

export function parameterizeAlpha2SaasApplicationPlan(
  plan: BlueprintTargetPlan,
  options: Alpha2TargetPlanOptions,
): BlueprintTargetPlan {
  if (!same(plan.parameterizedEntries, PARAMETERIZED_PATHS))
    fail("parameterized entry set or order differs from alpha.2");
  requireCanonicalTemplate(
    plan,
    PARAMETERIZED_PATHS[0],
    CANONICAL_CRUD_SCENARIO,
  );
  requireCanonicalTemplate(plan, PARAMETERIZED_PATHS[1], CANONICAL_RECORDS);
  requireCanonicalTemplate(plan, PARAMETERIZED_PATHS[2], CANONICAL_WORKSPACE);
  requireCanonicalTemplate(
    plan,
    PARAMETERIZED_PATHS[3],
    CANONICAL_APPLICATION_CONTRACT,
  );
  const name = options.name.trim() || "My App";
  const firstOutcome =
    options.firstOutcome?.trim() || "Create and review records";
  const slug = slugifyAlpha2(name);
  const workspaceId = `workspace_${slug.replaceAll("-", "_")}`;
  const replacements = new Map<string, string>([
    [PARAMETERIZED_PATHS[0], json({ ...CANONICAL_CRUD_SCENARIO, workspaceId })],
    [
      PARAMETERIZED_PATHS[1],
      json(CANONICAL_RECORDS.map((record) => ({ ...record, workspaceId }))),
    ],
    [
      PARAMETERIZED_PATHS[2],
      json({
        ...CANONICAL_WORKSPACE,
        id: workspaceId,
        slug,
        name: `${name} Workspace`,
      }),
    ],
    [
      PARAMETERIZED_PATHS[3],
      json({
        ...CANONICAL_APPLICATION_CONTRACT,
        personalization: { name, firstOutcome },
      }),
    ],
  ]);
  const entries = plan.entries.map((candidate) => {
    const content = replacements.get(candidate.path);
    return content === undefined
      ? candidate
      : { ...candidate, content, sha256: sha256(content) };
  });
  if (
    entries.filter((candidate, index) => candidate !== plan.entries[index])
      .length !== 4
  )
    fail("alpha.2 transformer did not replace exactly four entries");
  const personalized = { ...plan, entries } satisfies BlueprintTargetPlan;
  return {
    ...personalized,
    digest: sha256(JSON.stringify(planIdentity(personalized))),
  };
}

const loadFrozenAlpha2Plan = (): BlueprintTargetPlan => {
  const encodedArtifactFile = readFileSync(
    new URL("./customer/alpha2-plan.json.gz.b64", import.meta.url),
    "utf8",
  );
  if (
    Buffer.byteLength(encodedArtifactFile) !==
      ALPHA2_ARTIFACT_FILE_INTEGRITY.bytes ||
    sha256(encodedArtifactFile) !== ALPHA2_ARTIFACT_FILE_INTEGRITY.sha256
  )
    fail("encoded artifact file SHA-256 or byte length mismatch");
  if (!encodedArtifactFile.endsWith("\n"))
    fail("encoded artifact file is missing its canonical final newline");
  const encodedArtifact = encodedArtifactFile.slice(0, -1);
  const authorityText = readFileSync(
    new URL(
      "../../../../releases/v0.2.0-alpha.2/hardening/saas-application.json",
      import.meta.url,
    ),
    "utf8",
  );
  if (sha256(authorityText) !== FROZEN_AUTHORITY_SHA256)
    fail("F037 authority SHA-256 mismatch");
  let authority: unknown;
  try {
    authority = JSON.parse(authorityText) as unknown;
  } catch (error) {
    fail(
      `F037 authority is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return decodeAlpha2SaasApplicationArtifact({
    encodedArtifact,
    authority,
    integrity: ALPHA2_ARTIFACT_INTEGRITY,
  });
};

export function buildSaasApplicationAlpha2TargetPlan(
  options?: Alpha2TargetPlanOptions,
): BlueprintTargetPlan {
  return parameterizeAlpha2SaasApplicationPlan(
    loadFrozenAlpha2Plan(),
    options ?? canonicalOptions,
  );
}
