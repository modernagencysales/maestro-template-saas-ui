import type { EvaluationInput } from "./schemas";

export const fixtureInput = (
  overrides: Partial<EvaluationInput> = {},
): EvaluationInput => ({
  ideaName: "ChairFill",
  ideaSummary: "Fill cancelled dental appointments from an existing waitlist.",
  customer: "Independent dental practices with two to ten locations",
  problem: "Last-minute cancellations leave expensive chair time unused.",
  currentAlternative: "Receptionists call patients one at a time.",
  solution: "Rank and message suitable waitlist patients automatically.",
  differentiation: "Uses treatment type, travel time, and patient preferences.",
  revenueModel: "Monthly subscription per location.",
  founderAdvantage: "Managed operations for a five-location dental group.",
  constraints: ["Must integrate with common practice-management software"],
  distributionEvidence: ["Three practice owners agreed to a pilot"],
  evidence: [
    { answerId: "customer", dimension: "customerSpecificity", strength: 0.9 },
    { answerId: "problem", dimension: "problemSeverity", strength: 0.85 },
    { answerId: "frequency", dimension: "problemFrequency", strength: 0.8 },
    {
      answerId: "alternative",
      dimension: "existingEffortOrSpend",
      strength: 0.8,
    },
    { answerId: "solution", dimension: "solutionClarity", strength: 0.85 },
    { answerId: "difference", dimension: "differentiation", strength: 0.75 },
    { answerId: "feasibility", dimension: "feasibility", strength: 0.7 },
    { answerId: "distribution", dimension: "distribution", strength: 0.75 },
    { answerId: "money", dimension: "monetization", strength: 0.75 },
    { answerId: "founder", dimension: "founderAdvantage", strength: 0.9 },
    { answerId: "risk", dimension: "operationalRisk", strength: 0.65 },
    { answerId: "maestro", dimension: "maestroFit", strength: 0.8 },
  ],
  ...overrides,
});
