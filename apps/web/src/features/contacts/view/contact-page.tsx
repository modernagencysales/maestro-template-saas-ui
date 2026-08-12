"use client";

import * as React from "react";

import { Button } from "@chakra-ui/react";

import {
  ButtonGroup,
  HStack,
  Page,
  Spacer,
  Tabs,
  Tooltip,
  useBreakpointValue,
} from "@saas-ui/react";
import {
  LuActivity,
  LuFile,
  LuListTodo,
  LuPanelRightOpen,
} from "react-icons/lu";

import { Breadcrumbs } from "#components/breadcrumbs";
import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { useOpenState } from "#hooks/use-open-state";
import { api } from "#lib/trpc/react";

import { ActivitiesPanel } from "./activities-panel";
import { ContactSidebar } from "./contact-sidebar";

interface ContactPageProps {
  params: {
    workspace: string;
    id: string;
  };

  /**
   * Additional toolbar items when embedded in another page, eg the inbox
   */
  toolbarItems?: React.ReactNode;
}

export function ContactPage({ params, toolbarItems }: ContactPageProps) {
  const [workspace] = useCurrentWorkspace();

  const [data] = api.contacts.byId.useSuspenseQuery({
    id: params.id,
    workspaceId: workspace.id,
  });

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    {
      fallback: undefined,
    },
  );

  const sidebar = useOpenState({
    defaultOpen: true,
  });
  const sidebarTriggerRef = React.useRef<HTMLButtonElement>(null);

  const closeSidebar = () => {
    sidebar.setOpen(false);
    requestAnimationFrame(() => sidebarTriggerRef.current?.focus());
  };

  React.useEffect(() => {
    if (isMobile === true) {
      sidebar.setOpen(false);
    }
  }, [isMobile]);

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        {
          to: "/contacts",
          title: "Contacts",
        },
        { title: data?.name },
      ]}
    />
  );

  const toolbar = (
    <ButtonGroup gridArea="actions">
      <Spacer />
      {toolbarItems}
      <Tooltip
        content={sidebar.open ? "Hide contact details" : "Show contact details"}
      >
        <Button
          ref={sidebarTriggerRef}
          aria-label={
            sidebar.open ? "Hide contact details" : "Show contact details"
          }
          onClick={() => {
            if (sidebar.open) closeSidebar();
            else sidebar.setOpen(true);
          }}
        >
          <LuPanelRightOpen />
        </Button>
      </Tooltip>
    </ButtonGroup>
  );

  return (
    <Page.Root>
      <Page.Header title={breadcrumbs} actions={toolbar} />
      <Page.Body p="0">
        <HStack
          alignItems="stretch"
          width="100%"
          height="100%"
          overflowX="hidden"
          position="relative"
          gap="0"
        >
          <Tabs.Root
            variant="subtle"
            size="sm"
            colorPalette="gray"
            defaultValue="activity"
            lazyMount
            flex="1"
            minH="0"
            display="flex"
            flexDirection="column"
          >
            <Tabs.List px="4" py="2" borderBottomWidth="1px">
              <Tabs.Trigger value="activity">
                <LuActivity /> Activity
              </Tabs.Trigger>
              <Tabs.Trigger value="tasks">
                <LuListTodo /> Tasks
              </Tabs.Trigger>
              <Tabs.Trigger value="files">
                <LuFile />
                Files
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.ContentGroup overflowY="auto" flex="1">
              <Tabs.Content value="activity" p="8">
                <ActivitiesPanel contact={data} />
              </Tabs.Content>
            </Tabs.ContentGroup>
          </Tabs.Root>

          <ContactSidebar
            contact={data}
            {...(sidebar.open ? { open: true } : {})}
            onOpenChange={sidebar.onOpenChange}
            onClose={closeSidebar}
          />
        </HStack>
      </Page.Body>
    </Page.Root>
  );
}
