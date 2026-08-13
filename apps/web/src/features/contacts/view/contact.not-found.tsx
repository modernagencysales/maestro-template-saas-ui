import { EmptyState } from '@saas-ui/react'

export function ContactNotFound(props: {
  params: {
    id: string
  }
}) {
  return (
    <EmptyState
      title="Contact not found"
      description={
        <>
          There is no contact with id <strong>{props.params.id}</strong>
        </>
      }
      height="full"
    />
  )
}
