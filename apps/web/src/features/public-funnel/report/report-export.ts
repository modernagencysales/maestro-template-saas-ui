import type { StoredEvaluation } from "../intake/evaluation-adapter";

export const reportAsMarkdown = (evaluation: StoredEvaluation): string => {
  const { report, result } = evaluation;
  return `# App idea Buildability Report

## Verdict

${report.verdict} — ${String(report.overallScore)}/100

${report.roast}

## Strongest element

${report.strongestElement}

## Biggest weakness

${report.biggestWeakness}

## A stronger version of the idea

${report.improvedIdea}

## What it will take

${report.whatItWillTake.map((item) => `- ${item}`).join("\n")}

## Evidence scores

${Object.entries(result.dimensions)
  .map(([key, value]) => `- ${key}: ${String(value.score)}/100`)
  .join("\n")}
`;
};

export const downloadReport = (evaluation: StoredEvaluation): void => {
  const blob = new Blob([reportAsMarkdown(evaluation)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${evaluation.id}-buildability-report.md`;
  anchor.click();
  URL.revokeObjectURL(url);
};
