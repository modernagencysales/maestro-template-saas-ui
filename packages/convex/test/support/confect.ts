import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import databaseSchema from "../../confect/_generated/schema";
import convexSchema from "../../confect/_generated/convexSchema";

export const testConfectLayer = TestConfect.layer(
  databaseSchema,
  convexSchema,
  import.meta.glob([
    "../../convex/**/*.{ts,js}",
    // Declaration modules are not executable and collide with their generated
    // runtime siblings after convex-test removes the final extension.
    "!../../convex/**/*.d.ts",
  ]),
);

export const withTestConfect = <A, E>(
  effect: Effect.Effect<A, E, TestConfect.TestConfect<typeof databaseSchema>>,
): Effect.Effect<A, E> => effect.pipe(Effect.provide(testConfectLayer()));

export const withTestConfectLayer = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, never, never>,
): Effect.Effect<A, E> => effect.pipe(Effect.provide(layer));
