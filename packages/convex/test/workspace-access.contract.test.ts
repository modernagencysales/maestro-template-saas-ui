import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { MemberNotInWorkspace } from "../confect/errors";
import { SeededTenancy, seedTenancy } from "./support/seedTenancy";
import { testConfectLayer } from "./support/confect";

const now = 1_782_924_800_000;

describe("workspace access resolver through brain pages", () => {
  it("allows an active editor to create a page and rejects an outsider", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect<typeof databaseSchema>();
      const seeded = yield* confect.run(seedTenancy(now), SeededTenancy);
      const pageId = yield* confect
        .withIdentity({
          subject: "member-subject",
          email: "member@example.com",
        })
        .mutation(refs.public.brain.pages.createMarkdown, {
          workspaceId: seeded.workspaceId,
          slug: "member-note",
          title: "Member Note",
          markdown: "# ok",
        });
      const outsiderError = yield* confect
        .withIdentity({
          subject: "outsider-subject",
          email: "outsider@example.com",
        })
        .mutation(refs.public.brain.pages.createMarkdown, {
          workspaceId: seeded.workspaceId,
          slug: "outsider-note",
          title: "Outsider Note",
          markdown: "# nope",
        })
        .pipe(Effect.flip);

      return { pageId, outsiderError };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );

    expect(result.pageId).toEqual(expect.stringContaining("brainPages"));
    expect(result.outsiderError).toBeInstanceOf(MemberNotInWorkspace);
  });
});
