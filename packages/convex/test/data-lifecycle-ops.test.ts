import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { MemberNotInWorkspace, Unauthorized } from "../confect/errors";
import dataLifecycleImpl from "../confect/ops/dataLifecycle.impl";
import dataLifecycle, {
  CreateDsarRequestArgs,
  DsarRequestReturn,
  ListDsarRequestsArgs,
  ListDsarRequestsReturn,
  manifest as dataLifecycleManifest,
  schemaRegistry as dataLifecycleSchemaRegistry,
} from "../confect/ops/dataLifecycle.spec";
import dsarRequests, { DsarRequestRow } from "../confect/tables/dsarRequests";
import { DatabaseReader } from "../confect/_generated/services";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

describe("data lifecycle Confect contracts", () => {
  it("declares DSAR request audit indexes", () => {
    expect(dsarRequests.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_request: ["workspaceId", "requestId"],
      by_workspace_status: ["workspaceId", "status"],
      by_requested_by: ["requestedByUserId"],
    });
  });

  it("validates DSAR request args, rows, and returns with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(CreateDsarRequestArgs)({
        workspaceId: "workspaces_123",
        requestId: "dsar_export_123",
        kind: "export",
        subjectId: "users_123",
      }),
    ).toMatchObject({ requestId: "dsar_export_123", kind: "export" });

    expect(() =>
      Schema.decodeUnknownSync(CreateDsarRequestArgs)({
        workspaceId: "workspaces_123",
        requestId: "",
        kind: "export",
      }),
    ).toThrow();

    const row = {
      workspaceId: "workspaces_123",
      requestId: "dsar_delete_123",
      requestedByUserId: "users_123",
      subjectId: "users_456",
      kind: "delete",
      status: "needs-confirmation",
      dryRunOnly: true,
      plannedAt: 1_782_924_800_000,
      confirmationPhrase: "delete workspace_WRONG",
      exportManifest: [],
      deletePlan: [],
    };

    expect(Schema.decodeUnknownSync(DsarRequestRow)(row)).toMatchObject({
      dryRunOnly: true,
      status: "needs-confirmation",
    });
    expect(
      Schema.decodeUnknownSync(DsarRequestReturn)({
        ...row,
        confirmation: {
          required: true,
          phrase: "delete workspaces_123",
          reason: "workspace data deletion is destructive and audited",
        },
      }),
    ).toMatchObject({ requestId: "dsar_delete_123" });

    expect(
      Schema.decodeUnknownSync(ListDsarRequestsArgs)({
        workspaceId: "workspaces_123",
      }),
    ).toMatchObject({ workspaceId: "workspaces_123" });
    expect(
      Schema.decodeUnknownSync(ListDsarRequestsReturn)({
        requests: [
          {
            ...row,
            confirmation: {
              required: true,
              phrase: "delete workspaces_123",
              reason: "workspace data deletion is destructive and audited",
            },
          },
        ],
      }),
    ).toMatchObject({
      requests: [expect.objectContaining({ kind: "delete" })],
    });
  });

  it("registers data lifecycle functions and exports a finalized implementation", () => {
    expect(JSON.stringify(dataLifecycle)).toContain("createDsarRequest");
    expect(JSON.stringify(dataLifecycle)).toContain("listDsarRequests");
    expect(Layer.isLayer(dataLifecycleImpl)).toBe(true);
  });

  it("exports web-only manifest metadata for DSAR operations", () => {
    expect(dataLifecycleManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId: "ops.dataLifecycle.createDsarRequest",
          kind: "mutation",
          surfaces: ["web"],
          idempotent: true,
          argsSchemaName: "ops.dataLifecycle.createDsarRequest.args",
          returnsSchemaName: "ops.dataLifecycle.createDsarRequest.returns",
        }),
        expect.objectContaining({
          operationId: "ops.dataLifecycle.listDsarRequests",
          kind: "query",
          surfaces: ["web"],
          idempotent: true,
          argsSchemaName: "ops.dataLifecycle.listDsarRequests.args",
          returnsSchemaName: "ops.dataLifecycle.listDsarRequests.returns",
        }),
      ]),
    );
    expect(
      dataLifecycleManifest.some((entry) =>
        entry.surfaces.some((surface) =>
          ["api", "cli", "mcp"].includes(surface),
        ),
      ),
    ).toBe(false);
    expect(Object.keys(dataLifecycleSchemaRegistry).sort()).toEqual([
      "ops.dataLifecycle.createDsarRequest.args",
      "ops.dataLifecycle.createDsarRequest.returns",
      "ops.dataLifecycle.listDsarRequests.args",
      "ops.dataLifecycle.listDsarRequests.returns",
    ]);
  });

  it("persists a tenant-guarded dry-run DSAR request plan", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );
      const created = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.ops.dataLifecycle.createDsarRequest, {
          workspaceId: seeded.workspaceId,
          requestId: "dsar_delete_123",
          kind: "delete",
          subjectId: "users_subject_123",
          confirmationPhrase: "delete wrong_workspace",
        });
      const rows = yield* confect.run(
        Effect.gen(function* () {
          const reader = yield* DatabaseReader;
          const found = yield* reader
            .table("dsarRequests")
            .index("by_workspace_request", (q) =>
              q
                .eq("workspaceId", seeded.workspaceId)
                .eq("requestId", "dsar_delete_123"),
            )
            .collect()
            .pipe(Effect.orDie);

          return {
            count: found.length,
            firstRequestId: found[0]?.requestId ?? "",
            firstRequestedByUserId: found[0]?.requestedByUserId ?? "",
            firstStatus: found[0]?.status ?? "ready-for-review",
            firstDryRunOnly: found[0]?.dryRunOnly ?? false,
          };
        }),
        Schema.Struct({
          count: Schema.Number,
          firstRequestId: Schema.String,
          firstRequestedByUserId: Schema.String,
          firstStatus: Schema.Literals([
            "ready-for-review",
            "needs-confirmation",
            "blocked-by-legal-hold",
          ]),
          firstDryRunOnly: Schema.Boolean,
        }),
      );

      return { created, rows, seeded };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.created).toMatchObject({
      workspaceId: result.seeded.workspaceId,
      requestId: "dsar_delete_123",
      requestedByUserId: result.seeded.memberUserId,
      kind: "delete",
      status: "needs-confirmation",
      dryRunOnly: true,
    });
    expect(
      result.created.exportManifest.map((entry) => entry.resourceId),
    ).toContain("featureFlagPolicies");
    expect(
      result.created.deletePlan.every((entry) => entry.executable === false),
    ).toBe(true);
    expect(result.rows).toMatchObject({
      count: 1,
      firstRequestId: "dsar_delete_123",
      firstRequestedByUserId: result.seeded.memberUserId,
      firstStatus: "needs-confirmation",
      firstDryRunOnly: true,
    });
  });

  it("treats repeated DSAR request ids as idempotent audit records", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );
      const actor = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      const first = yield* actor.mutation(
        refs.public.ops.dataLifecycle.createDsarRequest,
        {
          workspaceId: seeded.workspaceId,
          requestId: "dsar_retry_123",
          kind: "delete",
          confirmationPhrase: "delete wrong_workspace",
        },
      );
      const retried = yield* actor.mutation(
        refs.public.ops.dataLifecycle.createDsarRequest,
        {
          workspaceId: seeded.workspaceId,
          requestId: "dsar_retry_123",
          kind: "delete",
          confirmationPhrase: `delete ${seeded.workspaceId}`,
        },
      );

      return { first, retried };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.first.status).toBe("needs-confirmation");
    expect(result.retried).toMatchObject({
      requestId: result.first.requestId,
      status: "needs-confirmation",
      plannedAt: result.first.plannedAt,
      confirmationPhrase: "delete wrong_workspace",
    });
  });

  it("rejects workspace outsiders with a typed error", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );

      return yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .mutation(refs.public.ops.dataLifecycle.createDsarRequest, {
          workspaceId: seeded.workspaceId,
          requestId: "dsar_outsider_123",
          kind: "export",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(MemberNotInWorkspace);
    expect(result._tag).toBe("MemberNotInWorkspace");
  });

  it("rejects unauthenticated DSAR requests with a typed error", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );

      return yield* confect
        .mutation(refs.public.ops.dataLifecycle.createDsarRequest, {
          workspaceId: seeded.workspaceId,
          requestId: "dsar_unauthenticated_123",
          kind: "export",
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(Unauthorized);
    expect(result._tag).toBe("Unauthorized");
  });

  it("lists DSAR request audit rows for workspace viewers", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );
      const actor = confect.withIdentity({
        subject: "member-subject",
        email: "member@example.com",
      });
      yield* actor.mutation(refs.public.ops.dataLifecycle.createDsarRequest, {
        workspaceId: seeded.workspaceId,
        requestId: "dsar_export_list_123",
        kind: "export",
      });
      yield* actor.mutation(refs.public.ops.dataLifecycle.createDsarRequest, {
        workspaceId: seeded.workspaceId,
        requestId: "dsar_delete_list_123",
        kind: "delete",
        confirmationPhrase: "delete wrong_workspace",
      });

      return yield* actor.query(
        refs.public.ops.dataLifecycle.listDsarRequests,
        {
          workspaceId: seeded.workspaceId,
        },
      );
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.requests.map((request) => request.requestId)).toEqual([
      "dsar_delete_list_123",
      "dsar_export_list_123",
    ]);
    expect(result.requests.every((request) => request.dryRunOnly)).toBe(true);
    expect(
      result.requests.every((request) =>
        request.deletePlan.every((entry) => entry.executable === false),
      ),
    ).toBe(true);
  });

  it("rejects outsider DSAR request listing with a typed error", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );

      return yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .query(refs.public.ops.dataLifecycle.listDsarRequests, {
          workspaceId: seeded.workspaceId,
        })
        .pipe(Effect.flip);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result).toBeInstanceOf(MemberNotInWorkspace);
    expect(result._tag).toBe("MemberNotInWorkspace");
  });
});
