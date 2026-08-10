import type { ReactNode } from "react";
import { SuiProvider } from "@saas-ui/react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";
import { system } from "./system";

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/providers/app-provider.tsx.
const LinkComponent = forwardRef<
  HTMLAnchorElement,
  Omit<LinkProps, "to"> & { readonly href: NonNullable<LinkProps["to"]> }
>(function LinkComponent({ href, ...props }, ref) {
  return <Link ref={ref} to={href} {...props} />;
});

export function MaestroSaasUiProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <SuiProvider linkComponent={LinkComponent} value={system}>
      {children}
    </SuiProvider>
  );
}
