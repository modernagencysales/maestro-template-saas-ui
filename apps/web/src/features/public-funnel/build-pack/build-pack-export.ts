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
  "competitorClaims",
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
  competitorClaims: "Market research",
  securityAndPrivacy: "Security and privacy",
  deliveryPlan: "Delivery plan",
  acceptanceCriteria: "Acceptance criteria",
  risks: "Risks",
  openQuestions: "Open questions",
};

const renderContent = (
  id: (typeof buildPackSectionIds)[number],
  content: string | readonly unknown[],
): string => {
  if (id === "competitorClaims") {
    const claims = content as CompleteBuildPack["competitorClaims"];
    return (
      claims
        .map(
          (claim) =>
            `- ${claim.text}\n  Sources:\n${claim.citations.map((citation) => `  - ${citation}`).join("\n")}`,
        )
        .join("\n") || "No researched competitor claims."
    );
  }
  return Array.isArray(content)
    ? content.length === 0
      ? "None required for the first version."
      : content
          .map(
            (item) =>
              `- ${typeof item === "string" ? item : JSON.stringify(item)}`,
          )
          .join("\n")
    : String(content);
};

export const exportBuildPackMarkdown = (
  packId: string,
  pack: CompleteBuildPack,
): string =>
  [
    "# Complete Build Pack",
    `Pack ID: ${packId}`,
    ...buildPackSectionIds.flatMap((id) => [
      `## ${labels[id]}`,
      renderContent(id, pack[id]),
    ]),
  ].join("\n\n");

const escapeHtml = (value: unknown): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderHtmlContent = (
  id: (typeof buildPackSectionIds)[number],
  content: string | readonly unknown[],
): string => {
  if (id === "competitorClaims") {
    const claims = content as CompleteBuildPack["competitorClaims"];
    if (claims.length === 0) return "<p>No researched competitor claims.</p>";
    return `<ul>${claims
      .map(
        (claim) =>
          `<li><p>${escapeHtml(claim.text)}</p><p>Sources:</p><ul>${claim.citations
            .map((citation) => `<li>${escapeHtml(citation)}</li>`)
            .join("")}</ul></li>`,
      )
      .join("")}</ul>`;
  }
  if (!Array.isArray(content)) return `<p>${escapeHtml(content)}</p>`;
  if (content.length === 0)
    return "<p>None required for the first version.</p>";
  return `<ul>${content
    .map(
      (item) =>
        `<li>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</li>`,
    )
    .join("")}</ul>`;
};

export const exportBuildPackPrintHtml = (
  packId: string,
  pack: CompleteBuildPack,
): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Complete Build Pack · ${escapeHtml(packId)}</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { color: #171717; margin: 0 auto; max-width: 52rem; padding: 3rem 1.5rem; }
    h1 { font-size: 2rem; } h2 { break-after: avoid; margin-top: 2rem; }
    li, p { line-height: 1.55; } .pack-id { color: #525252; }
    @media print { body { max-width: none; padding: 0; } section { break-inside: avoid; } }
  </style>
</head>
<body>
  <header><h1>Complete Build Pack</h1><p class="pack-id">Pack ID: ${escapeHtml(packId)}</p></header>
  ${buildPackSectionIds
    .map(
      (id) =>
        `<section id="pack-${id}"><h2>${labels[id]}</h2>${renderHtmlContent(id, pack[id])}</section>`,
    )
    .join("\n  ")}
</body>
</html>`;

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

export const downloadBuildPackPrintHtml = (
  packId: string,
  pack: CompleteBuildPack,
): void => {
  const url = URL.createObjectURL(
    new Blob([exportBuildPackPrintHtml(packId, pack)], {
      type: "text/html;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${packId}-complete-build-pack.html`;
  link.click();
  URL.revokeObjectURL(url);
};
