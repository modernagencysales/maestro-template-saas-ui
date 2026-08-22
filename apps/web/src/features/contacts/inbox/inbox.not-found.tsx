import { EmptyState } from '@saas-ui/react'

export function InboxNotFound(props: { params: { id: string } }) {
  return (
    <EmptyState
      title="Notification not found"
      description={`There is no notification with id ${props.params.id}.`}
    />
  )
}
