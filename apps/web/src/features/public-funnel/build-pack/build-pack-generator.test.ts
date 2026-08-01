import { describe, expect, it } from "vitest";

import {
  fixtureCompleteAnswers,
  makeEvaluation,
} from "../intake/evaluation-adapter";
import { compileFakeBuildPack } from "./build-pack-generator";

describe("deterministic fake Build Pack compiler", () => {
  it("produces the complete canonical artifact for paid browser journeys", () => {
    const pack = compileFakeBuildPack(makeEvaluation(fixtureCompleteAnswers));

    expect(pack.productBrief).toContain("ChairFill");
    expect(pack.requirements.length).toBeGreaterThanOrEqual(5);
    expect(pack.userJourneys.length).toBeGreaterThanOrEqual(3);
    expect(pack.dataModel.length).toBeGreaterThanOrEqual(3);
    expect(pack.deliveryPlan.length).toBeGreaterThanOrEqual(3);
    expect(pack.acceptanceCriteria.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps uncited competitor claims out of the fake artifact", () => {
    expect(
      compileFakeBuildPack(makeEvaluation(fixtureCompleteAnswers))
        .competitorClaims,
    ).toEqual([]);
  });
});
