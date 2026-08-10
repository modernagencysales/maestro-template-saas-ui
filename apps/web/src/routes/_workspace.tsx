import {
  createFileRoute,
  Outlet,
  useRouterState,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BusinessAppShell } from "../saas-ui/business-shell";
import { ErrorLayout } from "../saas-ui/layouts/error-layout";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
  errorComponent: WorkspaceError,
  notFoundComponent: WorkspaceNotFound,
});

function WorkspaceLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <WorkspaceShellBoundary pathname={pathname}>
      <Outlet />
    </WorkspaceShellBoundary>
  );
}

function WorkspaceError({ error, reset }: ErrorComponentProps) {
  return (
    <WorkspaceShellBoundary pathname="/dashboard">
      <ErrorLayout action={reset} title="This workspace route failed">
        {error.message}
      </ErrorLayout>
    </WorkspaceShellBoundary>
  );
}

function WorkspaceNotFound() {
  return (
    <WorkspaceShellBoundary pathname="/dashboard">
      <ErrorLayout title="Workspace route not found">
        The requested workspace page does not exist.
      </ErrorLayout>
    </WorkspaceShellBoundary>
  );
}

function WorkspaceShellBoundary({
  children,
  pathname,
}: {
  readonly children: ReactNode;
  readonly pathname: string;
}) {
  return <BusinessAppShell pathname={pathname}>{children}</BusinessAppShell>;
}
