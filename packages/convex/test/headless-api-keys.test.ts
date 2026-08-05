import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { testConfectLayer } from "./support/confect";

describe("headless API-key actor resolution", () => {
  it("seeds and resolves the local contracts workspace", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.mutation(
        refs.internal.headless.apiKeys.seedLocalContracts,
        { keyHash: "contracts-key-hash" },
      );
      const resolved = yield* confect.query(
        refs.internal.headless.apiKeys.resolve,
        {
          keyHash: "contracts-key-hash",
          workspaceSlug: "template-demo",
          requiredScope: "workspace:write",
          nowMs: 2_000,
        },
      );
      const wrongWorkspace = yield* confect.query(
        refs.internal.headless.apiKeys.resolve,
        {
          keyHash: "contracts-key-hash",
          workspaceSlug: "another-workspace",
          requiredScope: "workspace:read",
          nowMs: 2_000,
        },
      );

      return { seeded, resolved, wrongWorkspace };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.resolved).toEqual({
      ok: true,
      keyId: result.seeded.keyId,
      workspaceId: result.seeded.workspaceId,
      userId: result.seeded.userId,
    });
    expect(result.wrongWorkspace).toEqual({
      ok: false,
      code: "API_KEY_WORKSPACE_MISMATCH",
      message: "API key is bound to a different workspace.",
    });
  });
});
