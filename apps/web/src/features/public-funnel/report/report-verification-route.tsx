import { useEffect, useRef, useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import * as Either from "effect/Either";
import { ShieldCheck } from "lucide-react";

import { useTemplateMutation } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { PublicFunnelShell } from "../public-shell";
import {
  consumeFakeReportVerification,
  saveOwnerAccessToken,
} from "./report-credentials";

type VerifiedReportOwnership = {
  readonly reportId: string;
  readonly ownerAccessToken: string;
};

export const consumeReportVerificationToken = async ({
  verificationToken,
  mode,
  convexConfigured,
  consumeFake,
  consumeLive,
}: {
  readonly verificationToken: string;
  readonly mode: string | null;
  readonly convexConfigured: boolean;
  readonly consumeFake: (token: string) => VerifiedReportOwnership | null;
  readonly consumeLive: (
    token: string,
  ) => Promise<VerifiedReportOwnership | null>;
}): Promise<VerifiedReportOwnership | null> =>
  mode === "fake" || !convexConfigured
    ? consumeFake(verificationToken)
    : consumeLive(verificationToken);

export function ReportVerificationRoute() {
  const consumeVerification = useTemplateMutation(
    templateConfectRefs.public.capabilities.manageEvaluationReport
      .consumeReportEmailVerification,
  );
  const started = useRef(false);
  const [state, setState] = useState<
    | { readonly _tag: "verifying" }
    | { readonly _tag: "verified"; readonly reportId: string }
    | { readonly _tag: "error" }
  >({ _tag: "verifying" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = new URLSearchParams(window.location.search);
    const verificationToken = search.get("token");
    if (!verificationToken) {
      setState({ _tag: "error" });
      return;
    }
    void consumeReportVerificationToken({
      verificationToken,
      mode: search.get("mode"),
      convexConfigured: isConvexConfigured(),
      consumeFake: consumeFakeReportVerification,
      consumeLive: async (token) => {
        const result = await consumeVerification({ verificationToken: token });
        if (Either.isEither(result) && Either.isLeft(result)) return null;
        return Either.isEither(result) ? result.right : result;
      },
    })
      .then((verified) => {
        if (!verified) {
          setState({ _tag: "error" });
          return;
        }
        saveOwnerAccessToken(verified.ownerAccessToken);
        setState({ _tag: "verified", reportId: verified.reportId });
      })
      .catch(() => setState({ _tag: "error" }));
  }, [consumeVerification]);

  return (
    <PublicFunnelShell>
      <main className="idea-information" id="main-content">
        {state._tag === "verifying" ? (
          <>
            <p className="idea-section-label">Verifying email</p>
            <h1>Saving your report…</h1>
            <p aria-live="polite" role="status">
              This should take only a moment.
            </p>
          </>
        ) : null}
        {state._tag === "verified" ? (
          <>
            <ShieldCheck aria-hidden="true" size={32} />
            <p className="idea-section-label">Email verified</p>
            <h1>Your report is saved.</h1>
            <p>
              You can now open it across devices and find it in your library.
            </p>
            <div className="idea-report-actions">
              <a
                className="idea-primary-action"
                href={`/report/${state.reportId}`}
              >
                Return to my report
              </a>
              <a href="/library">Open my library</a>
            </div>
          </>
        ) : null}
        {state._tag === "error" ? (
          <div role="alert">
            <p className="idea-section-label">Link unavailable</p>
            <h1>This verification link cannot be used.</h1>
            <p>
              It may have expired or already been used. Return to your report
              and request a new link.
            </p>
            <a className="idea-primary-action" href="/library">
              Go to my reports
            </a>
          </div>
        ) : null}
      </main>
    </PublicFunnelShell>
  );
}
