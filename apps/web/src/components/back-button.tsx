import { LuArrowLeft } from "react-icons/lu";

import { LinkButton } from "./link-button";

export function BackButton() {
  return (
    <LinkButton aria-label="Go back" size="sm" to="/" variant="ghost">
      <LuArrowLeft aria-hidden="true" />
    </LinkButton>
  );
}
