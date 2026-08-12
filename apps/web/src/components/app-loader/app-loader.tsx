"use client";

import { useEffect } from "react";

import { keyframes } from "@emotion/react";
import { LoadingOverlay } from "@saas-ui/react";

import { LogoIcon } from "../logo/logo";

const scale = keyframes`
  0% {
    scale: 1;
  }
  100% {
    scale: 1.3;
  }
`;

/**
 * Show a fullscreen loading animation while the app is loading.
 */
export const AppLoader: React.FC<LoadingOverlay.RootProps> = (props) => {
  useEffect(() => {
    // This will make sure the root loader will be hidden after the app is initially loaded
    return () => document.documentElement.classList.add("loaded");
  }, []);

  return (
    <LoadingOverlay.Root {...props} height="100dvh">
      <LogoIcon boxSize="6" animation={`5s ease-out ${scale}`} opacity="0.8" />
    </LoadingOverlay.Root>
  );
};
