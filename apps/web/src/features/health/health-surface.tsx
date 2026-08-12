import {
  providerConfigReport,
  type ProviderMode,
} from "@maestro-template/integrations";
type HealthCheck = {
  readonly label: string;
  readonly status: "ready" | "degraded" | "blocked";
};

export type TemplateHealthEnvironment = "fake" | "test" | "live";

export type TemplateHealthReportValue = {
  readonly ok: boolean;
  readonly service: "maestro-template";
  readonly environment: TemplateHealthEnvironment;
  readonly commitSha: string;
  readonly checkedAt: number;
  readonly checks: readonly {
    readonly id: string;
    readonly status: "pass" | "warn" | "fail";
    readonly detail: string;
  }[];
};

export type HealthBoardCheck = HealthCheck & {
  readonly detail: string;
};

export type HealthBoardView = {
  readonly state: "ready" | "empty" | "loading" | "error";
  readonly checks: readonly HealthBoardCheck[];
  readonly summary: {
    readonly ready: number;
    readonly degraded: number;
    readonly blocked: number;
  };
  readonly checkedAt: string;
  readonly commitSha: string;
};

export const buildTemplateHealthReport = (input: {
  readonly environment: TemplateHealthEnvironment;
  readonly commitSha: string;
  readonly checkedAt: number;
}): TemplateHealthReportValue => {
  const checks: TemplateHealthReportValue["checks"] = [
    { id: "runtime", status: "pass", detail: "process is responsive" },
    { id: "confect", status: "pass", detail: "health group registered" },
    input.environment === "fake"
      ? {
          id: "providers",
          status: "pass",
          detail: "fake providers do not require live secrets",
        }
      : {
          id: "providers",
          status: "warn",
          detail: "verify provider credentials through deploy doctor",
        },
  ];

  return {
    ok: checks.every((check) => check.status !== "fail"),
    service: "maestro-template",
    environment: input.environment,
    commitSha: input.commitSha,
    checkedAt: input.checkedAt,
    checks,
  };
};

export const buildHealthBoardView = ({
  env,
  mode,
  report,
}: {
  readonly env: Record<string, string | undefined>;
  readonly mode: ProviderMode;
  readonly report: TemplateHealthReportValue;
}): HealthBoardView => {
  const checks = [
    ...report.checks.map((check) => ({
      label: titleCaseId(check.id),
      status: healthStatusToBoardStatus(check.status),
      detail: check.detail,
    })),
    ...providerConfigReport(mode, env).map((provider) => ({
      label: provider.displayName,
      status: providerReadyStatus(provider.ready),
      detail: provider.ready
        ? `${provider.displayName} is ${mode}-mode ready.`
        : providerGapDetail(provider.missingEnv, provider.invalidEnv),
    })),
  ] satisfies readonly HealthBoardCheck[];

  return {
    state: checks.length === 0 ? "empty" : "ready",
    checks,
    summary: {
      ready: checks.filter((check) => check.status === "ready").length,
      degraded: checks.filter((check) => check.status === "degraded").length,
      blocked: checks.filter((check) => check.status === "blocked").length,
    },
    checkedAt: new Date(report.checkedAt).toISOString(),
    commitSha: report.commitSha,
  };
};

export function HealthSurface() {
  const view = buildHealthBoardView({
    mode: "fake",
    env: {},
    report: buildTemplateHealthReport({
      environment: "fake",
      commitSha: "local",
      checkedAt: Date.now(),
    }),
  });

  return (
    <section aria-label="Template health" className="template-health-surface">
      <header className="template-health-header">
        <div>
          <h2>Readiness board</h2>
          <p>
            Fake mode proves route, provider, and contract posture without live
            credentials.
          </p>
        </div>
        <dl>
          <div>
            <dt>Ready</dt>
            <dd>{view.summary.ready}</dd>
          </div>
          <div>
            <dt>Degraded</dt>
            <dd>{view.summary.degraded}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd>{view.summary.blocked}</dd>
          </div>
        </dl>
      </header>
      <ul aria-label="Health checks">
        {view.checks.map((check) => (
          <li key={check.label} data-status={check.status}>
            <strong>{check.label}</strong>: {check.detail}
          </li>
        ))}
      </ul>
      <p className="template-health-footnote">
        Checked {view.checkedAt} at {view.commitSha}. Run deploy doctor in a
        client fork before promoting live providers.
      </p>
    </section>
  );
}

const healthStatusToBoardStatus = (
  status: TemplateHealthReportValue["checks"][number]["status"],
): HealthCheck["status"] =>
  status === "pass" ? "ready" : status === "warn" ? "degraded" : "blocked";

const providerReadyStatus = (ready: boolean): HealthCheck["status"] =>
  ready ? "ready" : "blocked";

const titleCaseId = (id: string): string =>
  id
    .split(/[-_]/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

const providerGapDetail = (
  missingEnv: readonly string[],
  invalidEnv: readonly string[],
): string => {
  const missing = missingEnv.length === 0 ? "none" : missingEnv.join(", ");
  const invalid = invalidEnv.length === 0 ? "none" : invalidEnv.join(", ");

  return `Missing ${missing}; invalid ${invalid}.`;
};
