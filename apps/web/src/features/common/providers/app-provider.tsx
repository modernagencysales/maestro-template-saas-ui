"use client";

import * as React from "react";

import { FeaturesProvider } from "@saas-ui-pro/feature-flags";
import { SuiProvider } from "@saas-ui/react";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link as TanstackLink,
  type LinkProps as TanstackLinkProps,
} from "@tanstack/react-router";

import { appHotkeys } from "#config/hotkeys.config";
import { AuthProvider } from "#features/auth/auth-provider";
import { system } from "#theme/preset";
import { segments } from "@workspace/config";

import { Hotkeys } from "../components/hotkeys";

const LinkComponent = React.forwardRef<
  HTMLAnchorElement,
  TanstackLinkProps & { href: TanstackLinkProps["to"] }
>(function LinkComponent(props, ref) {
  const { href, ...rest } = props;
  const linkProps = { ...rest, to: href } as TanstackLinkProps;
  return <TanstackLink ref={ref} {...linkProps} />;
});

export interface AppProviderProps {
  onError?: (error: Error, info: React.ErrorInfo) => void;
  queryClient: QueryClient;
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = (props) => {
  const { onError, queryClient, children } = props;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SuiProvider
          linkComponent={LinkComponent}
          {...(onError ? { onError } : {})}
          value={system}
        >
          <FeaturesProvider value={segments}>
            <Hotkeys hotkeys={appHotkeys}>{children}</Hotkeys>
          </FeaturesProvider>
        </SuiProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
