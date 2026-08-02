import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buildSaasApplicationAlpha2TargetPlan,
  ALPHA2_ARTIFACT_FILE_INTEGRITY,
  ALPHA2_ARTIFACT_INTEGRITY,
  decodeAlpha2SaasApplicationArtifact,
  parameterizeAlpha2SaasApplicationPlan,
  validateAlpha2SaasApplicationPlan,
  type Alpha2ArtifactIntegrity,
} from "./alpha2SaasApplicationPlan";
import {
  buildSaasApplicationTargetPlan,
  type BlueprintTargetPlan,
} from "./saasApplication";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const encodedArtifactFile = readFileSync(
  join(
    repoRoot,
    "tooling/generators/src/blueprints/customer/alpha2-plan.json.gz.b64",
  ),
  "utf8",
);
const encodedArtifact = encodedArtifactFile.slice(0, -1);
const authority = JSON.parse(
  readFileSync(
    join(repoRoot, "releases/v0.2.0-alpha.2/hardening/saas-application.json"),
    "utf8",
  ),
) as unknown;

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const integrityFor = (
  encoded: string,
  canonicalSha256?: `sha256:${string}`,
): Alpha2ArtifactIntegrity => {
  const compressed = Buffer.from(encoded, "base64");
  const canonical = gunzipSync(compressed);
  return {
    encodedBytes: Buffer.byteLength(encoded),
    encodedSha256: hash(encoded),
    compressedBytes: compressed.byteLength,
    compressedSha256: hash(compressed),
    canonicalBytes: canonical.byteLength,
    canonicalSha256: canonicalSha256 ?? hash(canonical),
  };
};

const canonicalPlan = (): BlueprintTargetPlan =>
  JSON.parse(
    gunzipSync(Buffer.from(encodedArtifact, "base64")).toString(),
  ) as BlueprintTargetPlan;

const targetEntryIdentity = (
  candidate: BlueprintTargetPlan["entries"][number],
) => ({
  path: candidate.path,
  ownership: candidate.ownership,
  action: candidate.action,
  upgrade: candidate.upgrade,
  sha256: candidate.sha256,
  ...(candidate.replaces === undefined ? {} : { replaces: candidate.replaces }),
});

const requireAt = <T>(
  values: readonly T[],
  index: number,
  label: string,
): T => {
  const value = values[index];
  if (value === undefined)
    throw new Error(`Missing ${label} at index ${index}`);
  return value;
};

const withRecomputedDigest = (
  plan: BlueprintTargetPlan,
): BlueprintTargetPlan => {
  const identity = {
    schemaVersion: plan.schemaVersion,
    id: plan.id,
    provenance: plan.provenance,
    registrations: plan.registrations,
    entries: plan.entries.map(targetEntryIdentity),
  };
  return { ...plan, digest: hash(JSON.stringify(identity)) };
};

const decode = (encoded: string, reviewedAuthority: unknown = authority) =>
  decodeAlpha2SaasApplicationArtifact({
    encodedArtifact: encoded,
    authority: reviewedAuthority,
    integrity: integrityFor(encoded),
  });

const validate = (plan: unknown, reviewedAuthority: unknown = authority) =>
  validateAlpha2SaasApplicationPlan(plan, reviewedAuthority);

const entry = (plan: BlueprintTargetPlan, path: string) => {
  const found = plan.entries.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`Missing plan entry ${path}`);
  return found;
};

describe("frozen alpha.2 SaaS application plan", () => {
  it("pins all three artifact layers and the complete F037 authority", () => {
    const plan = buildSaasApplicationAlpha2TargetPlan();

    expect(ALPHA2_ARTIFACT_FILE_INTEGRITY).toEqual({
      bytes: 728_989,
      sha256:
        "sha256:aba253540af7233c6b175a5a8b46b173273c335ddc742a8e920347057aa75377",
    });
    expect(Buffer.byteLength(encodedArtifactFile)).toBe(
      ALPHA2_ARTIFACT_FILE_INTEGRITY.bytes,
    );
    expect(hash(encodedArtifactFile)).toBe(
      ALPHA2_ARTIFACT_FILE_INTEGRITY.sha256,
    );
    expect(encodedArtifactFile.endsWith("\n")).toBe(true);
    expect(ALPHA2_ARTIFACT_INTEGRITY).toEqual({
      encodedBytes: 728_988,
      encodedSha256:
        "sha256:bf002cfc239a3aaec9a88ef6d1bcf640346c618a009b4a170c7a4938041b3a14",
      compressedBytes: 542_223,
      compressedSha256:
        "sha256:6d45ac2622e26f4200c52d5ad0d51d2e0c7b08e5a88ab69621a68c711825ee80",
      canonicalBytes: 2_489_464,
      canonicalSha256:
        "sha256:433f435c63385db02bdcc1b5e7e6b74cdfe49b45916eff4f64b168804dffeaf9",
    });
    expect(plan.entries).toHaveLength(277);
    expect(plan.parameterizedEntries).toEqual([
      "examples/saas-application/seed/crud-scenario.json",
      "examples/saas-application/seed/records.json",
      "examples/saas-application/seed/workspace.json",
      "generated/blueprints/saas-application/application-contract.json",
    ]);
    expect(plan.digest).toBe(
      "sha256:72ec9e81cc0d5d99d5914875722a2277354a221d8f65123a9088b205ec586c96",
    );
  });

  it("rejects encoded, compressed, and canonical corruption independently", () => {
    const invalidBase64 = `${encodedArtifact.slice(0, -1)}!`;
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact: invalidBase64,
        authority,
        integrity: {
          ...integrityFor(encodedArtifact),
          encodedSha256: hash(invalidBase64),
        },
      }),
    ).toThrow(/base64/i);

    const compressed = Buffer.from(encodedArtifact, "base64");
    const compressedByte = compressed.at(100);
    if (compressedByte === undefined)
      throw new Error("Missing compressed artifact byte at index 100");
    compressed[100] = compressedByte ^ 1;
    const corruptGzip = compressed.toString("base64");
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact: corruptGzip,
        authority,
        integrity: {
          ...integrityFor(encodedArtifact),
          encodedBytes: Buffer.byteLength(corruptGzip),
          encodedSha256: hash(corruptGzip),
          compressedSha256: hash(compressed),
        },
      }),
    ).toThrow(/gzip|compressed|decompress/i);

    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact,
        authority,
        integrity: integrityFor(encodedArtifact, `sha256:${"0".repeat(64)}`),
      }),
    ).toThrow(/canonical.*sha-?256/i);
  });

  it("checks each pinned artifact SHA-256 before decoding the next layer", () => {
    const integrity = integrityFor(encodedArtifact);
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact,
        authority,
        integrity: { ...integrity, encodedSha256: `sha256:${"0".repeat(64)}` },
      }),
    ).toThrow(/encoded artifact SHA-256 mismatch/i);
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact,
        authority,
        integrity: {
          ...integrity,
          compressedSha256: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toThrow(/compressed artifact SHA-256 mismatch/i);
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact,
        authority,
        integrity: {
          ...integrity,
          canonicalSha256: `sha256:${"0".repeat(64)}`,
        },
      }),
    ).toThrow(/canonical plan SHA-256 mismatch/i);
  });

  it("enforces hard encoded and decompressed limits before parsing", () => {
    const oversizedEncoded = "A".repeat(728_992);
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact: oversizedEncoded,
        authority,
        integrity: {
          ...integrityFor(encodedArtifact),
          encodedBytes: Buffer.byteLength(oversizedEncoded),
          encodedSha256: hash(oversizedEncoded),
        },
      }),
    ).toThrow(/encoded.*limit/i);

    const oversizedCompressedBytes = Buffer.alloc(542_224);
    const oversizedCompressed = oversizedCompressedBytes.toString("base64");
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact: oversizedCompressed,
        authority,
        integrity: {
          encodedBytes: Buffer.byteLength(oversizedCompressed),
          encodedSha256: hash(oversizedCompressed),
          compressedBytes: oversizedCompressedBytes.byteLength,
          compressedSha256: hash(oversizedCompressedBytes),
          canonicalBytes: 0,
          canonicalSha256: hash(""),
        },
      }),
    ).toThrow(/compressed.*limit/i);

    const oversizedCanonical = gzipSync(Buffer.alloc(2_489_465)).toString(
      "base64",
    );
    expect(() =>
      decodeAlpha2SaasApplicationArtifact({
        encodedArtifact: oversizedCanonical,
        authority,
        integrity: {
          encodedBytes: Buffer.byteLength(oversizedCanonical),
          encodedSha256: hash(oversizedCanonical),
          compressedBytes: Buffer.from(oversizedCanonical, "base64").byteLength,
          compressedSha256: hash(Buffer.from(oversizedCanonical, "base64")),
          canonicalBytes: 2_489_465,
          canonicalSha256: hash(Buffer.alloc(2_489_465)),
        },
      }),
    ).toThrow(/decompressed.*limit/i);
  });

  it.each([
    [
      "missing",
      /entry count/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        entries: plan.entries.slice(1),
      }),
    ],
    [
      "extra",
      /entry count/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        entries: [
          ...plan.entries,
          {
            path: "extra.txt",
            content: "extra\n",
            sha256: hash("extra\n"),
            ownership: "generated" as const,
            action: "generate" as const,
            upgrade: "regenerate" as const,
          },
        ],
      }),
    ],
    [
      "duplicate",
      /duplicate path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        entries: plan.entries.map((candidate, index) =>
          index === 1
            ? {
                ...candidate,
                path: requireAt(plan.entries, 0, "duplicate source").path,
              }
            : candidate,
        ),
      }),
    ],
    [
      "reordered",
      /F037 authority at index/i,
      (plan: BlueprintTargetPlan) =>
        withRecomputedDigest({
          ...plan,
          entries: [
            requireAt(plan.entries, 1, "reordered entry"),
            requireAt(plan.entries, 0, "reordered entry"),
            ...plan.entries.slice(2),
          ],
        }),
    ],
    [
      "path escape",
      /unsafe path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        entries: plan.entries.map((candidate, index) =>
          index === 0 ? { ...candidate, path: "../escape" } : candidate,
        ),
      }),
    ],
  ])("rejects %s entry drift", (_label, expected, mutate) => {
    expect(() => validate(mutate(canonicalPlan()))).toThrow(expected);
  });

  it.each([
    [
      "missing registration",
      /registrations differ from F037 authority/i,
      (plan: BlueprintTargetPlan) =>
        withRecomputedDigest({
          ...plan,
          registrations: plan.registrations.slice(1),
        }),
    ],
    [
      "extra registration",
      /registrations differ from F037 authority/i,
      (plan: BlueprintTargetPlan) => {
        const registered = new Set(plan.registrations);
        const extra = plan.entries.find(({ path }) => !registered.has(path));
        if (extra === undefined)
          throw new Error("Missing unregistered entry for drift fixture");
        return withRecomputedDigest({
          ...plan,
          registrations: [...plan.registrations, extra.path],
        });
      },
    ],
    [
      "reordered registrations",
      /registrations differ from F037 authority/i,
      (plan: BlueprintTargetPlan) =>
        withRecomputedDigest({
          ...plan,
          registrations: [
            requireAt(plan.registrations, 1, "reordered registration"),
            requireAt(plan.registrations, 0, "reordered registration"),
            ...plan.registrations.slice(2),
          ],
        }),
    ],
    [
      "duplicate registration",
      /registrations contains duplicate path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        registrations: [
          requireAt(plan.registrations, 0, "duplicate registration"),
          ...plan.registrations,
        ],
      }),
    ],
    [
      "registration path escape",
      /registrations contains unsafe path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        registrations: ["../escape", ...plan.registrations.slice(1)],
      }),
    ],
    [
      "missing parameterized entry",
      /parameterized entry set or order differs from F037/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        parameterizedEntries: plan.parameterizedEntries.slice(1),
      }),
    ],
    [
      "duplicate parameterized entry",
      /parameterizedEntries contains duplicate path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        parameterizedEntries: [
          requireAt(
            plan.parameterizedEntries,
            0,
            "duplicate parameterized entry",
          ),
          requireAt(
            plan.parameterizedEntries,
            0,
            "duplicate parameterized entry",
          ),
          ...plan.parameterizedEntries.slice(2),
        ],
      }),
    ],
    [
      "parameterized path escape",
      /parameterizedEntries contains unsafe path/i,
      (plan: BlueprintTargetPlan) => ({
        ...plan,
        parameterizedEntries: [
          "../escape",
          ...plan.parameterizedEntries.slice(1),
        ],
      }),
    ],
  ])("rejects %s", (_label, expected, mutate) => {
    expect(() => validate(mutate(canonicalPlan()))).toThrow(expected);
  });

  it("recomputes every body hash and the plan digest", () => {
    const source = canonicalPlan();
    const badBody = {
      ...source,
      entries: source.entries.map((candidate, index) =>
        index === 10
          ? { ...candidate, content: "A".repeat(candidate.content.length) }
          : candidate,
      ),
    };
    expect(() => validate(badBody)).toThrow(/body.*sha-?256/i);

    const badDigest = canonicalPlan();
    Object.assign(badDigest, { digest: `sha256:${"0".repeat(64)}` });
    expect(() => validate(badDigest)).toThrow(/plan digest/i);
  });

  it("rejects current-builder identity as an alpha.2 source", () => {
    const current = buildSaasApplicationTargetPlan();
    expect(() => validate(current, authority)).toThrow(
      /entry count must be exactly 277|F037 authority at index/i,
    );
  });

  it("rejects an otherwise structured current-builder source authority", () => {
    const current = buildSaasApplicationTargetPlan();
    const currentBuilderAuthority = {
      schemaVersion: current.schemaVersion,
      id: current.id,
      provenance: current.provenance,
      projectionSource: {
        ...(authority as { projectionSource: Record<string, unknown> })
          .projectionSource,
        sourceCommit: "0".repeat(40),
      },
      registrations: current.registrations,
      parameterizedEntries: current.parameterizedEntries,
      entries: current.entries.map(targetEntryIdentity),
    };

    expect(() => validate(canonicalPlan(), currentBuilderAuthority)).toThrow(
      /F037 authority source commit does not match alpha\.2/i,
    );
  });

  it("personalizes only the four canonical alpha.2 JSON templates", () => {
    const canonical = decode(encodedArtifact);
    const personalized = parameterizeAlpha2SaasApplicationPlan(canonical, {
      name: "  Crème 東京!!!  ",
      firstOutcome: "  Ship — safely ✅  ",
    });
    const changed = personalized.entries
      .filter(
        (candidate, index) =>
          candidate.content !==
          requireAt(canonical.entries, index, "canonical entry").content,
      )
      .map(({ path }) => path);

    expect(changed).toEqual(canonical.parameterizedEntries);
    expect(
      JSON.parse(
        entry(
          personalized,
          requireAt(
            canonical.parameterizedEntries,
            2,
            "workspace parameterized entry",
          ),
        ).content,
      ),
    ).toEqual({
      id: "workspace_cr_me",
      slug: "cr-me",
      name: "Crème 東京!!! Workspace",
      memberRole: "owner",
      synthetic: true,
    });
    expect(
      JSON.parse(
        entry(
          personalized,
          "generated/blueprints/saas-application/application-contract.json",
        ).content,
      ).personalization,
    ).toEqual({ name: "Crème 東京!!!", firstOutcome: "Ship — safely ✅" });
  });

  it("uses deterministic empty and punctuation-only fallbacks", () => {
    const empty = buildSaasApplicationAlpha2TargetPlan({
      name: "   ",
      firstOutcome: "   ",
    });
    const punctuation = buildSaasApplicationAlpha2TargetPlan({
      name: " !!! — 東京 ",
      firstOutcome: "Outcome!",
    });

    expect(
      JSON.parse(
        entry(empty, "examples/saas-application/seed/workspace.json").content,
      ),
    ).toMatchObject({
      id: "workspace_my_app",
      slug: "my-app",
      name: "My App Workspace",
    });
    expect(
      JSON.parse(
        entry(punctuation, "examples/saas-application/seed/workspace.json")
          .content,
      ),
    ).toMatchObject({
      id: "workspace_my_app",
      slug: "my-app",
      name: "!!! — 東京 Workspace",
    });
    expect(
      JSON.parse(
        entry(
          empty,
          "generated/blueprints/saas-application/application-contract.json",
        ).content,
      ).personalization,
    ).toEqual({
      name: "My App",
      firstOutcome: "Create and review records",
    });
  });

  it("fails closed when an authorized alpha.2 template value drifts", () => {
    const plan = decode(encodedArtifact);
    const target = entry(
      plan,
      "examples/saas-application/seed/crud-scenario.json",
    );
    const content = JSON.parse(target.content);
    content.create.title = "Evolving title";
    Object.assign(target, {
      content: `${JSON.stringify(content, null, 2)}\n`,
      sha256: hash(`${JSON.stringify(content, null, 2)}\n`),
    });

    expect(() =>
      parameterizeAlpha2SaasApplicationPlan(plan, { name: "Customer" }),
    ).toThrow(/canonical alpha\.2 template/i);
  });
});
