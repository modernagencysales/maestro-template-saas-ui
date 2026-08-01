import { useState } from "react";
import { templateConfectRefs } from "@maestro-template/convex/refs";
import * as Either from "effect/Either";

import { useTemplateAction } from "../../../adapters/confect-state";
import { isConvexConfigured } from "../../../env";
import { useFunnelAnalytics } from "../../../providers/posthog";
import { loadOwnerAccessToken } from "../report/report-credentials";
import { beginFakeCheckout } from "./commerce-storage";
import { CheckoutView, type CheckoutViewState } from "./checkout-view";

export const buildPackPriceCents = 2_900;

export function BuildPackCheckoutRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  return isConvexConfigured() ? (
    <ConfiguredBuildPackCheckoutRoute reportId={reportId} />
  ) : (
    <LocalBuildPackCheckoutRoute reportId={reportId} />
  );
}

type CreateCheckout = (input: {
  readonly reportId: string;
  readonly ownerAccessToken: string;
  readonly email: string;
}) => Promise<{ readonly checkoutUrl: string }>;

export async function openConfiguredCheckout({
  reportId,
  email,
  ownerAccessToken,
  createCheckout,
  redirect,
  onStarted,
}: {
  readonly reportId: string;
  readonly email: string;
  readonly ownerAccessToken: string | null;
  readonly createCheckout: CreateCheckout;
  readonly redirect: (url: string) => void;
  readonly onStarted?: () => void;
}): Promise<void> {
  if (!ownerAccessToken) {
    throw new Error("Verified report ownership is required");
  }
  const checkout = await createCheckout({
    reportId,
    ownerAccessToken,
    email: email.trim(),
  });
  onStarted?.();
  redirect(checkout.checkoutUrl);
}

function ConfiguredBuildPackCheckoutRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const createCheckout = useTemplateAction(
    templateConfectRefs.public.commerce.checkout.create,
  );
  const [ownerAccessToken] = useState(loadOwnerAccessToken);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<CheckoutViewState>({ _tag: "ready" });
  const capture = useFunnelAnalytics();

  const startCheckout = async () => {
    setState({ _tag: "redirecting" });
    try {
      await openConfiguredCheckout({
        reportId,
        email,
        ownerAccessToken,
        createCheckout: async (input) => {
          const result = await createCheckout(input);
          if (Either.isEither(result)) {
            if (Either.isLeft(result)) throw result.left;
            return result.right;
          }
          return result;
        },
        onStarted: () => capture({ name: "checkout_started", reportId }),
        redirect: (url) => window.location.assign(url),
      });
    } catch {
      setState({
        _tag: "error",
        message:
          "Unable to open checkout. Check the verified email and try again.",
      });
    }
  };

  return (
    <CheckoutView
      email={email}
      onCheckout={() => void startCheckout()}
      onEmailChange={setEmail}
      priceCents={buildPackPriceCents}
      reportId={reportId}
      state={state}
    />
  );
}

function LocalBuildPackCheckoutRoute({
  reportId,
}: {
  readonly reportId: string;
}) {
  const [state, setState] = useState<CheckoutViewState>({ _tag: "ready" });
  const capture = useFunnelAnalytics();

  const startCheckout = () => {
    setState({ _tag: "redirecting" });
    try {
      const session = beginFakeCheckout(reportId, buildPackPriceCents);
      capture({ name: "checkout_started", reportId });
      // Fake-provider delivery is deliberately separate from the return route.
      window.location.assign(session.hostedCheckoutUrl);
    } catch {
      setState({
        _tag: "error",
        message:
          "Unable to open checkout. Check your connection and try again.",
      });
    }
  };

  return (
    <CheckoutView
      onCheckout={startCheckout}
      priceCents={buildPackPriceCents}
      reportId={reportId}
      state={state}
    />
  );
}
