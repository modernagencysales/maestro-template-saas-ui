import { createFileRoute, redirect } from "@tanstack/react-router";

import { DefaultLoader } from "#components/default-loader";
import { getLastUsedWorkspace } from "#lib/last-used-workspace";
import { convexClient } from "#lib/trpc/react";
import { templateConfectRefs } from "../../../../../packages/convex/src/refs";

export const Route = createFileRoute("/_app/")({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.user) {
      throw redirect({
        to: "/login",
      });
    }

    await convexClient.mutation(
      (templateConfectRefs as any).public.access.provisioning.ensureProvisioned,
      {},
    );

    const user: any = await context.trpc.auth.me.ensureData().catch(() => {
      return null;
    });

    if (!user) {
      throw redirect({
        to: "/login",
      });
    }

    const lastUsedWorkspace = getLastUsedWorkspace();

    const workspace = lastUsedWorkspace
      ? (user.workspaces.find(
          (workspace: { slug: string }) => workspace.slug === lastUsedWorkspace,
        ) ?? user.workspaces[0])
      : user.workspaces[0];

    if (!workspace) {
      throw redirect({
        to: "/getting-started",
      });
    }

    throw redirect({
      to: "/$workspace",
      params: {
        workspace: workspace.slug,
      },
    });
  },
  pendingComponent: DefaultLoader,
  component: () => null,
});
