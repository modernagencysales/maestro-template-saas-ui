import {
  validateCompleteBuildPack,
  type CompleteBuildPack,
} from "@maestro-template/app-idea-evaluator";

import type { StoredEvaluation } from "../intake/evaluation-adapter";

export const compileFakeBuildPack = (
  evaluation: StoredEvaluation,
): CompleteBuildPack => {
  const { answers } = evaluation;

  return validateCompleteBuildPack({
    productBrief: `${answers.ideaSummary} It is designed for ${answers.customer}`,
    customerAndProblem: `${answers.customer} need a better way to handle ${answers.problem.toLowerCase()}`,
    scope: [
      "A focused first release for one customer segment",
      "The core cancellation-to-booking workflow",
      "Operational controls and measurable outcomes",
    ],
    requirements: [
      `Capture the operating context for ${answers.customer}`,
      `Support the core solution: ${answers.solution}`,
      "Let an operator review and correct automated decisions",
      "Record every material state change with a timestamp",
      "Report whether the workflow improves the stated customer problem",
    ],
    userJourneys: [
      "An operator configures the product for their practice.",
      "An operator runs the core workflow and reviews the result.",
      "A manager checks outcomes and resolves exceptions.",
    ],
    dataModel: [
      "Organization — the customer account and operating settings",
      "User — a person with a role inside an organization",
      "Workflow record — the durable state and history of one core outcome",
    ],
    architecture:
      "A responsive web application with authenticated organization data, durable workflow state, background jobs, and provider adapters behind server-only boundaries.",
    integrations: [
      "Authentication and organization membership",
      "Transactional notifications",
      "Product analytics with content-free events",
    ],
    securityAndPrivacy: [
      "Keep each organization's records isolated",
      "Never place customer content in analytics events",
      "Use least-privilege server credentials for provider calls",
    ],
    deliveryPlan: [
      "Phase 1 — validate the workflow with a clickable prototype and pilot users",
      "Phase 2 — build the core workflow, organization model, and operator controls",
      "Phase 3 — harden integrations, analytics, accessibility, and launch operations",
    ],
    acceptanceCriteria: [
      "A new customer can reach the first useful outcome without developer help.",
      "The core workflow has explicit loading, empty, success, and failure states.",
      "Users cannot read or change another organization's records.",
      "Every provider failure is recoverable or gives a clear support path.",
      "The primary workflow works with a keyboard at desktop and mobile widths.",
    ],
    risks: [
      `Differentiation must be validated: ${answers.differentiation}`,
      `Distribution evidence is still limited: ${answers.distributionEvidence}`,
    ],
    openQuestions: [
      "What single outcome will make a pilot customer pay?",
      "Which exception needs a human approval step in version one?",
      "What data must be imported before a customer can start?",
    ],
    competitorClaims: [],
  });
};
