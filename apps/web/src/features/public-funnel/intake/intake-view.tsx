import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { PublicFunnelShell } from "../public-shell";
import { saveEvaluation } from "../evaluation-storage";
import { makeEvaluation } from "./evaluation-adapter";
import {
  answerCurrentQuestion,
  createIntakeState,
  goBack,
  presentIntake,
  type IntakeState,
} from "./intake-state";

export function AppIdeaIntake() {
  const [state, setState] = useState<IntakeState>(createIntakeState);
  const [value, setValue] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const view = useMemo(() => presentIntake(state), [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = answerCurrentQuestion(state, value);
    if (next.status === "complete") {
      setIsEvaluating(true);
      const evaluation = makeEvaluation(next.answers);
      saveEvaluation(evaluation);
      window.location.assign(`/report/${evaluation.id}`);
      return;
    }
    setState(next);
    if (!next.error) {
      const nextView = presentIntake(next);
      setValue(nextView._tag === "question" ? nextView.value : "");
    }
  };

  const back = () => {
    const previous = goBack(state);
    setState(previous);
    const previousView = presentIntake(previous);
    setValue(previousView._tag === "question" ? previousView.value : "");
  };

  return (
    <PublicFunnelShell>
      <main className="idea-intake" id="main-content">
        <div className="idea-intake-topline">
          <a href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to overview
          </a>
          <span>
            <ShieldCheck aria-hidden="true" size={16} />
            Your answers stay private
          </span>
        </div>
        {view._tag === "question" ? (
          <div className="idea-intake-layout">
            <aside aria-label="Evaluation progress">
              <p>{view.progressLabel}</p>
              <div
                aria-label={`${view.progressLabel}, ${String(Math.round(view.progress))}% complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(view.progress)}
                className="idea-progress-track"
                role="progressbar"
              >
                <span style={{ width: `${String(view.progress)}%` }} />
              </div>
              <p>
                You do not need startup jargon or technical answers. Specific
                and honest beats impressive.
              </p>
            </aside>
            <form onSubmit={submit} noValidate>
              <p className="idea-section-label">{view.question.eyebrow}</p>
              <h1>{view.question.prompt}</h1>
              <p className="idea-question-help" id="answer-help">
                {view.question.help}
              </p>
              <label htmlFor="idea-answer">Your answer</label>
              <textarea
                aria-describedby={`answer-help${view.error ? " answer-error" : ""}`}
                aria-invalid={view.error ? true : undefined}
                autoFocus
                id="idea-answer"
                name={view.question.id}
                onChange={(event) => setValue(event.target.value)}
                placeholder={view.question.placeholder}
                rows={7}
                value={value}
              />
              {view.error ? (
                <p className="idea-field-error" id="answer-error">
                  {view.error}
                </p>
              ) : null}
              <div
                aria-live="polite"
                className="template-live-region"
                role="status"
              >
                {view.announcement}
              </div>
              <div className="idea-intake-actions">
                {view.canGoBack ? (
                  <button onClick={back} type="button">
                    <ArrowLeft aria-hidden="true" size={17} />
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  className="idea-primary-action"
                  disabled={isEvaluating}
                  type="submit"
                >
                  {isEvaluating ? "Evaluating idea…" : "Save and continue"}
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    </PublicFunnelShell>
  );
}
