import { Check, Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@saas-ui/react";

import type {
  BuildPackStage,
  CompleteBuildPack,
} from "@maestro-template/app-idea-evaluator";
import { useFunnelAnalytics } from "../../../providers/posthog";
import { PublicFunnelShell } from "../public-shell";
import {
  buildPackSectionIds,
  downloadBuildPack,
  downloadBuildPackPrintHtml,
} from "./build-pack-export";

const stageLabels = {
  normalize: "Product brief",
  challenge: "Assumptions review",
  research: "Market research",
  design: "Product design",
  specify: "Requirements",
  review: "Quality review",
  compile: "Build Pack",
  "map-to-maestro": "Maestro mapping",
} as const;

export function BuildPackProgress({
  packId,
  stages,
}: {
  readonly packId: string;
  readonly stages: readonly Pick<
    BuildPackStage,
    "name" | "status" | "attempts"
  >[];
}) {
  return (
    <PublicFunnelShell>
      <main className="idea-pack-progress" id="main-content">
        <p className="idea-section-label">Complete Build Pack · {packId}</p>
        <h1>Turning your idea into a build-ready plan.</h1>
        <ol>
          {stages.map((stage) => (
            <li key={stage.name} data-status={stage.status}>
              {stage.status === "completed" ? (
                <Check aria-hidden="true" size={18} />
              ) : stage.status === "failed-recoverable" ? (
                <RefreshCw aria-hidden="true" size={18} />
              ) : (
                <span aria-hidden="true" />
              )}
              <div>
                <strong>{stageLabels[stage.name]}</strong>
                <p>
                  {stage.status === "completed"
                    ? `${stageLabels[stage.name]} complete`
                    : stage.status === "failed-recoverable"
                      ? `Retry ${stageLabels[stage.name].toLowerCase()}`
                      : stage.status === "running"
                        ? "In progress"
                        : "Waiting"}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p role="status">
          Completed sections stay saved if a later stage retries.
        </p>
      </main>
    </PublicFunnelShell>
  );
}

const packSections = [
  ["Product brief", "productBrief"],
  ["Customer and problem", "customerAndProblem"],
  ["Scope", "scope"],
  ["Requirements", "requirements"],
  ["User journeys", "userJourneys"],
  ["Data model", "dataModel"],
  ["Architecture", "architecture"],
  ["Integrations", "integrations"],
  ["Market research", "competitorClaims"],
  ["Security and privacy", "securityAndPrivacy"],
  ["Delivery plan", "deliveryPlan"],
  ["Acceptance criteria", "acceptanceCriteria"],
  ["Risks", "risks"],
  ["Open questions", "openQuestions"],
] as const;

export const buildPackViewSectionIds = buildPackSectionIds;

export function CompleteBuildPackView({
  packId,
  pack,
}: {
  readonly packId: string;
  readonly pack: CompleteBuildPack;
}) {
  const capture = useFunnelAnalytics();
  return (
    <PublicFunnelShell>
      <main className="idea-complete-pack" id="main-content">
        <header>
          <div>
            <p className="idea-section-label">Complete Build Pack</p>
            <h1>Your idea is ready to hand off.</h1>
          </div>
          <div className="idea-pack-downloads">
            <Button
              onClick={() => {
                capture({
                  name: "build_pack_exported",
                  packId,
                  format: "markdown",
                });
                downloadBuildPack(packId, pack);
              }}
              type="button"
            >
              <Download aria-hidden="true" size={17} />
              Download Build Pack
            </Button>
            <Button
              onClick={() => {
                capture({
                  name: "build_pack_exported",
                  packId,
                  format: "print-html",
                });
                downloadBuildPackPrintHtml(packId, pack);
              }}
              type="button"
            >
              <FileText aria-hidden="true" size={17} />
              Download print-ready HTML
            </Button>
          </div>
        </header>
        {packSections.map(([label, key]) => {
          if (key === "competitorClaims") {
            return (
              <section id="pack-competitorClaims" key={key}>
                <h2>{label}</h2>
                {pack.competitorClaims.length > 0 ? (
                  <ul>
                    {pack.competitorClaims.map((claim) => (
                      <li key={claim.text}>
                        <p>{claim.text}</p>
                        <p>Sources</p>
                        <ul>
                          {claim.citations.map((citation) => (
                            <li key={citation}>
                              {/^https?:\/\//u.test(citation) ? (
                                <a href={citation}>{citation}</a>
                              ) : (
                                citation
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No researched competitor claims.</p>
                )}
              </section>
            );
          }
          const content = pack[key] as string | readonly string[];
          return (
            <section id={`pack-${key}`} key={key}>
              <h2>{label}</h2>
              {Array.isArray(content) ? (
                content.length > 0 ? (
                  <ul>
                    {content.map((item) => (
                      <li
                        key={
                          typeof item === "string" ? item : JSON.stringify(item)
                        }
                      >
                        {typeof item === "string" ? item : JSON.stringify(item)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>None required for the first version.</p>
                )
              ) : (
                <p>{content}</p>
              )}
            </section>
          );
        })}
        <section className="idea-maestro-next-step">
          <p className="idea-section-label">Optional next step</p>
          <h2>Want a head start on the build?</h2>
          <p>
            See whether this product is an honest fit for the Maestro SaaS
            template. Your Build Pack stays portable either way.
          </p>
          <a href={`/maestro/${packId}`}>See how Maestro could build this</a>
        </section>
        <p className="idea-pack-id">Pack ID: {packId}</p>
      </main>
    </PublicFunnelShell>
  );
}
