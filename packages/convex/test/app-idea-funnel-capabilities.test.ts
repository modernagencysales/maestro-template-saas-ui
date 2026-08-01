import { TestConfect } from "@confect/test";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";
import databaseSchema from "../confect/_generated/schema";
import { Unauthorized } from "../confect/errors";
import { testConfectLayer } from "./support/confect";

const answers = {
  ideaSummary: "A useful app",
  customer: "Dental groups",
  problem: "Cancelled chair time",
  currentAlternative: "Manual phone calls",
  solution: "Automated waitlist matching",
  differentiation: "Matches treatment constraints",
  distributionEvidence: "Three pilot practices",
  founderContext: "Former operator",
};

describe("app-idea funnel durable capabilities", () => {
  it("persists one report idempotently and rejects a different access token", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      const first = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        { sessionId: "session_1", accessToken: "token_1", answers },
      );
      const replay = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        { sessionId: "session_1", accessToken: "token_1", answers },
      );
      const unauthorized = yield* confect
        .mutation(refs.public.capabilities.evaluateAppIdea.evaluateAppIdea, {
          sessionId: "session_1",
          accessToken: "wrong_token",
          answers,
        })
        .pipe(Effect.flip);
      return { first, replay, unauthorized };
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.replay).toEqual(result.first);
    expect(result.first).toMatchObject({ status: "completed", version: 1 });
    expect(result.unauthorized).toBeInstanceOf(Unauthorized);
  });

  it("publishes only a stored snapshot and makes it unavailable after revocation", async () => {
    const program = Effect.gen(function* () {
      const confect = yield* Effect.serviceOptional(
        TestConfect.TestConfect<typeof databaseSchema>(),
      );
      const evaluated = yield* confect.mutation(
        refs.public.capabilities.evaluateAppIdea.evaluateAppIdea,
        { sessionId: "share_session", accessToken: "share_owner", answers },
      );
      const shared = yield* confect.mutation(
        refs.public.capabilities.manageEvaluationReport.manageEvaluationReport,
        {
          reportId: evaluated.reportId,
          accessToken: "share_owner",
          action: "share",
        },
      );
      const visible = yield* confect.query(
        refs.public.capabilities.manageEvaluationReport
          .getSharedEvaluationReport,
        { shareToken: shared.shareToken ?? "" },
      );
      yield* confect.mutation(
        refs.public.capabilities.manageEvaluationReport.manageEvaluationReport,
        {
          reportId: evaluated.reportId,
          accessToken: "share_owner",
          action: "revoke-share",
        },
      );
      const revoked = yield* confect.query(
        refs.public.capabilities.manageEvaluationReport
          .getSharedEvaluationReport,
        { shareToken: shared.shareToken ?? "" },
      );
      return { shared, visible, revoked };
    });
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(testConfectLayer())),
    );
    expect(result.shared.shareToken).toMatch(/^share_/);
    expect(result.visible).toMatchObject({ reportVersion: 1 });
    expect(result.visible?.publicSnapshotJson).not.toContain("share_owner");
    expect(result.visible?.publicSnapshotJson).not.toContain("share_session");
    expect(result.revoked).toBeNull();
  });
});
