import { Persona } from '@saas-ui/react'

import type { ContactDTO } from '@workspace/api/types'

export function ContactAvatar(
  props: Persona.RootProps & {
    contact: Pick<ContactDTO, 'name' | 'email' | 'avatar'>
  },
) {
  return (
    <Persona.Root {...props}>
      <Persona.Avatar
        name={props.contact.name ?? props.contact.email}
        src={props.contact.avatar ?? undefined}
      />
    </Persona.Root>
  )
}
