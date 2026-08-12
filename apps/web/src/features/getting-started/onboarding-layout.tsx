import * as React from "react";

import { Page } from "@saas-ui/react";

import { FullscreenLayout } from "#features/common/layouts/fullscreen-layout";

export interface OnboardingLayoutProps {
  isLoading?: boolean;
  children: React.ReactNode;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = (props) => {
  const { children, ...pageProps } = props;

  return (
    <FullscreenLayout>
      <Page.Root bg="bg.muted" {...pageProps}>
        <Page.Body maxW="full" position="relative">
          {children}
        </Page.Body>
      </Page.Root>
    </FullscreenLayout>
  );
};
