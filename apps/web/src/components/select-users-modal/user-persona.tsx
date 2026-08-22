import {
  Persona,
  type PersonaProps,
} from "@/components/ui/persona/persona-composed";

export interface UserPersonaProps extends PersonaProps {
  email: string;
}

export const UserPersona: React.FC<UserPersonaProps> = (props) => {
  const { src, name, email, presence, ...rest } = props;
  return (
    <Persona
      label={name}
      secondaryLabel={email}
      src={src}
      presence={presence}
      {...rest}
    />
  );
};
