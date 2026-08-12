import * as React from "react";

import * as z from "zod";
import { User } from "@saas-ui/auth-provider";
import {
  Box,
  ButtonGroup,
  Card,
  Command,
  Group,
  HStack,
  IconButton,
  Link,
  LinkProps,
  Spacer,
  Span,
  Text,
  TextProps,
  Timeline,
  Tooltip,
  toast,
  useClipboard,
} from "@saas-ui/react";
import { AnimatePresence } from "framer-motion";
import { LuPaperclip } from "react-icons/lu";

import { DateTime, RelativeTime } from "@workspace/i18n";
import { Form, useAppForm } from "@workspace/ui/form";
import { useModals } from "@workspace/ui/modals";
import { OverflowMenu } from "@workspace/ui/overflow-menu";
import { StatusBadge } from "@workspace/ui/status-badge";

import { UserAvatar } from "#components/user-avatar";

export type Activity<Type, TData extends object, TUser = Partial<User>> = {
  id: string;
  user: TUser;
  type: Type;
  data: TData;
  date: Date;
};

type ActivityAction = Activity<"action", { action: string }>;
type ActivityComment = Activity<"comment", { comment: string }>;
type ActivityUpdate = Activity<
  "update",
  { field: string; oldValue?: string; value?: string }
>;

export type Activities = Array<
  ActivityAction | ActivityComment | ActivityUpdate
>;

export interface ActivityTimelineProps {
  activities: Activities;
  currentUser: User;
  onAddComment: SubmitHandler<Comment>;
  onDeleteComment?(id: string | number): Promise<void>;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = (props) => {
  const { currentUser, activities, onAddComment, onDeleteComment } = props;

  return (
    <Box>
      <Timeline.Root>
        <AnimatePresence initial={false}>
          {activities?.map((activity) => {
            switch (activity.type) {
              case "action":
                return (
                  <ActivityTimelineAction key={activity.id} {...activity} />
                );
              case "comment":
                return (
                  <ActivityTimelineComment
                    key={activity.id}
                    {...activity}
                    onDelete={onDeleteComment}
                  />
                );
              case "update":
                return (
                  <ActivityTimelineUpdate key={activity.id} {...activity} />
                );
            }
          })}
        </AnimatePresence>
      </Timeline.Root>
      <ActivityTimelineAddComment user={currentUser} onSubmit={onAddComment} />
    </Box>
  );
};

interface ActivityTimelineItem extends Timeline.ItemProps {
  id?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  indicatorOffset?: string;
}

const ActivityTimelineItem: React.FC<ActivityTimelineItem> = (props) => {
  const { id, icon, children, indicatorOffset = "0", ...rest } = props;
  return (
    <Timeline.Item
      id={id}
      role="group"
      css={{
        "&:last-of-type .chakra-timeline__separator": { opacity: 0 },
      }}
      {...rest}
    >
      <Timeline.Separator />

      <Timeline.Connector>
        <Timeline.Indicator
          mt={indicatorOffset}
          bg="inherit"
          outlineColor="var(--bg-current-color)"
        >
          {icon}
        </Timeline.Indicator>
      </Timeline.Connector>

      {children}
    </Timeline.Item>
  );
};

interface ActivityTimelineDate {
  date: Date;
}

const ActivityTimelineDate: React.FC<ActivityTimelineDate> = (props) => {
  return (
    <Tooltip content={<DateTime date={props.date} />}>
      <ActivityText>
        <RelativeTime date={props.date} />
      </ActivityText>
    </Tooltip>
  );
};

const ActivityText = React.forwardRef<HTMLParagraphElement, TextProps>(
  function ActivityText(props, ref) {
    return (
      <Text as="span" ref={ref} color="fg.muted" textStyle="sm" {...props} />
    );
  },
);

const ActivityLink: React.FC<LinkProps> = (props) => {
  const { copy } = useClipboard({
    value: props.href || "",
  });

  return (
    <Link
      {...props}
      onClick={() => {
        copy();
        toast.success({ title: "Link copied to clipboard" });
      }}
    />
  );
};

const ActivityUser: React.FC<TextProps & { user: Partial<User> }> = (props) => {
  const { user, ...rest } = props;
  return (
    <ActivityText fontWeight="medium" color="fg" {...rest}>
      {user.name || user.email || user.id}
    </ActivityText>
  );
};

const ActivityTimelineAction: React.FC<ActivityAction> = (props) => {
  const { id, user, date } = props;

  const status = user.status === "active" ? "online" : user.status;

  return (
    <ActivityTimelineItem
      id={`action-${id}`}
      icon={<UserAvatar user={user} size="2xs" presence={status} />}
    >
      <Timeline.Content flexDirection="row" alignItems="center">
        <ActivityText>
          <ActivityUser user={user} /> created the contact.
        </ActivityText>
        <Span textStyle="sm" color="fg.muted">
          •
        </Span>
        <ActivityLink href={`#action-${id}`} color="fg.muted" textStyle="xs">
          <ActivityTimelineDate date={date} />
        </ActivityLink>
      </Timeline.Content>
    </ActivityTimelineItem>
  );
};

interface UpdateIconProps {
  field: string;
  value?: string;
}

const UpdateIcon: React.FC<UpdateIconProps> = (props) => {
  switch (props.field) {
    case "status":
      return <StatusBadge color={props.value} />;
    default:
      return <Box boxSize="2" borderWidth="2px" borderColor="muted" />;
  }
};

const ActivityTimelineUpdate: React.FC<ActivityUpdate> = (props) => {
  const { id, user, data, date } = props;

  return (
    <ActivityTimelineItem id={`update-${id}`} icon={<UpdateIcon {...data} />}>
      <Timeline.Content flexDirection="row" alignItems="center">
        <ActivityText>
          <ActivityUser user={user} /> changed {data.field} to {data.value}
          {data.oldValue && ` from ${data.oldValue}`}.
        </ActivityText>
        <Span textStyle="sm" color="fg.muted">
          •
        </Span>
        <ActivityLink href={`#update-${id}`} color="fg.muted" textStyle="xs">
          <ActivityTimelineDate date={date} />
        </ActivityLink>
      </Timeline.Content>
    </ActivityTimelineItem>
  );
};

interface ActivityTimelineCommentProps extends ActivityComment {
  onDelete?(id: string | number): Promise<void>;
}

const ActivityTimelineComment: React.FC<ActivityTimelineCommentProps> = (
  props,
) => {
  const { id, user, data, date, onDelete } = props;
  const modals = useModals();

  return (
    <ActivityTimelineItem
      id={`comment-${id}`}
      icon={<UserAvatar user={user} size="2xs" mt="2" />}
    >
      <Timeline.Content>
        <Card.Root mb="4">
          <Card.Body py="2">
            <HStack mb="4">
              <ActivityUser user={user} />
              <ActivityLink href={`#action-${id}`} color="muted">
                <ActivityTimelineDate date={date} />
              </ActivityLink>
              <Group
                position="absolute"
                top="2"
                right="2"
                opacity="0"
                transition="all .2s ease-in"
                _groupHover={{ opacity: 1 }}
              >
                <OverflowMenu.Root>
                  <OverflowMenu.Item
                    value="delete"
                    onClick={() =>
                      modals.confirm({
                        title: "Are you sure you want to delete this comment?",
                        children: "This action cannot be undone.",
                        confirmProps: { colorPalette: "red" },
                        onConfirm: () => onDelete?.(id),
                      })
                    }
                  >
                    Delete
                  </OverflowMenu.Item>
                </OverflowMenu.Root>
              </Group>
            </HStack>

            <Box
              dangerouslySetInnerHTML={{ __html: data.comment }}
              wordBreak="break-all"
              textStyle="sm"
            />
          </Card.Body>
        </Card.Root>
      </Timeline.Content>
    </ActivityTimelineItem>
  );
};

const commentSchema = z.object({
  comment: z
    .string({
      required_error: "Please add a comment",
    })
    .min(1, "Please add a comment"),
});

interface Comment {
  files?: FileList;
  comment: string;
}

interface ActivityTimelineAddCommentProps {
  onSubmit: (data: Comment) => Promise<any>;
  user: User;
}

const ActivityTimelineAddComment: React.FC<ActivityTimelineAddCommentProps> = (
  props,
) => {
  const { onSubmit } = props;

  const submitRef = React.useRef<HTMLButtonElement>(null);

  const form = useAppForm({
    validators: {
      onSubmit: commentSchema,
    },
    defaultValues: {
      comment: "",
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);

      form.reset({
        comment: "",
      });
    },
  });

  return (
    <Card.Root py="3" px="4">
      <Form form={form}>
        <form.Layout gap="0">
          <form.AppField name="comment">
            {(field) => (
              <field.EditorField
                border="0"
                padding="0"
                placeholder="Write your comment..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    submitRef.current?.click();
                  }
                }}
              />
            )}
          </form.AppField>
          <ButtonGroup>
            <Spacer />
            <Tooltip content="Upload a file">
              <IconButton color="fg.muted" aria-label="Upload a file">
                <LuPaperclip />
              </IconButton>
            </Tooltip>
            <Tooltip
              content={
                <>
                  Submit comment <Command>⌘ enter</Command>
                </>
              }
            >
              <form.SubmitButton ref={submitRef}>Comment</form.SubmitButton>
            </Tooltip>
          </ButtonGroup>
        </form.Layout>
      </Form>
    </Card.Root>
  );
};
