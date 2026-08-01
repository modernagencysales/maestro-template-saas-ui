import * as Schema from "effect/Schema";

export type FeatureFlagKey =
  | "template.onboarding.workspaceBrief"
  | "template.workflow.liveRuns"
  | "template.billing.liveCheckout"
  | "template.notifications.center"
  | "template.ai.liveGeneration";

export type FeatureFlagAudience = "everyone" | "internal" | "workspace";

export type FeatureFlagDefinition = {
  readonly key: FeatureFlagKey;
  readonly description: string;
  readonly enabled: boolean;
  readonly rolloutPercent: number;
  readonly audience: FeatureFlagAudience;
  readonly killSwitchEnv?: string;
};

export type FeatureFlagContext = {
  readonly workspaceSlug: string;
  readonly userEmail?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type FeatureFlagDecision = {
  readonly key: FeatureFlagKey;
  readonly enabled: boolean;
  readonly reason:
    "enabled" | "definition-disabled" | "kill-switch" | "audience" | "rollout";
  readonly rolloutBucket: number;
};

export class FeatureFlagConfigError extends Schema.TaggedErrorClass<FeatureFlagConfigError>()(
  "FeatureFlagConfigError",
  {
    key: Schema.String,
    publicMessage: Schema.String,
  },
) {}

export const defaultFeatureFlags = [
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
] as const satisfies readonly FeatureFlagDefinition[];

const normalizePercent = (rolloutPercent: number): number =>
  Math.max(0, Math.min(100, Math.trunc(rolloutPercent)));

const hashToBucket = (input: string): number => {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
};

const envSwitchOn = (
  env: Readonly<Record<string, string | undefined>> | undefined,
  name: string | undefined,
): boolean => {
  if (!name) return false;

  return env?.[name]?.trim().toLowerCase() === "true";
};

const audienceAllows = (
  definition: FeatureFlagDefinition,
  context: FeatureFlagContext,
): boolean => {
  if (definition.audience === "everyone") return true;
  if (definition.audience === "workspace") return context.workspaceSlug !== "";

  return context.userEmail?.endsWith("@example.test") ?? false;
};

export const validateFeatureFlagDefinition = (
  definition: FeatureFlagDefinition,
): true | FeatureFlagConfigError => {
  if (definition.rolloutPercent < 0 || definition.rolloutPercent > 100) {
    return new FeatureFlagConfigError({
      key: definition.key,
      publicMessage: "Feature flag rolloutPercent must be between 0 and 100.",
    });
  }

  if (!definition.description.trim()) {
    return new FeatureFlagConfigError({
      key: definition.key,
      publicMessage: "Feature flag description is required.",
    });
  }

  return true;
};

export const evaluateFeatureFlag = (
  definition: FeatureFlagDefinition,
  context: FeatureFlagContext,
): FeatureFlagDecision | FeatureFlagConfigError => {
  const validation = validateFeatureFlagDefinition(definition);
  if (validation !== true) return validation;

  const rolloutBucket = hashToBucket(
    `${definition.key}:${context.workspaceSlug}`,
  );

  if (envSwitchOn(context.env, definition.killSwitchEnv)) {
    return {
      key: definition.key,
      enabled: false,
      reason: "kill-switch",
      rolloutBucket,
    };
  }

  if (!definition.enabled) {
    return {
      key: definition.key,
      enabled: false,
      reason: "definition-disabled",
      rolloutBucket,
    };
  }

  if (!audienceAllows(definition, context)) {
    return {
      key: definition.key,
      enabled: false,
      reason: "audience",
      rolloutBucket,
    };
  }

  if (rolloutBucket >= normalizePercent(definition.rolloutPercent)) {
    return {
      key: definition.key,
      enabled: false,
      reason: "rollout",
      rolloutBucket,
    };
  }

  return {
    key: definition.key,
    enabled: true,
    reason: "enabled",
    rolloutBucket,
  };
};

export const evaluateFeatureFlags = (
  definitions: readonly FeatureFlagDefinition[],
  context: FeatureFlagContext,
): readonly (FeatureFlagDecision | FeatureFlagConfigError)[] =>
  definitions.map((definition) => evaluateFeatureFlag(definition, context));

export const featureFlagReadinessReport = ({
  context,
  definitions = defaultFeatureFlags,
}: {
  readonly context: FeatureFlagContext;
  readonly definitions?: readonly FeatureFlagDefinition[];
}) => {
  const decisions = evaluateFeatureFlags(definitions, context);

  return {
    total: decisions.length,
    enabled: decisions.filter(
      (decision) =>
        !(decision instanceof FeatureFlagConfigError) && decision.enabled,
    ).length,
    blockedByKillSwitch: decisions.filter(
      (decision) =>
        !(decision instanceof FeatureFlagConfigError) &&
        decision.reason === "kill-switch",
    ).length,
    invalid: decisions.filter(
      (decision) => decision instanceof FeatureFlagConfigError,
    ).length,
    decisions,
  };
};
