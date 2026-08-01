import { describe, expect, it } from "vitest";

import buildPackEntitlements from "../confect/tables/buildPackEntitlements";
import buildPackExports from "../confect/tables/buildPackExports";
import buildPacks from "../confect/tables/buildPacks";
import buildPackStages from "../confect/tables/buildPackStages";
import checkoutSessions from "../confect/tables/checkoutSessions";
import evaluationAnswers from "../confect/tables/evaluationAnswers";
import evaluationReports from "../confect/tables/evaluationReports";
import evaluationReportVersions from "../confect/tables/evaluationReportVersions";
import evaluationSessions from "../confect/tables/evaluationSessions";
import evaluationShares from "../confect/tables/evaluationShares";
import maestroCredits from "../confect/tables/maestroCredits";
import purchases from "../confect/tables/purchases";
import supportIncidents from "../confect/tables/supportIncidents";

describe("app idea funnel durable table owners", () => {
  it("defines one durable owner for every funnel concept", () => {
    expect(
      Object.values({
        evaluationSessions,
        evaluationShares,
        evaluationAnswers,
        evaluationReports,
        evaluationReportVersions,
        checkoutSessions,
        purchases,
        buildPackEntitlements,
        maestroCredits,
        buildPacks,
        buildPackStages,
        buildPackExports,
        supportIncidents,
      }),
    ).not.toContain(undefined);
  });
});
