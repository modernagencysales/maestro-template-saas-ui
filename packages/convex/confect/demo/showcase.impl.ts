/**
 * demo/showcase — the read-only surface behind the hosted reference app.
 * `overview` is the ONLY function the anonymous demo frontend calls: it
 * resolves the fixed demo workspace by slug and returns its workflow runs.
 * `seed` is internal (operator-run via `convex run demo/showcase:seed`) and
 * idempotent — it creates the demo workspace once and never touches
 * anything outside it, so the public deployment accepts no caller-shaped
 * writes at all.
 */
import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import showcase from "./showcase.spec";

export const DEMO_WORKSPACE_SLUG = "demo-showcase";

const demoGraphJson = JSON.stringify({
  nodes: [
    { id: "collect", kind: "capability", capability: "sourceGroundedBrief" },
    { id: "review", kind: "approval" },
    { id: "publish", kind: "capability", capability: "catalog" },
  ],
  edges: [
    { from: "collect", to: "review" },
    { from: "review", to: "publish" },
  ],
});

const demoWorkspaceBySlug = Effect.gen(function* () {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("workspaces")
    .index("by_slug", (q) => q.eq("slug", DEMO_WORKSPACE_SLUG))
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.orElseSucceed(() => null),
    );
});

const overview = FunctionImpl.make(databaseSchema, showcase, "overview", () =>
  Effect.gen(function* () {
    const workspace = yield* demoWorkspaceBySlug;
    if (workspace === null) {
      return { workspace: null, workflowRuns: [] };
    }
    const reader = yield* DatabaseReader;
    const runs = yield* reader
      .table("workflowRuns")
      .index("by_workspace_status", (q) => q.eq("workspaceId", workspace._id))
      .collect()
      .pipe(Effect.orDie);
    return { workspace, workflowRuns: runs };
  }),
);

const seed = FunctionImpl.make(databaseSchema, showcase, "seed", () =>
  Effect.gen(function* () {
    const existing = yield* demoWorkspaceBySlug;
    if (existing !== null) {
      return { created: false };
    }

    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const workspaceId = yield* writer
      .table("workspaces")
      .insert({
        organizationId: "org_demo_showcase",
        ownerUserId: "user_demo_operator",
        slug: DEMO_WORKSPACE_SLUG,
        name: "Maestro Template Demo",
        status: "active",
        dataClassification: "public",
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);

    const runs = [
      {
        workflowId: "source-grounded-brief",
        workflowVersion: 3,
        status: "completed" as const,
        startedAt: now - 86_400_000,
        completedAt: now - 86_100_000,
      },
      {
        workflowId: "source-grounded-brief",
        workflowVersion: 3,
        status: "running" as const,
        startedAt: now - 600_000,
        completedAt: null,
      },
      {
        workflowId: "catalog-refresh",
        workflowVersion: 1,
        status: "queued" as const,
        startedAt: now,
        completedAt: null,
      },
    ];

    yield* Effect.forEach(runs, (run, index) =>
      writer
        .table("workflowRuns")
        .insert({
          workspaceId,
          workflowId: run.workflowId,
          workflowVersion: run.workflowVersion,
          graphJson: demoGraphJson,
          status: run.status,
          idempotencyKey: `demo-seed-${String(index)}`,
          startedByUserId: "user_demo_operator",
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          failedAt: null,
          trustReceiptId: null,
        })
        .pipe(Effect.orDie),
    );

    return { created: true };
  }),
);

export default GroupImpl.make(databaseSchema, showcase).pipe(
  Layer.provide(overview),
  Layer.provide(seed),
  GroupImpl.finalize,
);
