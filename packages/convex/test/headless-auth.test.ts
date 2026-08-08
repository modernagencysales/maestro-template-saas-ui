import { TestConfect } from "@confect/test";
import { createHash } from "node:crypto";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseReader } from "../confect/_generated/services";
import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import apiKeys from "../confect/tables/apiKeys";
import {
  createApiKey,
  HeadlessAuthError,
  parseBearerApiKey,
  verifyApiKey,
  verifyApiKeyHash,
} from "../confect/headless/auth";
import { createHeadlessErrorEnvelope } from "../confect/headless/errorEnvelope";
import { testConfectLayer } from "./support/confect";

const seedLocalContracts = (args: {
  readonly namespace: string;
  readonly primaryKeyHash: string;
  readonly observerKeyHash: string;
}) =>
  Effect.gen(function* () {
    const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
    return yield* confect.mutation(
      refs.internal.headless.apiKeys.seedLocalContracts,
      args,
    );
  }).pipe(Effect.provide(testConfectLayer()));

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

afterEach(() => vi.unstubAllEnvs());

describe("headless API-key auth", () => {
  it("creates display-once API keys and stores only a hash", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read", "workflow:run"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(7),
    });

    expect(created.displayKey).toMatch(/^mtk_live_/);
    expect(created.row).toMatchObject({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      displayPrefix: expect.stringMatching(/^mtk_live_/),
      scopes: ["workspace:read", "workflow:run"],
      status: "active",
      createdByUserId: "user_123",
      createdAt: 1_000,
      revokedAt: null,
    });
    expect(created.row.keyHash).not.toBe(created.displayKey);
    expect(JSON.stringify(created.row)).not.toContain(created.displayKey);
  });

  it("parses bearer headers without accepting other auth schemes", () => {
    expect(parseBearerApiKey("Bearer mtk_live_example")).toBe(
      "mtk_live_example",
    );
    expect(parseBearerApiKey("bearer mtk_live_example")).toBe(
      "mtk_live_example",
    );
    expect(parseBearerApiKey("Basic secret")).toBeInstanceOf(HeadlessAuthError);
    expect(parseBearerApiKey(undefined)).toBeInstanceOf(HeadlessAuthError);
  });

  it("looks up bearer keys by hash and injects workspace scope", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read", "workflow:run"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(9),
    });

    const result = await verifyApiKey({
      presentedKey: created.displayKey,
      rows: [created.row],
      nowMs: 2_000,
      requiredScope: "workflow:run",
    });

    expect(result).toEqual({
      ok: true,
      workspaceId: "workspace_123",
      keyId: created.row.id,
      scopes: ["workspace:read", "workflow:run"],
    });
  });

  it("verifies a server-derived hash without accepting the raw key", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Contract runner",
      scopes: ["workspace:read", "workspace:write"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      randomBytes: () => new Uint8Array(32).fill(10),
    });

    await expect(
      verifyApiKeyHash({
        presentedHash: created.row.keyHash,
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workspace:write",
      }),
    ).resolves.toMatchObject({
      ok: true,
      workspaceId: "workspace_123",
      keyId: created.row.id,
    });
    await expect(
      verifyApiKeyHash({
        presentedHash: created.displayKey,
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workspace:write",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_NOT_FOUND" },
    });
  });

  it("denies revoked, expired, missing, and under-scoped keys", async () => {
    const created = await createApiKey({
      workspaceId: "workspace_123",
      name: "Reviewer CLI",
      scopes: ["workspace:read"],
      createdByUserId: "user_123",
      nowMs: 1_000,
      expiresAt: 3_000,
      randomBytes: () => new Uint8Array(32).fill(11),
    });

    await expect(
      verifyApiKey({
        presentedKey: "mtk_live_missing",
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_NOT_FOUND" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [{ ...created.row, status: "revoked", revokedAt: 2_000 }],
        nowMs: 2_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_REVOKED" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [created.row],
        nowMs: 4_000,
        requiredScope: "workspace:read",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_EXPIRED" },
    });
    await expect(
      verifyApiKey({
        presentedKey: created.displayKey,
        rows: [created.row],
        nowMs: 2_000,
        requiredScope: "workflow:run",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "API_KEY_FORBIDDEN" },
    });
  });

  it("returns opaque public error envelopes for headless surfaces", () => {
    const envelope = createHeadlessErrorEnvelope(
      new Error("raw provider payload secret"),
      "req_123",
    );

    expect(envelope).toEqual({
      ok: false,
      requestId: "req_123",
      error: {
        code: "INTERNAL",
        message: "Unexpected internal error.",
      },
    });
    expect(JSON.stringify(envelope)).not.toContain("secret");
  });

  it("declares the apiKeys Confect table indexes", () => {
    expect(apiKeys.indexes).toMatchObject({
      by_key_hash: ["keyHash"],
      by_workspace: ["workspaceId"],
      by_workspace_status: ["workspaceId", "status"],
    });
  });

  it("refuses the local contracts fixture without its explicit test flag", async () => {
    vi.stubEnv("MAESTRO_CONTRACT_TEST", "0");

    await expect(
      Effect.runPromise(
        seedLocalContracts({
          namespace: "contracts-flag-check",
          primaryKeyHash: sha256("primary-key"),
          observerKeyHash: sha256("observer-key"),
        }),
      ),
    ).rejects.toThrow(/MAESTRO_CONTRACT_TEST/u);
  });

  it("rejects local contract namespaces outside the contracts prefix", async () => {
    vi.stubEnv("MAESTRO_CONTRACT_TEST", "1");

    await expect(
      Effect.runPromise(
        seedLocalContracts({
          namespace: "customer-production",
          primaryKeyHash: sha256("primary-key"),
          observerKeyHash: sha256("observer-key"),
        }),
      ),
    ).rejects.toThrow();
  });

  it.each([
    ["plaintext", "primary-key"],
    ["wrong length", "abc123_-"],
    ["non-base64url", `${"a".repeat(42)}+`],
  ])("rejects %s contract key hashes", async (_label, primaryKeyHash) => {
    vi.stubEnv("MAESTRO_CONTRACT_TEST", "1");

    await expect(
      Effect.runPromise(
        seedLocalContracts({
          namespace: "contracts-hash-check",
          primaryKeyHash,
          observerKeyHash: sha256("observer-key"),
        }),
      ),
    ).rejects.toThrow();
  });

  it("seeds two scoped actors and returns identifiers without key material", async () => {
    vi.stubEnv("MAESTRO_CONTRACT_TEST", "1");
    const primaryKeyHash = sha256("primary-key");
    const observerKeyHash = sha256("observer-key");
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.mutation(
        refs.internal.headless.apiKeys.seedLocalContracts,
        {
          namespace: "contracts-scope-check",
          primaryKeyHash,
          observerKeyHash,
        },
      );
      const rows = yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const primary = yield* reader
            .table("apiKeys")
            .index("by_key_hash", (query) =>
              query.eq("keyHash", primaryKeyHash),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          const observer = yield* reader
            .table("apiKeys")
            .index("by_key_hash", (query) =>
              query.eq("keyHash", observerKeyHash),
            )
            .first()
            .pipe(Effect.map(Option.getOrNull), Effect.orDie);
          return {
            primary: primary && {
              workspaceId: String(primary.workspaceId),
              scopes: [...primary.scopes],
            },
            observer: observer && {
              workspaceId: String(observer.workspaceId),
              scopes: [...observer.scopes],
            },
          };
        }),
        Schema.Struct({
          primary: Schema.NullOr(
            Schema.Struct({
              workspaceId: Schema.String,
              scopes: Schema.mutable(Schema.Array(Schema.String)),
            }),
          ),
          observer: Schema.NullOr(
            Schema.Struct({
              workspaceId: Schema.String,
              scopes: Schema.mutable(Schema.Array(Schema.String)),
            }),
          ),
        }),
      );
      return { rows, seeded };
    }).pipe(Effect.provide(testConfectLayer()));

    const result = await Effect.runPromise(program);

    expect(result.seeded.primary.workspaceId).not.toBe(
      result.seeded.observer.workspaceId,
    );
    expect(result.rows.primary).toEqual({
      workspaceId: result.seeded.primary.workspaceId,
      scopes: ["workspace:read", "workspace:write"],
    });
    expect(result.rows.observer).toEqual({
      workspaceId: result.seeded.observer.workspaceId,
      scopes: ["workspace:read"],
    });
    expect(JSON.stringify(result.seeded)).not.toContain(primaryKeyHash);
    expect(JSON.stringify(result.seeded)).not.toContain(observerKeyHash);
  });
});
