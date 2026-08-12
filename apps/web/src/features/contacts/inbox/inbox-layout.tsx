"use client";

import * as React from "react";

import { ResizeHandle, Resizer, SplitPage } from "@saas-ui-pro/react";
import { useLocalStorage } from "@saas-ui/hooks";
import {
  ButtonGroup,
  EmptyState,
  Page,
  useBreakpointValue,
} from "@saas-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { LuInbox } from "react-icons/lu";

import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace.ts";
import { useOpenState } from "#hooks/use-open-state.ts";
import { api } from "#lib/trpc/react.tsx";

import { InboxList } from "./inbox-list.tsx";

export function InboxLayout({
  params,
  children,
}: {
  params: { workspace: string; id?: string };
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  const [workspace] = useCurrentWorkspace();

  const [, startTransition] = React.useTransition();

  const { data, isLoading } = api.notifications.inbox.useQuery({
    workspaceId: workspace.id,
  });

  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    { fallback: "base" },
  );

  const { open, setOpen } = useOpenState({
    defaultOpen: !!params.id,
  });

  const [width, setWidth] = useLocalStorage("app.inbox-list.width", 280);

  React.useEffect(() => {
    if (!params.id && !isLoading && !isMobile) {
      const firstItem = data?.notifications[0];
      if (firstItem) {
        // redirect to the first inbox notification if it's available.
        startTransition(() => {
          navigate({
            to: "/$workspace/inbox/$id",
            params: {
              workspace: params.workspace,
              id: firstItem.id,
            },
            search: {
              contactId: firstItem.subjectId,
            },
            mask: {
              to: "/$workspace/contacts/view/$id",
              params: {
                workspace: params.workspace,
                id: firstItem.subjectId,
              },
            },
          });
        });
      }
    }
  }, [data, isLoading, isMobile, params]);

  React.useEffect(() => {
    if (params.id) {
      setOpen(true);
    }
    // the isMobile dep is needed so that the SplitPage
    // will open again when the screen size changes to lg
  }, [params, isMobile, setOpen]);

  // const [visibleProps, setVisibleProps] = React.useState<string[]>([])

  const notificationCount = data?.notifications?.length || 0;

  // const displayProperties = (
  //   <ToggleButtonGroup
  //     type="checkbox"
  //     isAttached={false}
  //     size="xs"
  //     spacing="0"
  //     flexWrap="wrap"
  //     value={visibleProps}
  //     onChange={setVisibleProps}
  //   >
  //     {['id'].map((id) => {
  //       return (
  //         <ToggleButton
  //           key={id}
  //           value={id}
  //           mb="1"
  //           me="1"
  //           color="muted"
  //           _checked={{ color: 'app-text', bg: 'whiteAlpha.200' }}
  //         >
  //           {id.charAt(0).toUpperCase() + id.slice(1)}
  //         </ToggleButton>
  //       )
  //     })}
  //   </ToggleButtonGroup>
  // )

  const toolbar = (
    <ButtonGroup>
      {/* <Menu>
        <Tooltip label="Display settings">
          <MenuButton
            as={IconButton}
            icon={<LuSlidersHorizontal />}
            aria-label="Display settings"
            variant="tertiary"
            size="xs"
          />
        </Tooltip>
        <Portal>
          <MenuList maxW="260px">
            <MenuProperty
              label="Show snoozed"
              value={<Switch size="sm" defaultChecked={false} />}
            />
            <MenuProperty label="Show read" value={<Switch size="sm" />} />
            <Divider />
            <MenuProperty
              label="Display properties"
              value={displayProperties}
              orientation="vertical"
            />
          </MenuList>
        </Portal>
      </Menu> */}
    </ButtonGroup>
  );

  const emptyState = (
    <EmptyState
      icon={<LuInbox />}
      title="Inbox zero"
      description="Nothing to do here"
      height="100%"
    />
  );

  return (
    <SplitPage open={open} onOpenChange={setOpen}>
      <Resizer
        defaultWidth={width}
        onResize={({ width }) => setWidth(width)}
        enabled={!isMobile}
      >
        <Page.Root
          as="div"
          borderRightWidth={{ base: 0, lg: "1px" }}
          minWidth="280px"
          maxW={{ base: "100%", lg: "640px" }}
          position="relative"
          loading={isLoading}
          flex={{ base: "1", lg: "unset" }}
        >
          <Page.Header title="Inbox" actions={toolbar} />
          <Page.Body p="0">
            {!notificationCount && !open ? (
              emptyState
            ) : (
              <InboxList items={data?.notifications || []} />
            )}
          </Page.Body>
          <ResizeHandle />
        </Page.Root>
      </Resizer>
      {children}
    </SplitPage>
  );
}
