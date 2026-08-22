import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/components/workflowAdmission/schema";
import appSchema from "../confect/_generated/convexSchema";

const modules = import.meta.glob(
  "../convex/components/workflowAdmission/**/*.ts",
);
const appModules = {
  ...import.meta.glob("../convex/_generated/**/*.ts"),
  "../convex/workflowAdmissionAdapterHarness.ts": () =>
    import("./fixtures/workflowAdmissionAdapterHarness"),
};
const reserve = makeFunctionReference<"mutation">("admission:reserve");
const bind = makeFunctionReference<"mutation">("admission:bind");
const transition = makeFunctionReference<"mutation">("admission:transition");
const adapterExercise = makeFunctionReference<"mutation">(
  "workflowAdmissionAdapterHarness:exercise",
);
const policy = {
  user: { maxActive: 1, maxQueued: 1, retryAfterMs: 10 },
  system: { maxActive: 1, maxQueued: 1, retryAfterMs: 20 },
};

const reserveRun = async (
  t: ReturnType<typeof convexTest>,
  workspaceId: string,
  reservationKey: string,
  lane: "user" | "system",
  selectedPolicy = policy,
  legacyRunningRunIds: string[] = [],
  legacyQueuedRunIds: string[] = [],
) => {
  await t.mutation(reserve, {
    workspaceId,
    reservationKey,
    lane,
    policy: selectedPolicy,
    legacyRunningRunIds,
    legacyQueuedRunIds,
  });
  const workflowRunId = `${workspaceId}:${reservationKey}`;
  await t.mutation(bind, { workspaceId, reservationKey, workflowRunId });
  return workflowRunId;
};

describe("workflow admission component", () => {
  it("enforces exact active and queued boundaries per lane and workspace", async () => {
    const app = convexTest(appSchema, appModules);
    app.registerComponent("workflowAdmission", schema, modules);
    await expect(app.mutation(adapterExercise, {})).resolves.toBe(
      "reserve-transition-release",
    );

    const t = convexTest(schema, modules);
    const active = await reserveRun(t, "noisy", "active", "user");
    await t.mutation(transition, { workflowRunId: active, status: "running" });
    await expect(
      reserveRun(t, "noisy", "denied", "user"),
    ).rejects.toMatchObject({
      data: {
        code: "WORKFLOW_ADMISSION_DENIED",
        saturated: "active",
        limit: 1,
      },
    });
    await expect(
      reserveRun(t, "quiet", "allowed", "user"),
    ).resolves.toBeTruthy();
    await expect(
      reserveRun(t, "noisy", "system", "system"),
    ).resolves.toBeTruthy();
  });

  it("fails closed for zero capacity without an unbounded read", async () => {
    const t = convexTest(schema, modules);
    await expect(
      reserveRun(t, "zero", "system", "system", {
        ...policy,
        system: { maxActive: 0, maxQueued: 0, retryAfterMs: 20 },
      }),
    ).rejects.toMatchObject({
      data: {
        code: "WORKFLOW_ADMISSION_DENIED",
        saturated: "active",
        limit: 0,
      },
    });
  });

  it("enforces the queued boundary independently and replays the same lane idempotently", async () => {
    const t = convexTest(schema, modules);
    const first = await reserveRun(t, "queued", "same", "user");
    await expect(reserveRun(t, "queued", "same", "user")).resolves.toBe(first);
    await expect(
      reserveRun(t, "queued", "second", "user"),
    ).rejects.toMatchObject({
      data: {
        code: "WORKFLOW_ADMISSION_DENIED",
        saturated: "queued",
        limit: 1,
      },
    });
  });

  it("rejects malformed policy instead of coercing it into capacity", async () => {
    const t = convexTest(schema, modules);
    await expect(
      reserveRun(t, "invalid", "negative", "user", {
        ...policy,
        user: { maxActive: -1, maxQueued: 1, retryAfterMs: 10 },
      }),
    ).rejects.toMatchObject({ data: "WORKFLOW_ADMISSION_POLICY_INVALID" });
  });

  it("seeds bounded legacy user work and does not misclassify it as system work", async () => {
    const t = convexTest(schema, modules);
    const system = await reserveRun(
      t,
      "legacy",
      "system-one",
      "system",
      policy,
      ["legacy-user-one", "legacy-user-two"],
    );
    await expect(
      reserveRun(t, "legacy", "user-one", "user"),
    ).rejects.toMatchObject({
      data: {
        code: "WORKFLOW_ADMISSION_DENIED",
        saturated: "active",
        lane: "user",
      },
    });
    await t.mutation(transition, { workflowRunId: system, status: "running" });
    await expect(
      reserveRun(t, "legacy", "system-two", "system"),
    ).rejects.toMatchObject({
      data: {
        code: "WORKFLOW_ADMISSION_DENIED",
        saturated: "active",
        lane: "system",
      },
    });
  });

  it("does not let opposite-lane overflow cause false denial", async () => {
    const t = convexTest(schema, modules);
    const generous = {
      user: { maxActive: 4, maxQueued: 4, retryAfterMs: 10 },
      system: { maxActive: 4, maxQueued: 4, retryAfterMs: 20 },
    };
    for (const suffix of ["one", "two", "three"]) {
      const runId = await reserveRun(
        t,
        "overflow",
        `system-${suffix}`,
        "system",
        generous,
      );
      await t.mutation(transition, { workflowRunId: runId, status: "running" });
    }
    await expect(
      reserveRun(t, "overflow", "user", "user", policy),
    ).resolves.toBeTruthy();
  });

  it("releases capacity on terminal transition and rejects conflicting replay lanes", async () => {
    const t = convexTest(schema, modules);
    const first = await reserveRun(t, "lifecycle", "same", "user");
    await t.mutation(transition, { workflowRunId: first, status: "running" });
    await t.mutation(transition, { workflowRunId: first, status: "completed" });
    await expect(
      reserveRun(t, "lifecycle", "next", "user"),
    ).resolves.toBeTruthy();
    await expect(
      reserveRun(t, "lifecycle", "same", "system"),
    ).rejects.toBeTruthy();
  });
});
