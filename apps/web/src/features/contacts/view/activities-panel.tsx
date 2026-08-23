import { Container } from '@chakra-ui/react'
import { useAuth } from '@saas-ui/auth-provider'
import { LoadingOverlay, toast } from '@saas-ui/react'

import { ContactDTO } from '@workspace/api/types'

import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'
import { api, type StarterActivity } from '#lib/trpc/react'

import { type Activities, ActivityTimeline } from './activity-timeline'

type TimelineUser = Activities[number]['user']

const metadataString = (
  metadata: StarterActivity['metadata'],
  key: string,
  fallback = '',
) => (typeof metadata?.[key] === 'string' ? metadata[key] : fallback)

export const toTimelineActivity = (
  activity: StarterActivity,
  user: TimelineUser = { id: 'system', name: 'System' },
): Activities[number] => {
  const common = {
    id: activity.id,
    user,
    date: activity.createdAt,
  }

  if (activity.type === 'comment-added' || activity.type === 'comment') {
    return {
      ...common,
      type: 'comment',
      data: { comment: metadataString(activity.metadata, 'comment') },
    }
  }

  if (activity.type === 'contact-created' || activity.type === 'action') {
    return {
      ...common,
      type: 'action',
      data: { action: metadataString(activity.metadata, 'action', 'created') },
    }
  }

  return {
    ...common,
    type: 'update',
    data: {
      field: metadataString(activity.metadata, 'field', 'contact'),
      oldValue: metadataString(activity.metadata, 'oldValue') || undefined,
      value: metadataString(activity.metadata, 'value') || undefined,
    },
  }
}

export const ActivitiesPanel: React.FC<{
  contact: ContactDTO
}> = ({ contact }) => {
  const { user } = useAuth()
  const [workspace] = useCurrentWorkspace()

  const utils = api.useUtils()

  const input = {
    id: contact.id,
    workspaceId: contact.workspaceId,
  }

  const { data, isLoading } = api.contacts.activitiesById.useQuery(input)

  const addMutation = api.contacts.addComment.useMutation({
    onError: (error) => {
      toast.error({
        title: 'Failed to add your comment',
        description: error.message,
      })
    },
    onSettled: () => {
      utils.contacts.activitiesById.invalidate(input)
    },
  })

  const deleteMutation = api.contacts.removeComment.useMutation({
    onError: (error) => {
      toast.error({
        title: 'Failed to delete your comment',
        description: error.message,
      })
    },
    onSettled: () => {
      utils.contacts.activitiesById.invalidate(input)
    },
  })

  const getMember = (id: string) => {
    const member = workspace?.members?.find((member) => member.id === id)

    return member
      ? {
          id: member?.id,
          name: member?.name,
          avatar: member?.avatar,
        }
      : undefined
  }

  const activities: Activities = (data?.activities || []).map((activity) =>
    toTimelineActivity(
      activity,
      activity.actorId ? getMember(activity.actorId) : undefined,
    ),
  )

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
            })
          }}
          onDeleteComment={async (id) => {
            return deleteMutation.mutate({
              workspaceId: contact.workspaceId,
              commentId: id as string,
            })
          }}
        />
      )}
    </Container>
  )
}
