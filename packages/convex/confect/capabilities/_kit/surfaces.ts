import * as Schema from "effect/Schema";
import { type Surface as SurfaceType } from "./principal";
import type { PublicSurface } from "@maestro-template/template-core/publicSurface";

export const SurfacePolicy = Schema.Struct({
  web: Schema.Boolean,
  api: Schema.Boolean,
  cli: Schema.Boolean,
  mcp: Schema.Boolean,
  workflow: Schema.Boolean,
  internal: Schema.Boolean,
});

export type SurfacePolicy = Schema.Schema.Type<typeof SurfacePolicy>;

export const denyAllSurfaces: SurfacePolicy = {
  web: false,
  api: false,
  cli: false,
  mcp: false,
  workflow: false,
  internal: false,
};

export const exposeSurfaces = (
  surfaces: readonly SurfaceType[],
): SurfacePolicy => ({
  ...denyAllSurfaces,
  ...Object.fromEntries(surfaces.map((surface) => [surface, true])),
});

export const isSurfaceAllowed = (
  policy: SurfacePolicy,
  surface: SurfaceType,
): boolean => policy[surface] === true;

export const HeadlessSurface = Schema.Union([
  Schema.Literal("api"),
  Schema.Literal("cli"),
  Schema.Literal("mcp"),
]);

export type HeadlessSurface = Schema.Schema.Type<typeof HeadlessSurface>;

export const allSurfaces = [
  "web",
  "api",
  "cli",
  "mcp",
  "workflow",
  "internal",
] as const satisfies readonly SurfaceType[];

export const isActivationAdmitted = (
  surface: PublicSurface,
  journeys: Readonly<Record<string, boolean>>,
): boolean =>
  surface.activationJourneyId === undefined ||
  journeys[surface.activationJourneyId] === true;

export const applyFeatureFlagAfterAdmission = (
  admitted: boolean,
  featureFlagEnabled: boolean,
): boolean => admitted && featureFlagEnabled;

export type FeatureFlagOwnerJourney = `journey_${string}`;

export const applyFeatureFlagAfterOwnerAdmission = (
  key: string,
  featureFlagEnabled: boolean,
  journeys: Readonly<Record<string, boolean>>,
  owners: Readonly<Record<string, FeatureFlagOwnerJourney | undefined>>,
): boolean => {
  const owner = owners[key];
  return applyFeatureFlagAfterAdmission(
    owner === undefined || journeys[owner] === true,
    featureFlagEnabled,
  );
};
