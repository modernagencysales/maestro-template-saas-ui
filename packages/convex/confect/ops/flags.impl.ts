import { FunctionImpl, GroupImpl } from "@confect/server";
import type { GenericId } from "convex/values";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import databaseSchema from "../_generated/schema";
import { DatabaseReader, DatabaseWriter } from "../_generated/services";
import { roleAtLeast, type Role } from "../access/roles";
import { requireWorkspaceAccess } from "../capabilities/_kit/workspaceAccess";
import { applyFeatureFlagAfterAdmission } from "../capabilities/_kit/surfaces";
import { ValidationFailed } from "../errors";
import flags from "./flags.spec";

const defaultFeatureFlagPolicies = [
  {
    key: "template.onboarding.workspaceBrief",
    description: "Reference TanStack Form workspace brief in onboarding.",
    enabled: true,
    rolloutPercent: 100,
    audience: "everyone",
  },
  {
    key: "template.workflow.liveRuns",
    description: "Live workflow run panels and status overlays.",
    enabled: true,
    rolloutPercent: 100,
    audience: "everyone",
  },
  {
    key: "template.billing.liveCheckout",
    description: "Promoted live billing checkout and provider reconciliation.",
    enabled: false,
    rolloutPercent: 0,
    audience: "internal",
    killSwitchEnv: "BILLING_DISABLED",
  },
  {
    key: "template.notifications.center",
    description: "In-app notification center and user preferences.",
    enabled: false,
    rolloutPercent: 0,
    audience: "internal",
    killSwitchEnv: "NOTIFICATIONS_DISABLED",
  },
  {
    key: "template.ai.liveGeneration",
    description: "Live model calls outside deterministic fake mode.",
    enabled: false,
    rolloutPercent: 0,
    audience: "internal",
    killSwitchEnv: "LLM_DISABLED",
  },
] as const satisfies readonly FeatureFlagPolicySeed[];

const unsafeAssumeClockProvided = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Clock.Clock>> =>
  effect as Effect.Effect<A, E, Exclude<R, Clock.Clock>>;

const list = FunctionImpl.make(
  databaseSchema,
  flags,
  "list",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "viewer"),
      );
      const reader = yield* DatabaseReader;
      const overrides = yield* reader
        .table("featureFlagPolicies")
        .index("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
        .pipe(Effect.orDie);

      return {
        policies: mergePolicies(workspaceId, overrides).map(toPolicyReturn),
      };
    }),
);

const evaluate = FunctionImpl.make(
  databaseSchema,
  flags,
  "evaluate",
  ({ workspaceId }) =>
    Effect.gen(function* () {
      const access = yield* unsafeAssumeClockProvided(
        requireWorkspaceAccess(workspaceId, "viewer"),
      );
      const reader = yield* DatabaseReader;
      const overrides = yield* reader
        .table("featureFlagPolicies")
        .index("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
        .pipe(Effect.orDie);
      const policies = mergePolicies(workspaceId, overrides);
      const decisions = policies.map((policy) =>
        evaluatePolicy(policy, access.role),
      );

      return {
        decisions,
        summary: {
          total: decisions.length,
          enabled: decisions.filter((decision) => decision.enabled).length,
          disabled: decisions.filter((decision) => !decision.enabled).length,
        },
      };
    }),
);

const upsertPolicyInternal = FunctionImpl.make(
  databaseSchema,
  flags,
  "upsertPolicyInternal",
  (input) =>
    Effect.gen(function* () {
      if (!input.description.trim()) {
        return yield* new ValidationFailed({
          field: "description",
          message: "Feature flag description is required.",
        });
      }

      if (input.killSwitchEnv !== undefined && !input.killSwitchEnv.trim()) {
        return yield* new ValidationFailed({
          field: "killSwitchEnv",
          message: "Feature flag killSwitchEnv is required when provided.",
        });
      }

      const updatedAt = yield* unsafeAssumeClockProvided(
        Clock.currentTimeMillis,
      );
      const reader = yield* DatabaseReader;
      const writer = yield* DatabaseWriter;
      const existing = yield* reader
        .table("featureFlagPolicies")
        .index("by_workspace_key", (q) =>
          q.eq("workspaceId", input.workspaceId).eq("key", input.key),
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie);
      const row = {
        workspaceId: input.workspaceId,
        key: input.key,
        description: input.description,
        enabled: input.enabled,
        rolloutPercent: input.rolloutPercent,
        audience: input.audience,
        ...(input.killSwitchEnv === undefined
          ? {}
          : { killSwitchEnv: input.killSwitchEnv }),
        source: "workspace" as const,
        updatedAt,
      };

      if (existing === null) {
        yield* writer
          .table("featureFlagPolicies")
          .insert(row)
          .pipe(Effect.orDie);
      } else {
        yield* writer
          .table("featureFlagPolicies")
          .patch(existing._id, row)
          .pipe(Effect.orDie);
      }

      return toPolicyReturn(row);
    }),
);

type FeatureFlagKey = (typeof defaultFeatureFlagPolicies)[number]["key"];
type FeatureFlagAudience = "everyone" | "internal" | "workspace";
type FeatureFlagPolicySeed = {
  readonly key:
    | "template.onboarding.workspaceBrief"
    | "template.workflow.liveRuns"
    | "template.billing.liveCheckout"
    | "template.notifications.center"
    | "template.ai.liveGeneration";
  readonly description: string;
  readonly enabled: boolean;
  readonly rolloutPercent: number;
  readonly audience: FeatureFlagAudience;
  readonly killSwitchEnv?: string;
};
type FeatureFlagPolicy = {
  readonly workspaceId: GenericId<"workspaces">;
  readonly key: FeatureFlagKey;
  readonly description: string;
  readonly enabled: boolean;
  readonly rolloutPercent: number;
  readonly audience: FeatureFlagAudience;
  readonly killSwitchEnv?: string | undefined;
  readonly source: "default" | "workspace";
  readonly updatedAt: number;
};

const mergePolicies = (
  workspaceId: GenericId<"workspaces">,
  overrides: readonly {
    readonly workspaceId: string;
    readonly key: FeatureFlagKey;
    readonly description: string;
    readonly enabled: boolean;
    readonly rolloutPercent: number;
    readonly audience: FeatureFlagAudience;
    readonly killSwitchEnv?: string | undefined;
    readonly source: "default" | "workspace";
    readonly updatedAt: number;
  }[],
): readonly FeatureFlagPolicy[] => {
  const overridesByKey = new Map(overrides.map((row) => [row.key, row]));

  return defaultFeatureFlagPolicies.map((policy) => {
    const override = overridesByKey.get(policy.key);

    return override === undefined
      ? {
          workspaceId,
          ...policy,
          source: "default" as const,
          updatedAt: 0,
        }
      : {
          workspaceId,
          key: override.key,
          description: override.description,
          enabled: override.enabled,
          rolloutPercent: override.rolloutPercent,
          audience: override.audience,
          ...(override.killSwitchEnv === undefined
            ? {}
            : { killSwitchEnv: override.killSwitchEnv }),
          source: "workspace" as const,
          updatedAt: override.updatedAt,
        };
  });
};

const toPolicyReturn = (policy: FeatureFlagPolicy) => ({
  workspaceId: policy.workspaceId,
  key: policy.key,
  description: policy.description,
  enabled: policy.enabled,
  rolloutPercent: policy.rolloutPercent,
  audience: policy.audience,
  ...(policy.killSwitchEnv === undefined
    ? {}
    : { killSwitchEnv: policy.killSwitchEnv }),
  source: policy.source,
  updatedAt: policy.updatedAt,
});

const evaluatePolicy = (policy: FeatureFlagPolicy, role: Role) => {
  const rolloutBucket = hashToBucket(`${policy.key}:${policy.workspaceId}`);
  // Admission is the outer authority. Existing policy state may only disable it.
  const enabled = applyFeatureFlagAfterAdmission(true, policy.enabled);

  if (!enabled) {
    return decision(policy, false, "definition-disabled", rolloutBucket);
  }

  if (!audienceAllows(policy, role)) {
    return decision(policy, false, "audience", rolloutBucket);
  }

  if (rolloutBucket >= normalizePercent(policy.rolloutPercent)) {
    return decision(policy, false, "rollout", rolloutBucket);
  }

  return decision(policy, true, "enabled", rolloutBucket);
};

const decision = (
  policy: FeatureFlagPolicy,
  enabled: boolean,
  reason: "enabled" | "definition-disabled" | "audience" | "rollout",
  rolloutBucket: number,
) => ({
  workspaceId: policy.workspaceId,
  key: policy.key,
  enabled,
  reason,
  rolloutBucket,
  source: policy.source,
});

const normalizePercent = (rolloutPercent: number): number =>
  Math.max(0, Math.min(100, Math.trunc(rolloutPercent)));

const audienceAllows = (policy: FeatureFlagPolicy, role: Role): boolean => {
  if (policy.audience === "everyone") return true;
  if (policy.audience === "workspace") return true;

  return roleAtLeast(role, "admin");
};

const hashToBucket = (input: string): number => {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
};

export default GroupImpl.make(databaseSchema, flags).pipe(
  Layer.provide(list),
  Layer.provide(evaluate),
  Layer.provide(upsertPolicyInternal),
  GroupImpl.finalize,
);
