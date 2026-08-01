import { useState, type FormEvent } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import * as Either from "effect/Either";
import { RefreshCw } from "lucide-react";

import {
  useTemplateAction,
  useTemplateQuery,
} from "../../../adapters/confect-state";

export type ReportRevisionState =
  | { readonly _tag: "idle" }
  | { readonly _tag: "revising" }
  | { readonly _tag: "revised"; readonly version: number }
  | { readonly _tag: "error" };

export function ReportRevisionCard({
  reportId,
  ownerAccessToken,
}: {
  readonly reportId: string;
  readonly ownerAccessToken: string;
}) {
  const revise = useTemplateAction(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .reviseEvaluationReportWithModel,
  );
  const versions = useTemplateQuery(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .listEvaluationReportVersions,
    { reportId, ownerAccessToken },
  );
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<ReportRevisionState>({ _tag: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ _tag: "revising" });
    try {
      const result = await revise({ reportId, ownerAccessToken, feedback });
      if (Either.isEither(result) && Either.isLeft(result)) throw result.left;
      const revised = Either.isEither(result) ? result.right : result;
      setState({ _tag: "revised", version: revised.version });
      setFeedback("");
    } catch {
      setState({ _tag: "error" });
    }
  };

  return (
    <ReportRevisionSurface
      feedback={feedback}
      onFeedbackChange={setFeedback}
      onSubmit={(event) => void submit(event)}
      state={state}
      versionCount={versions.status === "ready" ? versions.data.length : 1}
    />
  );
}

export function ReportRevisionSurface({
  feedback,
  onFeedbackChange,
  onSubmit,
  state,
  versionCount,
}: {
  readonly feedback: string;
  readonly onFeedbackChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly state: ReportRevisionState;
  readonly versionCount: number;
}) {
  return (
    <section
      aria-labelledby="revise-report-title"
      className="idea-report-revision"
    >
      <div>
        <p className="idea-section-label">Refine the idea</p>
        <h2 id="revise-report-title">What changed about your idea?</h2>
        <p>
          Add new customer evidence, narrow the first version, or explain what
          the report misunderstood. The current version stays saved.
        </p>
        <p className="idea-form-note">
          {versionCount === 1
            ? "Version 1 is saved."
            : `${String(versionCount)} versions are saved.`}
        </p>
      </div>
      {state._tag === "revised" ? (
        <div className="idea-revision-success" role="status">
          <strong>Version {state.version} is ready.</strong>
          <p>
            The report above updates automatically. Earlier versions remain
            saved.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <label htmlFor="revision-feedback">
            What should the report reconsider?
          </label>
          <textarea
            id="revision-feedback"
            maxLength={2_000}
            minLength={10}
            name="revision-feedback"
            onChange={(event) => onFeedbackChange(event.currentTarget.value)}
            placeholder="We spoke to three larger practices. They care more about filling specialist appointments than routine cleanings."
            required
            rows={5}
            value={feedback}
          />
          {state._tag === "error" ? (
            <p className="idea-field-error" role="alert">
              Unable to generate the revision. Your current report is unchanged,
              so check the details and try again.
            </p>
          ) : null}
          <button
            className="idea-primary-action"
            disabled={state._tag === "revising"}
            type="submit"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {state._tag === "revising"
              ? "Generating revision…"
              : "Generate revised report"}
          </button>
        </form>
      )}
    </section>
  );
}
