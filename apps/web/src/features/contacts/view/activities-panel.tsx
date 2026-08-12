import { Container } from "@chakra-ui/react";
import { useAuth } from "@saas-ui/auth-provider";
import { LoadingOverlay, toast } from "@saas-ui/react";

import { ContactDTO } from "@workspace/api/types";

import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { api } from "#lib/trpc/react";

import { type Activity, ActivityTimeline } from "./activity-timeline";

export const ActivitiesPanel: React.FC<{
  contact: ContactDTO;
}> = ({ contact }) => {
  const { user } = useAuth();
  const [workspace] = useCurrentWorkspace();

  const utils = api.useUtils();

  const input = {
    id: contact.id,
    workspaceId: contact.workspaceId,
  };

  const { data, isLoading } = api.contacts.activitiesById.useQuery(input);

  const addMutation = api.contacts.addComment.useMutation({
    onError: (error) => {
      toast.error({
        title: "Failed to add your comment",
        description: error.message,
      });
    },
    onSettled: () => {
      utils.contacts.activitiesById.invalidate(input);
    },
  });

  const deleteMutation = api.contacts.removeComment.useMutation({
    onError: (error) => {
      toast.error({
        title: "Failed to delete your comment",
        description: error.message,
      });
    },
    onSettled: () => {
      utils.contacts.activitiesById.invalidate(input);
    },
  });

  const getMember = (id: string) => {
    const member = workspace?.members?.find((member) => member.id === id);

    return member
      ? {
          id: member?.id,
          name: member?.name,
          avatar: member?.avatar,
        }
      : undefined;
  };

  const activities = (data?.activities || []).map(
    (activity) =>
      ({
        id: activity.id,
        type: activity.type,
        user: activity.actorId ? getMember(activity.actorId) : undefined,
        data: activity.metadata,
        date: activity.createdAt,
      }) as Activity,
  );

  return (
    <Container maxW="2xl">
      {!user || isLoading ? (
        <LoadingOverlay.Root>
          <LoadingOverlay.Spinner />
        </LoadingOverlay.Root>
      ) : (
        <ActivityTimeline
          currentUser={user}
          activities={activities}
          onAddComment={async (data) => {
            return addMutation.mutate({
              workspaceId: contact.workspaceId,
              contactId: contact.id,
              comment: data.comment,
            });
          }}
          onDeleteComment={async (id) => {
            return deleteMutation.mutate({
              workspaceId: contact.workspaceId,
              commentId: id as string,
            });
          }}
        />
      )}
    </Container>
  );
};
