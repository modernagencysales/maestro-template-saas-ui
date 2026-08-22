import type { User } from "@saas-ui/auth-provider";
import { Persona } from "@saas-ui/react";

export function UserAvatar(props: Persona.RootProps & { user: User }) {
  return (
    <Persona.Root presence={props.user.status} {...props}>
      <Persona.Avatar
        name={props.user.name || props.user.email}
        src={props.user.avatar}
      >
        {props.user.status && <Persona.PresenceBadge />}
      </Persona.Avatar>
    </Persona.Root>
  );
}
