import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexReactClient } from "convex/react";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TemplateToastProvider } from "@maestro-template/ui";

import { AuthKitProviderWithConvexProviderWithAuth } from "../auth/authkit-client";
import { getAuthSnapshot, type AuthSnapshot } from "../auth/authkit-server";
import { MaestroSaasUiProvider } from "../saas-ui/provider";
import {
  createBrowserWorkspaceStorage,
  WorkspaceProvider,
} from "../providers/workspace";
import { createFakeWorkspaceOperations } from "../providers/workspace-operations";
import { PostHogWebProvider } from "../providers/posthog";
import { CookieConsentBoundary } from "../providers/cookie-consent";
import { WebRouteUxBoundary } from "../navigation/route-ux-boundary";
import { buildTemplateRouteHead } from "../adapters/route-head";
import appCssUrl from "../index.css?url";
import xyflowCssUrl from "@xyflow/react/dist/style.css?url";

export type RouterContext = {
  readonly queryClient: QueryClient;
  readonly convexClient: ConvexReactClient;
  readonly convexQueryClient: ConvexQueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () =>
    buildTemplateRouteHead({
      stylesheets: [
        { rel: "stylesheet", href: xyflowCssUrl },
        { rel: "stylesheet", href: appCssUrl },
      ],
    }),
  ["loader"]: async (): Promise<{ readonly authSnapshot: AuthSnapshot }> => ({
    authSnapshot: await getAuthSnapshot(),
  }),
  component: RootComponent,
});

function RootComponent() {
  const { convexClient } = Route.useRouteContext();
  const { authSnapshot } = Route.useLoaderData();
  const location = useRouterState({ select: (state) => state.location });

  return (
    <AuthKitProviderWithConvexProviderWithAuth
      client={convexClient}
      initialAuthSnapshot={authSnapshot}
    >
      <WorkspaceProvider
        operations={createFakeWorkspaceOperations()}
        storage={createBrowserWorkspaceStorage()}
      >
        <CookieConsentBoundary>
          {(analyticsConsent) => (
            <PostHogWebProvider analyticsConsent={analyticsConsent}>
              <RootDocument>
                <WebRouteUxBoundary
                  href={location.href}
                  pathname={location.pathname}
                >
                  <MaestroSaasUiProvider>
                    <TemplateToastProvider>
                      <Outlet />
                    </TemplateToastProvider>
                  </MaestroSaasUiProvider>
                </WebRouteUxBoundary>
              </RootDocument>
            </PostHogWebProvider>
          )}
        </CookieConsentBoundary>
      </WorkspaceProvider>
    </AuthKitProviderWithConvexProviderWithAuth>
  );
}

function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
