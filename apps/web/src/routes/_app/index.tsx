import { createFileRoute, redirect } from "@tanstack/react-router";

import { DefaultLoader } from "#components/default-loader";
import { getLastUsedWorkspace } from "#lib/last-used-workspace";
import { convexClient } from "#lib/trpc/react";
import { templateConfectRefs } from "@maestro-template/convex/refs";

type CurrentUser = {
  readonly workspaces: readonly { readonly slug: string }[];
};

export const Route = createFileRoute("/_app/")({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.user) {
      throw redirect({
        to: "/login",
      });
    }

    await convexClient.mutation(
      templateConfectRefs.public.access.provisioning.ensureProvisioned,
      {},
    );

    const user = (await context.trpc.auth.me
      .ensureData()
      .catch(() => null)) as CurrentUser | null;

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
