import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import flagsImpl from "../confect/ops/flags.impl";
import flags, {
  FeatureFlagEvaluationReturn,
  FeatureFlagListReturn,
  FeatureFlagPolicyReturn,
  ListFeatureFlagsArgs,
  UpsertFeatureFlagPolicyArgs,
} from "../confect/ops/flags.spec";
import featureFlagPolicies, {
  FeatureFlagPolicyRow,
} from "../confect/tables/featureFlagPolicies";
import { DatabaseWriter } from "../confect/_generated/services";
import { testConfectLayer } from "./support/confect";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";

describe("feature flag Confect contracts", () => {
  it("declares durable feature flag policy indexes", () => {
    expect(featureFlagPolicies.indexes).toMatchObject({
      by_workspace: ["workspaceId"],
      by_workspace_key: ["workspaceId", "key"],
      by_key: ["key"],
    });
  });

  it("validates feature flag args, rows, and returns with Effect schemas", () => {
    expect(
      Schema.decodeUnknownSync(ListFeatureFlagsArgs)({
        workspaceId: "workspaces_123",
      }),
    ).toMatchObject({ workspaceId: "workspaces_123" });

    expect(
      Schema.decodeUnknownSync(UpsertFeatureFlagPolicyArgs)({
        workspaceId: "workspaces_123",
        key: "template.notifications.center",
        description: "Enable notification center",
        enabled: true,
        rolloutPercent: 50,
        audience: "workspace",
      }),
    ).toMatchObject({ rolloutPercent: 50 });
    expect(() =>
      Schema.decodeUnknownSync(UpsertFeatureFlagPolicyArgs)({
        workspaceId: "workspaces_123",
        key: "template.notifications.center",
        description: "Bad rollout",
        enabled: true,
        rolloutPercent: 101,
        audience: "workspace",
      }),
    ).toThrow();

    expect(
      Schema.decodeUnknownSync(FeatureFlagPolicyRow)({
        workspaceId: "workspaces_123",
        key: "template.ai.liveGeneration",
        description: "Live AI",
        enabled: false,
        rolloutPercent: 0,
        audience: "internal",
        killSwitchEnv: "LLM_DISABLED",
        source: "workspace",
        updatedAt: 1,
      }),
    ).toMatchObject({ source: "workspace" });

    expect(
      Schema.decodeUnknownSync(FeatureFlagPolicyReturn)({
        workspaceId: "workspaces_123",
        key: "template.ai.liveGeneration",
        description: "Live AI",
        enabled: false,
        rolloutPercent: 0,
        audience: "internal",
        killSwitchEnv: "LLM_DISABLED",
        source: "workspace",
        updatedAt: 1,
      }),
    ).toMatchObject({ key: "template.ai.liveGeneration" });

    expect(
      Schema.decodeUnknownSync(FeatureFlagListReturn)({
        policies: [],
      }),
    ).toEqual({ policies: [] });
    expect(
      Schema.decodeUnknownSync(FeatureFlagEvaluationReturn)({
        decisions: [],
        summary: { total: 0, enabled: 0, disabled: 0 },
      }),
    ).toMatchObject({ summary: { total: 0 } });
  });

  it("registers feature flag functions and exports a finalized implementation", () => {
    expect(JSON.stringify(flags)).toContain("list");
    expect(JSON.stringify(flags)).toContain("evaluate");
    expect(JSON.stringify(flags)).toContain("upsertPolicyInternal");
    expect(Layer.isLayer(flagsImpl)).toBe(true);
  });

  it("lists starter-safe defaults and evaluates live side effects disabled", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );
      const list = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .query(refs.public.ops.flags.list, {
          workspaceId: seeded.workspaceId,
        });
      const evaluated = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .query(refs.public.ops.flags.evaluate, {
          workspaceId: seeded.workspaceId,
        });

      return { evaluated, list };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.list.policies.map((policy) => policy.key)).toEqual([
      "template.onboarding.workspaceBrief",
      "template.workflow.liveRuns",
      "template.billing.liveCheckout",
      "template.notifications.center",
      "template.ai.liveGeneration",
    ]);
    expect(
      result.evaluated.decisions.filter((decision) => decision.enabled),
    ).toHaveLength(2);
    expect(
      result.evaluated.decisions
        .filter((decision) =>
          [
            "template.billing.liveCheckout",
            "template.notifications.center",
            "template.ai.liveGeneration",
          ].includes(decision.key),
        )
        .every((decision) => decision.reason === "definition-disabled"),
    ).toBe(true);
  });

  it("persists workspace overrides and applies audience gates", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(
        seedTenancy(1_782_924_800_000),
        SeededTenancy,
      );
      yield* confect.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          yield* writer
            .table("organizationMembers")
            .insert({
              organizationId: seeded.organizationId,
              userId: seeded.memberUserId,
              role: "admin",
              status: "active",
              acceptedAt: 1_782_924_800_000,
              revokedAt: null,
              createdAt: 1_782_924_800_000,
              updatedAt: 1_782_924_800_000,
            })
            .pipe(Effect.orDie);
          yield* writer
            .table("workspaceMembers")
            .insert({
              workspaceId: seeded.workspaceId,
              userId: seeded.outsiderUserId,
              role: "viewer",
              status: "active",
              acceptedAt: 1_782_924_800_000,
              revokedAt: null,
              deletedAt: null,
              createdAt: 1_782_924_800_000,
              updatedAt: 1_782_924_800_000,
            })
            .pipe(Effect.orDie);

          return {};
        }),
        Schema.Struct({}),
      );
      const policy = yield* confect.mutation(
        refs.internal.ops.flags.upsertPolicyInternal,
        {
          workspaceId: seeded.workspaceId,
          key: "template.notifications.center",
          description: "Enable notifications for admins first.",
          enabled: true,
          rolloutPercent: 100,
          audience: "internal",
          killSwitchEnv: "NOTIFICATIONS_DISABLED",
        },
      );
      const adminEvaluation = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .query(refs.public.ops.flags.evaluate, {
          workspaceId: seeded.workspaceId,
        });
      const memberEvaluation = yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .query(refs.public.ops.flags.evaluate, {
          workspaceId: seeded.workspaceId,
        });

      return { adminEvaluation, memberEvaluation, policy };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    const adminDecision = result.adminEvaluation.decisions.find(
      (decision) => decision.key === "template.notifications.center",
    );
    const memberDecision = result.memberEvaluation.decisions.find(
      (decision) => decision.key === "template.notifications.center",
    );

    expect(result.policy).toMatchObject({
      key: "template.notifications.center",
      source: "workspace",
      enabled: true,
      audience: "internal",
    });
    expect(adminDecision).toMatchObject({
      enabled: true,
      reason: "enabled",
      source: "workspace",
    });
    expect(memberDecision).toMatchObject({
      enabled: false,
      reason: "audience",
      source: "workspace",
    });
  });
});
