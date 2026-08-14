import type { ProviderAdapter } from "@maestro-template/template-core";
import type { OnboardingStep } from "@maestro-template/ui";
import type { CreateToasterReturn } from "@saas-ui/react/toaster";

export type SetupDocumentSection = {
  readonly heading: string;
  readonly body: readonly string[];
};

export type SetupMode = "fake" | "test" | "live";

export type OnboardingChecklistOptions = {
  readonly mode: SetupMode;
  readonly presentEnv?: readonly string[];
};

export type OnboardingContinueToastOptions = {
  readonly mode: SetupMode;
  readonly steps: readonly OnboardingStep[];
};

export const requiredLiveProviderEnv = [
  "WORKOS_API_KEY",
  "POSTHOG_PROJECT_TOKEN",
  "DODO_API_KEY",
  "POSTMARK_SERVER_TOKEN",
  "OPENROUTER_API_KEY",
] as const;

export const missingLiveProviderEnv = (
  presentEnv: readonly string[] = [],
): readonly string[] =>
  requiredLiveProviderEnv.filter((envName) => !presentEnv.includes(envName));

export const buildProviderSetupDocumentSections = (
  adapters: readonly ProviderAdapter[],
): readonly SetupDocumentSection[] => {
  const adapterLine = (name: string): string => {
    const adapter = adapters.find((candidate) => candidate.name === name);

    if (!adapter) {
      return `**${name}** is not configured yet.`;
    }

    return `**${adapter.name}** stays behind the ${adapter.mode} adapter and is currently ${adapter.status}.`;
  };

  return [
    {
      heading: "Workspace setup",
      body: [
        "Every client fork starts by creating a workspace, selecting fake/local providers, and confirming tenant identity is server-derived.",
        "The template should work in diligence and demo mode without live customer secrets.",
      ],
    },
    {
      heading: "Provider posture",
      body: [
        adapterLine("WorkOS/AuthKit"),
        adapterLine("PostHog"),
        adapterLine("Storage"),
        adapterLine("OpenRouter"),
      ],
    },
    {
      heading: "Billing and credits",
      body: [
        "**Dodo** starts in billing fake first mode so demos and tests do not need live payment secrets.",
        "Client forks can replace deterministic checkout and credit receipts with live Dodo calls after sandbox signoff.",
      ],
    },
    {
      heading: "Email and notifications",
      body: [
        "**Email** starts in fake mode and uses Postmark in live mode after sender and webhook verification.",
        "Transactional templates use the outbound stream; opted-in marketing uses broadcast with one-click unsubscribe.",
      ],
    },
    {
      heading: "Deploy readiness",
      body: [
        "Run local tests, hosted browser smoke, Confect contract checks, provider readiness checks, and secret scans before client handoff.",
        "Production promotion should stay manual until the client fork has live provider signoff, rollout flags, and kill switches.",
      ],
    },
  ];
};

export const buildOnboardingDocumentSections =
  (): readonly SetupDocumentSection[] => [
    {
      heading: "Workspace",
      body: [
        "- Create or confirm the client workspace.",
        "- Decide whether this is a demo, diligence, pilot, or production fork.",
        "- Keep tenant identity server-derived from the beginning.",
      ],
    },
    {
      heading: "Brain",
      body: [
        "- Import markdown, links, notes, and approved source lists.",
        "- Mark source content as data, not instructions.",
        "- Build the first context pack before adding optional RAG.",
      ],
    },
    {
      heading: "Capabilities and workflows",
      body: [
        "- Add the first capability with typed args, typed returns, typed failures, and policy.",
        "- Compose it into a workflow with explicit approval and evidence points.",
        "- Keep React Flow as the inspection/authoring layer, not the durable source of truth.",
      ],
    },
    {
      heading: "Launch checks",
      body: [
        "- Run browser smoke, app tests, Confect contract checks, and deploy readiness checks before handoff.",
        "- Confirm WorkOS, PostHog, Dodo, email, storage, and model provider posture.",
        "- Confirm feature flags and kill switches before enabling live billing, notifications, or model calls.",
        "- Save a Trust Receipt for the first meaningful workflow run.",
      ],
    },
  ];

export const buildOnboardingChecklistSteps = ({
  mode,
  presentEnv = [],
}: OnboardingChecklistOptions): readonly OnboardingStep[] => {
  const missingEnv = missingLiveProviderEnv(presentEnv);

  return [
    {
      id: "workspace",
      label: "Workspace identity",
      description: "Create the client workspace and ownership model.",
      status: "complete",
    },
    {
      id: "providers",
      label: "Provider readiness",
      description:
        mode === "live"
          ? "Live mode requires provider environment values before handoff."
          : "Fake mode is ready. Live provider setup still needs environment values.",
      status: mode === "live" && missingEnv.length > 0 ? "blocked" : "ready",
      missingEnv,
    },
    {
      id: "brain",
      label: "Source-backed Brain",
      description:
        "Add markdown, links, and source sets before agent workflows run.",
      status: "ready",
    },
    {
      id: "flags",
      label: "Rollout and kill switches",
      description:
        "Confirm feature flags before promoting live billing, notifications, or AI generation.",
      status: "ready",
    },
    {
      id: "workflow",
      label: "First workflow receipt",
      description:
        "Run one typed workflow and save the Trust Receipt before client handoff.",
      status: "ready",
    },
  ];
};

export const toastForOnboardingContinue = ({
  mode,
  steps,
}: OnboardingContinueToastOptions): Parameters<
  CreateToasterReturn["create"]
>[0] => {
  const blockedStep = steps.find((step) => step.status === "blocked");

  if (blockedStep) {
    const description =
      blockedStep.missingEnv && blockedStep.missingEnv.length > 0
        ? `${blockedStep.label} needs ${blockedStep.missingEnv.join(", ")} before live handoff.`
        : `${blockedStep.label} must be resolved before continuing.`;

    return {
      title: "Setup blocked",
      description,
      type: "error",
    };
  }

  if (mode === "fake") {
    return {
      title: "Fake-mode setup ready",
      description:
        "Continue building with fake providers. Live handoff still needs provider environment signoff.",
      type: "warning",
    };
  }

  return {
    title: "Onboarding checklist ready",
    description:
      "Workspace setup, provider posture, Brain sources, and first workflow are ready for the next handoff step.",
    type: "success",
  };
};
