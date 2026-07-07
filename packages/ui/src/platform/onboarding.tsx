import { Badge, Button } from "../primitives";

export type OnboardingStepStatus = "complete" | "ready" | "blocked";

export type OnboardingStep = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly status: OnboardingStepStatus;
  readonly missingEnv?: readonly string[];
};

export function TemplateOnboardingChecklist({
  onContinue,
  steps,
  mode,
}: {
  readonly onContinue: () => void;
  readonly steps: readonly OnboardingStep[];
  readonly mode: "fake" | "test" | "live";
}) {
  return (
    <section aria-label="Onboarding checklist" className="template-onboarding">
      <header>
        <h1>Onboarding</h1>
        <Badge>{mode === "fake" ? "fake mode" : mode}</Badge>
      </header>
      <div className="template-onboarding-list">
        {steps.map((step) => (
          <article className="template-onboarding-step" key={step.id}>
            <header>
              <h2>{step.label}</h2>
              <Badge>{step.status}</Badge>
            </header>
            <p>{step.description}</p>
            {step.missingEnv && step.missingEnv.length > 0 ? (
              <p className="template-platform-warning">
                Missing live provider setup: {step.missingEnv.join(", ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <Button onClick={onContinue} type="button" variant="cell">
        Continue setup
      </Button>
    </section>
  );
}
