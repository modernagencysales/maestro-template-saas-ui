import { toast } from "@saas-ui/react";

import { InviteDialog } from "@workspace/ui/invite-dialog";

import { api } from "#lib/trpc/react";

import { useCurrentWorkspace } from "../hooks/use-current-workspace";

export function InvitePeopleDialog(props: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [workspace] = useCurrentWorkspace();

  const inviteMembers = api.workspaceMembers.invite.useMutation();

  return (
    <InviteDialog
      {...props}
      onInvite={async ({ emails, role }) => {
        try {
          await inviteMembers.mutateAsync({
            workspaceId: workspace.id,
            emails,
            role,
          });
          toast.success({ title: "Invitation(s) have been sent." });
        } catch (error: unknown) {
          toast.error({
            title: error instanceof Error ? error.message : "Invitation failed",
          });
          throw error;
        }
      }}
    />
  );
}
