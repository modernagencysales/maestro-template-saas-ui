"use client";

import { ButtonGroup, IconButton, Spacer } from "@saas-ui/react";
import { LuChevronLeft, LuClock, LuTrash } from "react-icons/lu";

import { ContactPage } from "../view/contact-page";

/**
 * This is a simple wrapper around the ContactPage with an inbox specific toolbar
 */
export function InboxViewPage(props: {
  params: {
    workspace: string;
    id: string;
  };
  onBack?: () => void;
}) {
  const toolbar = (
    <ButtonGroup>
      <IconButton
        display={{ base: "inline-flex", lg: "none" }}
        aria-label="All notifications"
        onClick={props.onBack}
        variant="ghost"
      >
        <LuChevronLeft />
      </IconButton>
      <Spacer />
      <IconButton aria-label="Delete notification">
        <LuTrash />
      </IconButton>
      <IconButton aria-label="Snooze">
        <LuClock />
      </IconButton>
    </ButtonGroup>
  );
  return <ContactPage params={props.params} toolbarItems={toolbar} />;
}
