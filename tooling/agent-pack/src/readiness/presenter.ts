import type {
  ProviderEnvironment,
  ProviderEnvironmentPosture,
} from "@maestro-template/template-core/templateInstance";
import type {
  ReceiptStaleness,
  ReceiptStalenessReason,
  VerificationReceiptSummary,
  VerificationSubject,
} from "../receipt.js";

export type ReadinessSurfaceStatus = "real" | "fake" | "seam" | "unverified";
export type ReadinessProviderEnvironment = {
  readonly environment: ProviderEnvironment;
  readonly providers: readonly {
    readonly id: string;
    readonly state: ProviderEnvironmentPosture["state"];
    readonly evidence: ProviderEnvironmentPosture["evidence"];
  }[];
};
export type BuildReadinessInput = {
  readonly app: {
    readonly name: string;
    readonly firstOutcome: string;
    readonly demoOnly: boolean;
  };
  readonly blueprint: {
    readonly id: string;
    readonly workflowSelected: boolean;
  };
  readonly recipe: null | {
    readonly id: string;
    readonly outcome: string;
    readonly automationSelected: boolean;
  };
  readonly preflight: {
    readonly worksNow: string;
    readonly demoOnly: string;
    readonly safeToStart: boolean;
    readonly diagnostics: readonly { readonly rerun: string }[];
  };
  readonly providers: readonly {
    readonly id: string;
    readonly posture: "sample" | "local" | "test" | "live" | "missing";
  }[];
  readonly providerEnvironments: readonly ReadinessProviderEnvironment[];
  readonly surfaces: readonly {
    readonly id: string;
    readonly kind: "screen" | "data" | "automation" | "connection" | "other";
    readonly status: ReadinessSurfaceStatus;
  }[];
  readonly receipt:
    | null
    | { readonly malformed: true }
    | {
        readonly subject: VerificationSubject;
        readonly createdAt: string;
        readonly status: VerificationReceiptSummary["status"];
        readonly staleness: ReceiptStaleness;
      };
};

export type BuildReadinessView = {
  readonly title: string;
  readonly firstOutcome: string;
  readonly whatWorksNow: string;
  readonly whatIsDemoOnly: string;
  readonly selection: { readonly blueprint: string; readonly recipe: string };
  readonly summary: {
    readonly screens: string;
    readonly data: string;
    readonly connections: string;
    readonly automations?: string;
  };
  readonly receipt: {
    readonly status: string;
    readonly subject: string;
    readonly verifiedAt?: string;
    readonly detail?: string;
  };
  readonly nextActions: readonly string[];
  readonly details: {
    readonly surfaces: readonly BuildReadinessInput["surfaces"][number][];
    readonly providers: readonly BuildReadinessInput["providers"][number][];
    readonly providerEnvironments: BuildReadinessInput["providerEnvironments"];
    readonly preflight: "ready" | "unverified";
  };
};

export function presentBuildReadiness(
  input: BuildReadinessInput,
): BuildReadinessView {
  const recipe = input.recipe;
  const automationSelected =
    input.blueprint.workflowSelected || recipe?.automationSelected === true;
  return {
    title: `${input.app.name} Build Readiness`,
    firstOutcome: input.app.firstOutcome,
    whatWorksNow: input.preflight.worksNow,
    whatIsDemoOnly: input.preflight.demoOnly,
    selection: {
      blueprint: input.blueprint.id,
      recipe:
        recipe === null
          ? "No recipe selected"
          : `${recipe.id}: ${recipe.outcome}`,
    },
    summary: {
      screens: input.surfaces.some(
        ({ kind, status }) =>
          kind === "screen" && (status === "real" || status === "fake"),
      )
        ? "Available"
        : "Not verified",
      data: dataSummary(input.surfaces),
      connections: connectionsSummary(input.providers),
      ...(automationSelected
        ? { automations: "Selected and review-gated" }
        : {}),
    },
    receipt: receiptSummary(input.receipt),
    nextActions: nextActions(input),
    details: {
      surfaces: input.surfaces.map((surface) => ({ ...surface })),
      providers: input.providers.map((provider) => ({ ...provider })),
      providerEnvironments: input.providerEnvironments.map(
        ({ environment, providers }) => ({
          environment,
          providers: providers.map(({ evidence, ...provider }) => ({
            ...provider,
            evidence: evidence.map(({ secretNames, ...entry }) => ({
              ...entry,
              secretNames: [...secretNames],
            })),
          })),
        }),
      ),
      preflight: input.preflight.safeToStart ? "ready" : "unverified",
    },
  };
}

function dataSummary(surfaces: BuildReadinessInput["surfaces"]): string {
  const statuses = new Set(
    surfaces.filter(({ kind }) => kind === "data").map(({ status }) => status),
  );
  if (statuses.has("real")) return "Durable data is available.";
  if (statuses.has("fake") && statuses.has("seam"))
    return "Fake data works now; local persistence is a reviewed seam.";
  if (statuses.has("fake")) return "Fake data works now.";
  return "Data is not verified.";
}

function connectionsSummary(
  providers: BuildReadinessInput["providers"],
): string {
  if (providers.length === 0) return "No provider connection selected";
  return providers
    .map(({ id, posture }) => `${display(id)}: ${providerLabel(posture)}`)
    .join("; ");
}

function providerLabel(
  posture: BuildReadinessInput["providers"][number]["posture"],
): string {
  if (posture === "sample") return "fake";
  if (posture === "missing") return "not configured";
  return posture;
}

function receiptSummary(
  receipt: BuildReadinessInput["receipt"],
): BuildReadinessView["receipt"] {
  if (receipt === null)
    return {
      status: "Not verified",
      subject: "No Maestro verification receipt",
      detail: "Run pnpm maestro -- verify --scope focused",
    };
  if ("malformed" in receipt)
    return {
      status: "Invalid",
      subject: "Malformed Maestro verification receipt",
      detail: "Run pnpm maestro -- verify --scope focused",
    };
  return {
    status: receipt.staleness.stale
      ? "Stale"
      : receipt.status === "pass"
        ? "Passed"
        : receipt.status === "pass-with-advisories"
          ? "Passed with advisories"
          : "Failed",
    subject: `${receipt.subject.commit} (${receipt.subject.dirty ? "dirty" : "clean"})`,
    verifiedAt: receipt.createdAt,
    ...(receipt.staleness.stale
      ? { detail: receipt.staleness.reasons.map(stalenessLabel).join(", ") }
      : {}),
  };
}

function nextActions(input: BuildReadinessInput): readonly string[] {
  const actions = input.preflight.diagnostics.map(({ rerun }) => rerun);
  if (actions.length === 0) actions.push("pnpm maestro -- check --mode fake");
  return [...new Set(actions)].slice(0, 3);
}

function stalenessLabel(reason: ReceiptStalenessReason): string {
  return reason.replaceAll("-", " ");
}

function display(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
