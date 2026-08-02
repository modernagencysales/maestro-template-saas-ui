import * as Schema from "effect/Schema";
import { type Surface as SurfaceType } from "./principal";

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
