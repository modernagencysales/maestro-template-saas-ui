import * as Schema from "effect/Schema";

export type PublicSurface = {
  readonly id: string;
  readonly transport: "ui" | "cli" | "api" | "mcp" | "webhook";
  readonly coverageTag: `@covers_${string}`;
  readonly activationJourneyId?: `journey_${string}`;
  readonly authPolicyId: `auth_${string}`;
  readonly authority: {
    readonly kind:
      | "route"
      | "ui-action"
      | "convex-function"
      | "http-route"
      | "command"
      | "trigger"
      | "webhook";
    readonly registrationLocator: string;
    readonly actionDiscriminant?: string;
  };
};

const nonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)));
const coverageTag = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^@covers_.+$/u)),
);
const journeyId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^journey_.+$/u)),
);
const authPolicyId = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^auth_.+$/u)),
);

export const PublicSurface = Schema.Struct({
  id: nonEmptyString,
  transport: Schema.Literals(["ui", "cli", "api", "mcp", "webhook"]),
  coverageTag,
  activationJourneyId: Schema.optional(journeyId),
  authPolicyId,
  authority: Schema.Struct({
    kind: Schema.Literals([
      "route",
      "ui-action",
      "convex-function",
      "http-route",
      "command",
      "trigger",
      "webhook",
    ]),
    registrationLocator: nonEmptyString,
    actionDiscriminant: Schema.optional(nonEmptyString),
  }),
});

export const publicSurfaceAuthorityKey = (surface: PublicSurface): string =>
  JSON.stringify([
    surface.authority.kind,
    surface.authority.registrationLocator,
    surface.authority.actionDiscriminant ?? null,
    surface.transport,
    surface.authPolicyId,
  ]);

const duplicatesBy = (
  surfaces: readonly PublicSurface[],
  key: (surface: PublicSurface) => string,
): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const surface of surfaces) {
    const value = key(surface);
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
};

export const duplicatePublicSurfaceIds = (
  surfaces: readonly PublicSurface[],
): readonly string[] => duplicatesBy(surfaces, (surface) => surface.id);

export const duplicatePublicSurfaceAuthorityKeys = (
  surfaces: readonly PublicSurface[],
): readonly string[] => duplicatesBy(surfaces, publicSurfaceAuthorityKey);
