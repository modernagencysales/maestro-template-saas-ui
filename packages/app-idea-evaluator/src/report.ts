import {
  dimensionKeys,
  type BuildabilityReport,
  type DimensionKey,
  type EvaluationResult,
} from "./schemas";

const labels: Record<DimensionKey, string> = {
  customerSpecificity: "a specific customer",
  problemSeverity: "a painful problem",
  problemFrequency: "frequent demand",
  existingEffortOrSpend: "proof people already spend effort",
  solutionClarity: "a clear solution",
  differentiation: "meaningful differentiation",
  feasibility: "a feasible first version",
  distribution: "a credible way to reach customers",
  monetization: "a believable revenue model",
  founderAdvantage: "your founder advantage",
  operationalRisk: "manageable operational risk",
  maestroFit: "a strong fit for an opinionated SaaS build",
};

export const buildFreeReport = (
  result: EvaluationResult,
): BuildabilityReport => {
  const ranked = [...dimensionKeys].sort(
    (left, right) =>
      result.dimensions[right].score - result.dimensions[left].score,
  );
  const strongest = ranked[0] ?? "customerSpecificity";
  const weakest = ranked.at(-1) ?? "distribution";

  return {
    verdict: result.verdict,
    overallScore: result.overallScore,
    roast: `The honest take: ${result.input.ideaName} has real ingredients, but an app idea is not a business until the weakest assumption survives contact with customers.`,
    strongestElement: `Your strongest signal is ${labels[strongest]}.`,
    biggestWeakness: `The part that needs work is ${labels[weakest]}.`,
    improvedIdea: `${result.input.ideaName}: ${result.input.solution} for ${result.input.customer}, starting with one measurable outcome.`,
    whatItWillTake: [
      `Validate ${labels[weakest]} with five real customer conversations.`,
      "Define the smallest version that proves one valuable outcome.",
      "Choose a repeatable path to the first ten customers before expanding scope.",
    ],
    exclusiveInCompleteBuildPack: [
      "Technical specification",
      "Prioritized product requirements",
      "Architecture and data model",
      "Build plan for a developer, agency, or coding agent",
      "Maestro template mapping and handoff",
    ],
  };
};
