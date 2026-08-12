"use client";

import * as React from "react";
import * as Sui from "@saas-ui/react";

import { ResizeHandle, SplitPage } from "@saas-ui-pro/react";
import { useLocalStorage } from "@saas-ui/hooks";
import { ButtonGroup, useBreakpointValue } from "@saas-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { LuInbox } from "react-icons/lu";

import type { NotificationDTO } from "@workspace/api/types";

import { useCurrentWorkspace } from "#features/common/hooks/use-current-workspace";
import { useOpenState } from "#hooks/use-open-state";
import { api } from "#lib/trpc/react";

import { InboxList } from "./inbox-list";
import { ClientResizer } from "../../common/components/client-resizer";

function useViewportReady() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setReady(true);
  }, []);

  return ready;
}

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
  const viewportReady = useViewportReady();

  const { open, setOpen } = useOpenState({
    defaultOpen: !!params.id,
  });

  const [width, setWidth] = useLocalStorage("app.inbox-list.width", 280);

  React.useEffect(() => {
    if (!params.id && !isLoading && viewportReady && !isMobile) {
      const firstItem = data?.notifications[0];
      if (firstItem) {
        // redirect to the first inbox notification if it's available.
        startTransition(() => {
          navigate({
            to: "/inbox/$id",
            params: {
              id: firstItem.id,
            },
            search: {
              contactId: firstItem.subjectId,
            },
            mask: {
              to: "/contacts/view/$id",
              params: {
                id: firstItem.subjectId,
              },
            },
          });
        });
      }
    }
  }, [data, isLoading, isMobile, params, viewportReady]);

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
    <Sui.EmptyState
      icon={<LuInbox />}
      title="Inbox zero"
      description="Nothing to do here"
      height="100%"
    />
  );

  const hasDetail = !!open;

  return (
    <SplitPage
      display="flex"
      flex="1"
      position="relative"
      overflow="hidden"
      flexDirection="row"
      {...(typeof open === "boolean" ? { open } : {})}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <Sui.Box
        display={{ base: hasDetail ? "none" : "flex", lg: "flex" }}
        flex={{ base: 1, lg: "unset" }}
        height="100%"
      >
        <InboxListPane
          width={width}
          onResize={setWidth}
          enabled={!isMobile}
          loading={isLoading}
          showEmpty={!notificationCount && !open}
          emptyState={emptyState}
          items={data?.notifications || []}
          toolbar={toolbar}
        />
      </Sui.Box>
      <Sui.Box
        display={{ base: hasDetail ? "flex" : "none", lg: "flex" }}
        flex="1"
        height="100%"
      >
        {children}
      </Sui.Box>
    </SplitPage>
  );
}

function InboxListPane(props: {
  width: number;
  onResize: (width: number) => void;
  enabled: boolean;
  loading: boolean;
  showEmpty: boolean;
  emptyState: React.ReactNode;
  items: NotificationDTO[];
  toolbar: React.ReactNode;
}) {
  return (
    <ClientResizer
      defaultWidth={props.width}
      onResize={({ width }) => props.onResize(width)}
      enabled={props.enabled}
    >
      <Sui.Page.Root
        as="div"
        borderRightWidth={{ base: 0, lg: "1px" }}
        minWidth="280px"
        maxW={{ base: "100%", lg: "640px" }}
        position="relative"
        loading={props.loading}
        flex={{ base: "1", lg: "unset" }}
      >
        <Sui.Page.Header title="Inbox" actions={props.toolbar} />
        <Sui.Page.Body p="0">
          {props.showEmpty ? (
            props.emptyState
          ) : (
            <InboxList items={props.items} />
          )}
        </Sui.Page.Body>
        <ResizeHandle />
      </Sui.Page.Root>
    </ClientResizer>
  );
}
