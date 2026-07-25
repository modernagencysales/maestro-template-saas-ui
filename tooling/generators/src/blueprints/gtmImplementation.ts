import type { TemplateBlueprint } from "../customer-runtime";

export const gtmImplementationBlueprint = {
  id: "gtm-implementation",
  label: "GTM Implementation",
  summary:
    "Optional GTM implementation pack for account research, buying committee context, enrichment seams, and reporting surface seams.",
  domainNouns: [
    "account",
    "person",
    "buying committee",
    "source",
    "account brief",
    "follow-up action",
    "pipeline stage",
  ],
  sourceTypes: ["markdown", "link", "note", "crm export", "drive document"],
  defaultCapability: "buildAccountBrief",
  defaultWorkflow: "gtmAccountResearch",
  defaultAgent: "gtmImplementationPlanner",
  providerPosture: "fake-first",
  surfaces: ["web", "api", "cli", "mcp"],
  optional: true,
  providerSeams: ["crm", "drive", "notion"],
  reportingSurfaces: ["account brief", "pipeline funnel", "activity board"],
} as const satisfies TemplateBlueprint & {
  readonly optional: true;
  readonly providerSeams: readonly ["crm", "drive", "notion"];
  readonly reportingSurfaces: readonly [
    "account brief",
    "pipeline funnel",
    "activity board",
  ];
};
