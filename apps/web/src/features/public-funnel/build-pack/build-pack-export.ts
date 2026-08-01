import type { CompleteBuildPack } from "@maestro-template/app-idea-evaluator";

export const buildPackSectionIds = [
  "productBrief",
  "customerAndProblem",
  "scope",
  "requirements",
  "userJourneys",
  "dataModel",
  "architecture",
  "integrations",
  "securityAndPrivacy",
  "deliveryPlan",
  "acceptanceCriteria",
  "risks",
  "openQuestions",
] as const satisfies readonly (keyof CompleteBuildPack)[];

const labels: Readonly<Record<(typeof buildPackSectionIds)[number], string>> = {
  productBrief: "Product brief",
  customerAndProblem: "Customer and problem",
  scope: "Scope",
  requirements: "Requirements",
  userJourneys: "User journeys",
  dataModel: "Data model",
  architecture: "Architecture",
  integrations: "Integrations",
  securityAndPrivacy: "Security and privacy",
  deliveryPlan: "Delivery plan",
  acceptanceCriteria: "Acceptance criteria",
  risks: "Risks",
  openQuestions: "Open questions",
};

const renderContent = (content: string | readonly unknown[]): string =>
  Array.isArray(content)
    ? content.length === 0
      ? "None required for the first version."
      : content
          .map(
            (item) =>
              `- ${typeof item === "string" ? item : JSON.stringify(item)}`,
          )
          .join("\n")
    : String(content);

export const exportBuildPackMarkdown = (
  packId: string,
  pack: CompleteBuildPack,
): string =>
  [
    "# Complete Build Pack",
    `Pack ID: ${packId}`,
    ...buildPackSectionIds.flatMap((id) => [
      `## ${labels[id]}`,
      renderContent(pack[id]),
    ]),
  ].join("\n\n");

export const downloadBuildPack = (
  packId: string,
  pack: CompleteBuildPack,
): void => {
  const url = URL.createObjectURL(
    new Blob([exportBuildPackMarkdown(packId, pack)], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${packId}-complete-build-pack.md`;
  link.click();
  URL.revokeObjectURL(url);
};
