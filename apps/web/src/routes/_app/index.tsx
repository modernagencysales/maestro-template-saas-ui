import { createFileRoute, redirect } from "@tanstack/react-router";

import { DefaultLoader } from "#components/default-loader";
import { getLastUsedWorkspace } from "#lib/last-used-workspace";
import {
  getFunctionReference,
  templateConfectRefs,
} from "@maestro-template/convex/refs";

export const Route = createFileRoute("/_app/")({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.user) {
      throw redirect({
        to: "/login",
      });
    }

    await context.convexClient.mutation(
      getFunctionReference(
        templateConfectRefs.public.access.provisioning.ensureProvisioned,
      ) as never,
      {},
    );

    const user = await context.trpc.auth.me.ensureData().catch(() => null);

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
