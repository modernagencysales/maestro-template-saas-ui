import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import type {
  EvaluationVerdict,
  FunnelEvent,
} from "@maestro-template/app-idea-evaluator";
import * as Either from "effect/Either";

import { useTemplateAction } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { useFunnelAnalytics } from "../../../providers/posthog";
import { PublicFunnelShell } from "../public-shell";
import { saveEvaluation } from "../evaluation-storage";
import {
  createAnonymousReportCredentials,
  saveAnonymousReportAccess,
} from "../report/report-credentials";
import { makeEvaluation, type StoredEvaluation } from "./evaluation-adapter";
import {
  answerCurrentQuestion,
  createIntakeState,
  goBack,
  presentIntake,
  type IntakeState,
} from "./intake-state";

export function AppIdeaIntake({
  onReportReady,
}: {
  readonly onReportReady?: (reportId: string) => void;
}) {
  return isConvexConfigured() ? (
    <ConfiguredAppIdeaIntake
      {...(onReportReady === undefined ? {} : { onReportReady })}
    />
  ) : (
    <AppIdeaIntakeSurface
      {...(onReportReady === undefined ? {} : { onReportReady })}
    />
  );
}

type RemoteEvaluationCompletionBase = {
  readonly evaluationId: string;
  readonly reportId: string;
};

type RemoteEvaluationCompletion =
  | (RemoteEvaluationCompletionBase & {
      readonly freshCompletion: false;
    })
  | (RemoteEvaluationCompletionBase & {
      readonly freshCompletion: true;
      readonly durationMs: number;
      readonly modelCalls: number;
      readonly estimatedCostCents: number;
    });

export const evaluationCompletedEventForRemote = (
  completed: RemoteEvaluationCompletion,
  verdict: EvaluationVerdict,
): FunnelEvent | null =>
  completed.freshCompletion
    ? {
        name: "evaluation_completed",
        evaluationId: completed.evaluationId,
        verdict,
        durationMs: completed.durationMs,
        modelCalls: completed.modelCalls,
        estimatedCostCents: completed.estimatedCostCents,
      }
    : null;

type EvaluateRemotely = (input: {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly answers: StoredEvaluation["answers"];
}) => Promise<RemoteEvaluationCompletion>;

function ConfiguredAppIdeaIntake({
  onReportReady,
}: {
  readonly onReportReady?: (reportId: string) => void;
}) {
  const evaluateAppIdea = useTemplateAction(
    templateConfectRefs.public.capabilities.evaluateAppIdea
      .evaluateAppIdeaWithModel,
  );
  const evaluateRemotely: EvaluateRemotely = async (input) => {
    const result = await evaluateAppIdea(input);
    if (Either.isEither(result) && Either.isLeft(result)) {
      throw new Error("The evaluator rejected this request.");
    }
    const completed = Either.isEither(result) ? result.right : result;
    return completed;
  };

  return (
    <AppIdeaIntakeSurface
      evaluateRemotely={evaluateRemotely}
      {...(onReportReady === undefined ? {} : { onReportReady })}
    />
  );
}

function AppIdeaIntakeSurface({
  evaluateRemotely,
  onReportReady,
}: {
  readonly evaluateRemotely?: EvaluateRemotely;
  readonly onReportReady?: (reportId: string) => void;
}) {
  const [state, setState] = useState<IntakeState>(createIntakeState);
  const [value, setValue] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [credentials] = useState(createAnonymousReportCredentials);
  const capture = useFunnelAnalytics();
  const view = useMemo(() => presentIntake(state), [state]);
  const openReport = (reportId: string) => {
    if (onReportReady) {
      onReportReady(reportId);
      return;
    }
    window.location.assign(`/report/${reportId}`);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = answerCurrentQuestion(state, value);
    if (next.status === "complete") {
      setIsEvaluating(true);
      setSubmitError(null);
      try {
        const startedAt = performance.now();
        const localEvaluation = makeEvaluation(next.answers);
        if (!evaluateRemotely) {
          saveAnonymousReportAccess(localEvaluation.id, credentials);
          saveEvaluation(localEvaluation);
          capture({
            name: "evaluation_completed",
            evaluationId: localEvaluation.id,
            verdict: localEvaluation.result.verdict,
            durationMs: performance.now() - startedAt,
            modelCalls: 0,
            estimatedCostCents: 0,
          });
          openReport(localEvaluation.id);
          return;
        }
        const completed = await evaluateRemotely({
          sessionId: credentials.sessionId,
          accessToken: credentials.accessToken,
          answers: localEvaluation.answers,
        });
        saveAnonymousReportAccess(completed.reportId, credentials);
        saveEvaluation({ ...localEvaluation, id: completed.reportId });
        const analyticsEvent = evaluationCompletedEventForRemote(
          completed,
          localEvaluation.result.verdict,
        );
        if (analyticsEvent) capture(analyticsEvent);
        openReport(completed.reportId);
      } catch {
        setIsEvaluating(false);
        setSubmitError(
          "Your answers are safe. The evaluator could not finish, so try again.",
        );
      }
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
              {submitError ? (
                <p className="idea-field-error" role="alert">
                  {submitError}
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
