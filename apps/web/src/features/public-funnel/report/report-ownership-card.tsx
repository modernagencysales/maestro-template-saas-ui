import { useState, type FormEvent } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import * as Either from "effect/Either";
import { Mail, ShieldCheck } from "lucide-react";

import { useTemplateMutation } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { requestFakeReportVerification } from "./report-credentials";

export function ReportOwnershipCard({
  accessToken,
  reportId,
}: {
  readonly accessToken: string;
  readonly reportId: string;
}) {
  return isConvexConfigured() ? (
    <LiveReportOwnershipCard accessToken={accessToken} reportId={reportId} />
  ) : (
    <ReportOwnershipCardSurface reportId={reportId} />
  );
}

function LiveReportOwnershipCard({
  accessToken,
  reportId,
}: {
  readonly accessToken: string;
  readonly reportId: string;
}) {
  const requestVerification = useTemplateMutation(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .requestReportEmailVerification,
  );
  const requestLiveVerification = async (email: string) => {
    const result = await requestVerification({ reportId, accessToken, email });
    if (Either.isEither(result) && Either.isLeft(result)) {
      throw new Error("The verification request was rejected.");
    }
    const sent = Either.isEither(result) ? result.right : result;
    return sent.fakeVerificationUrl;
  };

  return (
    <ReportOwnershipCardSurface
      reportId={reportId}
      requestLiveVerification={requestLiveVerification}
    />
  );
}

function ReportOwnershipCardSurface({
  reportId,
  requestLiveVerification,
}: {
  readonly reportId: string;
  readonly requestLiveVerification?: (
    email: string,
  ) => Promise<string | undefined>;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { readonly _tag: "idle" }
    | { readonly _tag: "sending" }
    | { readonly _tag: "sent"; readonly fakeVerificationUrl?: string }
    | { readonly _tag: "error"; readonly message: string }
  >({ _tag: "idle" });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ _tag: "sending" });
    try {
      if (!requestLiveVerification) {
        setStatus({
          _tag: "sent",
          fakeVerificationUrl: requestFakeReportVerification(reportId, email),
        });
        return;
      }
      const fakeVerificationUrl = await requestLiveVerification(email);
      setStatus({
        _tag: "sent",
        ...(fakeVerificationUrl === undefined ? {} : { fakeVerificationUrl }),
      });
    } catch {
      setStatus({
        _tag: "error",
        message: "We could not send the verification link. Try again.",
      });
    }
  };

  return (
    <section
      className="idea-report-ownership"
      aria-labelledby="save-report-title"
    >
      <div>
        <p className="idea-section-label">Keep your report</p>
        <h2 id="save-report-title">Save it across devices.</h2>
        <p>
          Verify your email to revise this idea, access your library, download
          durable files, or purchase the Complete Build Pack.
        </p>
      </div>
      {status._tag === "sent" ? (
        <div className="idea-ownership-success" role="status">
          <ShieldCheck aria-hidden="true" size={20} />
          <div>
            <strong>Check your email.</strong>
            <p>The link is single-use and expires in 30 minutes.</p>
            {status.fakeVerificationUrl ? (
              <a href={status.fakeVerificationUrl}>
                Open test verification link
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <label htmlFor="report-owner-email">Email address</label>
          <div className="idea-ownership-form-row">
            <input
              autoComplete="email"
              id="report-owner-email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <button
              className="idea-primary-action"
              disabled={status._tag === "sending" || !email.trim()}
              type="submit"
            >
              <Mail aria-hidden="true" size={17} />
              {status._tag === "sending" ? "Sending…" : "Email my save link"}
            </button>
          </div>
          {status._tag === "error" ? (
            <p className="idea-field-error" role="alert">
              {status.message}
            </p>
          ) : null}
          <p className="idea-form-note">
            Your idea stays private. Email verification does not publish it.
          </p>
        </form>
      )}
    </section>
  );
}
