"use client";

import * as React from "react";

import {
  Button as ChakraButton,
  IconButton as ChakraIconButton,
} from "@chakra-ui/react";
import { useClipboard } from "@saas-ui/react";
import { Command as SaasCommandPrimitive } from "@saas-ui/react/command";

type ChakraButtonProps = React.ComponentProps<typeof ChakraButton>;
type ChakraIconButtonProps = React.ComponentProps<typeof ChakraIconButton>;

type SemanticButtonVariant = "primary" | "secondary" | "tertiary";
type SaasPresetButtonVariant =
  "solid" | "subtle" | "glass" | "surface" | "outline" | "ghost" | "plain";

export type SaasButtonProps = Omit<ChakraButtonProps, "variant"> & {
  variant?:
    | ChakraButtonProps["variant"]
    | SaasPresetButtonVariant
    | SemanticButtonVariant;
};

const buttonVariantMap = {
  primary: "glass",
  secondary: "surface",
  tertiary: "ghost",
} as const;

function mapButtonVariant(variant: SaasButtonProps["variant"]) {
  if (typeof variant === "string" && variant in buttonVariantMap) {
    return buttonVariantMap[variant as SemanticButtonVariant];
  }
  return variant;
}

export const SaasButton = React.forwardRef<HTMLButtonElement, SaasButtonProps>(
  function SaasButton({ variant, ...props }, ref) {
    return (
      <ChakraButton
        ref={ref}
        variant={mapButtonVariant(variant) as never}
        {...props}
      />
    );
  },
);

export type SaasIconButtonProps = Omit<
  ChakraIconButtonProps,
  "size" | "variant"
> & {
  size?: ChakraIconButtonProps["size"] | "2xs";
  variant?:
    | ChakraIconButtonProps["variant"]
    | SaasPresetButtonVariant
    | SemanticButtonVariant;
};

export const SaasIconButton = React.forwardRef<
  HTMLButtonElement,
  SaasIconButtonProps
>(function SaasIconButton({ size, variant, ...props }, ref) {
  return (
    <ChakraIconButton
      ref={ref}
      size={size === "2xs" ? "xs" : size}
      variant={mapButtonVariant(variant) as never}
      {...props}
    />
  );
});

type SaasCommandProps = React.ComponentProps<typeof SaasCommandPrimitive> & {
  size?: React.ComponentProps<typeof SaasCommandPrimitive>["size"] | "xs";
};

export const SaasCommand =
  SaasCommandPrimitive as React.ComponentType<SaasCommandProps>;

export function useSaasClipboard(value: string) {
  return useClipboard({ value });
}
