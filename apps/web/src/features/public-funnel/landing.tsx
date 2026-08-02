import { ArrowRight, Check, Sparkles } from "lucide-react";

import { PublicFunnelShell } from "./public-shell";

const reportItems = [
  "A straight answer on whether the idea is worth testing",
  "A constructive roast of the weak assumptions",
  "A stronger, clearer version of the idea",
  "What it will take to validate and build",
] as const;

const steps = [
  {
    number: "01",
    title: "Explain the idea",
    body: "Answer a few plain-English questions. No pitch deck or technical knowledge needed.",
  },
  {
    number: "02",
    title: "Get the honest version",
    body: "We pressure-test the customer, problem, solution, business model, and path to market.",
  },
  {
    number: "03",
    title: "Know what comes next",
    body: "Leave with a report you can use yourself or hand to a developer, agency, or coding agent.",
  },
] as const;

export function AppIdeaLanding() {
  return (
    <PublicFunnelShell>
      <main id="main-content">
        <section className="idea-hero">
          <div className="idea-hero-copy">
            <p className="idea-eyebrow">
              <Sparkles aria-hidden="true" size={16} strokeWidth={2} />A
              brutally useful second opinion
            </p>
            <h1>Tell me if your app idea is good.</h1>
            <p className="idea-hero-subhead">
              Know what it will take to build it.
            </p>
            <p className="idea-hero-body">
              Get an honest, constructive evaluation before you spend months
              building the wrong thing—or get locked into a platform you do not
              understand.
            </p>
            <div className="idea-hero-actions">
              <a className="idea-primary-action" href="/evaluate">
                Roast my app idea
                <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
              </a>
              <span>No account required · free Buildability Report</span>
            </div>
          </div>
          <aside className="idea-report-preview" aria-label="Your free report">
            <p className="idea-preview-kicker">Your free verdict</p>
            <div
              className="idea-preview-score"
              aria-label="Example score: 74 out of 100"
            >
              <strong>74</strong>
              <span>/100</span>
            </div>
            <h2>Good product. Unclear distribution.</h2>
            <p>
              The product solves a real problem. The uncomfortable bit: you have
              not shown how the right people will find it.
            </p>
            <div className="idea-preview-rule" />
            <p className="idea-preview-next">What it will take</p>
            <p>
              Prove one repeatable path to ten customers before adding scope.
            </p>
          </aside>
        </section>

        <section className="idea-proof-strip" aria-label="What you receive">
          {reportItems.map((item) => (
            <p key={item}>
              <Check aria-hidden="true" size={17} strokeWidth={2} />
              {item}
            </p>
          ))}
        </section>

        <section className="idea-how" aria-labelledby="how-it-works">
          <div>
            <p className="idea-section-label">How it works</p>
            <h2 id="how-it-works">Clarity in about ten minutes.</h2>
          </div>
          <ol>
            {steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="idea-upgrade" aria-labelledby="complete-pack">
          <div>
            <p className="idea-section-label">When the idea survives</p>
            <h2 id="complete-pack">Go from “maybe” to build-ready.</h2>
            <p>
              The free report tells you whether to build. The Complete Build
              Pack tells you exactly how—with requirements, technical
              architecture, build phases, risks, and a handoff for a developer,
              agency, or coding agent.
            </p>
          </div>
          <a className="idea-secondary-action" href="/evaluate">
            Start with the free evaluation
            <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
          </a>
        </section>
      </main>
    </PublicFunnelShell>
  );
}
