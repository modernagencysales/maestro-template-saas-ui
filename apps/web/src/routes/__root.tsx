import { withEmotionCache } from "@emotion/react";
import "@fontsource-variable/inter";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import { ConvexProvider, ConvexProviderWithAuth } from "convex/react";
import { I18nProvider } from "@workspace/i18n";
import { ModalsProvider } from "@workspace/ui/modals";

import { seo } from "#utils/seo.ts";

import { Provider } from "../provider.tsx";
import { loadInitialAuthForConvex } from "#lib/auth/workos-auth-loader";
import { useAuthFromAuthKit } from "#lib/auth/workos-auth";
import type { CompatibilityApi } from "#lib/trpc/react";
import {
  fixtureClientAuth,
  isFixtureAuthRuntime,
} from "#lib/auth/route-auth";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  trpc: CompatibilityApi;
  convexClient: import("convex/react").ConvexReactClient;
  convexQueryClient: import("@convex-dev/react-query").ConvexQueryClient;
}>()({
  beforeLoad: async ({ context }) => ({
    auth: isFixtureAuthRuntime()
      ? fixtureClientAuth()
      : await loadInitialAuthForConvex(context.convexClient),
  }),
  loader: ({ context }) => ({ auth: context.auth }),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      ...seo(),
    ],
  }),
  component: () => {
    return (
      <RootDocument>
        <Outlet />
      </RootDocument>
    );
  },
});

const RootDocument = withEmotionCache(BaseRootDocument);

function BaseRootDocument(props: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <RuntimeProviders>{props.children}</RuntimeProviders>

        <div id="app-loader">
          <img src="/img/logo-icon.svg" alt="logo" width="24" height="24" />
        </div>
        <style>
          {`body {
            padding: 0;
          }

          #app-loader {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100dvh;
            transition-property: opacity;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 250ms;
            opacity: 1;
            background-color: oklch(1 0 0);
            pointer-events: none;
            z-index: 9999;
          }

          .dark #app-loader {
            background-color: oklch(0.05 0.030 261.692);
          }

          .loaded #app-loader {
            opacity: 0;
          }`}
        </style>

        <Scripts />
      </body>
    </html>
  );
}

function RuntimeProviders(props: { children: React.ReactNode }) {
  const client = Route.useRouteContext().convexClient;
  const application = (
    <Provider>
      <I18nProvider locale="en" messages={{}}>
        <ModalsProvider>{props.children}</ModalsProvider>
      </I18nProvider>

      <ReactQueryDevtools buttonPosition="bottom-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </Provider>
  );
  if (isFixtureAuthRuntime()) {
    return <ConvexProvider client={client}>{application}</ConvexProvider>;
  }
  return (
    <AuthKitProvider initialAuth={Route.useLoaderData().auth}>
      <ConvexProviderWithAuth client={client} useAuth={useAuthFromAuthKit}>
        {application}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}
