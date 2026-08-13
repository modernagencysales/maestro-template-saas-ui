"use client";

import * as React from "react";

import {
  Box,
  Card,
  Flex,
  HStack,
  Separator,
  Spacer,
  Textarea,
} from "@chakra-ui/react";
import {
  LuChevronLeft,
  LuEllipsisVertical,
  LuPlus,
  LuSend,
  LuStar,
} from "react-icons/lu";

import * as Menu from "@/components/ui/menu/menu";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Persona } from "@/components/ui/persona/persona-composed";

export function ChatDetails(props: { chat: Chat; currentUser: User }) {
  const { chat, currentUser } = props;

  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const [items, setItems] = React.useState(chat.items);

  const mappedItems = items.map((item) => {
    if (
      item.type !== "divider" &&
      item.from?.type === "admin" &&
      currentUser.id === item.from.id
    ) {
      return {
        ...item,
        from: {
          ...item.from,
          name: "You",
        },
      };
    }
    return item;
  });

  const [message, setMessage] = React.useState("");

  const submitMessage = React.useCallback(() => {
    setItems((items) => [
      ...items,
      {
        id: String(items.length + 1),
        type: "outbound-message",
        message,
        date: new Date().toISOString(),
        from: {
          type: "admin",
          ...currentUser,
        },
      },
    ]);
    setMessage("");
  }, [currentUser, message]);

  return (
    <Card.Root height="500px" maxW="container.sm" mx="auto">
      <Card.Header
        display="flex"
        flexDirection="row"
        alignItems="center"
        gap="1"
        borderBottomWidth="1px"
        p="1.5"
      >
        <IconButton aria-label="All chats" variant="ghost">
          <LuChevronLeft />
        </IconButton>
        <Persona
          size="sm"
          label={chat.contact.name}
          secondaryLabel={chat.contact.email}
          src={chat.contact.avatar}
        />
        <Spacer />
        <IconButton aria-label="Add to favourties" variant="ghost">
          <LuStar />
        </IconButton>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton variant="ghost" size="sm" aria-label="More options">
              <LuEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item value="archive">Archive chat</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </Card.Header>
      <Card.Body
        minHeight="0"
        flex="1"
        p="0"
        bg="gray.50"
        _dark={{ bg: "gray.800" }}
      >
        <ChatBody items={mappedItems} />
      </Card.Body>
      <Card.Footer borderTopWidth="1px" gap="2" p="1.5">
        <IconButton aria-label="Attach file" variant="ghost">
          <LuPlus />
        </IconButton>
        <Box
          display="grid"
          flex="1"
          fontSize="sm"
          _after={{
            // this will make sure the textarea height scales based on the content.
            // `field-sizing="content"` is not widely supported yet.
            // alternatively, you can use a div with contentEditable=true, eg with tiptap editor.
            content: 'attr(data-value) " "',
            whiteSpace: "pre-wrap",
            visibility: "hidden",
            gridArea: "1 / 1 / 2 / 2",
            py: "1.5",
            px: "3",
            border: "1px",
          }}
          data-value={message}
        >
          <Textarea
            ref={inputRef}
            gridArea="1 / 1 / 2 / 2"
            field-sizing="content"
            placeholder="Write your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                submitMessage();
              }
            }}
            height="auto"
            minHeight="8"
            resize="none"
            rows={1}
            py="1.5"
            px="3"
          />
        </Box>
        <IconButton
          ml="auto"
          colorPalette="primary"
          aria-label="Send"
          onClick={() => {
            submitMessage();

            inputRef.current?.focus();
          }}
        >
          <LuSend />
        </IconButton>
      </Card.Footer>
    </Card.Root>
  );
}

interface ChatBodyProps {
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  items: ChatItemProps[];
}

function ChatBody(props: ChatBodyProps) {
  const { items, onScroll: onScrollProp, ...rest } = props;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);
  const isAtBottom = React.useRef(true);

  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (initialized.current) {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        // include some padding to also scroll to bottom when we're not exactly at the bottom.
        isAtBottom.current = scrollTop + clientHeight >= scrollHeight - 40;
      }
      onScrollProp?.(event);
    },
    [onScrollProp],
  );

  React.useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const scrollToBottom = (animate?: boolean) =>
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: animate ? "smooth" : "instant",
      });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          if (isAtBottom.current) {
            scrollToBottom(true);
          }
        }
      }
    });
    observer.observe(scrollRef.current, { childList: true });

    scrollToBottom();

    initialized.current = true;

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Box
      ref={scrollRef}
      {...rest}
      height="100%"
      overflowY="auto"
      p="3"
      onScroll={onScroll}
    >
      {items.map((item) => (
        <ChatItem key={"id" in item ? item.id : item.date} {...item} />
      ))}
    </Box>
  );
}

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface Contact {
  name: string;
  email: string;
  avatar?: string;
}

export interface Chat {
  contact: Contact;
  items: ChatItemProps[];
}

interface ChatItemFrom {
  id: string;
  type: "user" | "system" | "bot" | "admin";
  name: string;
  avatar?: string;
}

interface ChatItemMessage {
  id: string;
  type: "outbound-message" | "inbound-message";
  date: string;
  from: ChatItemFrom;
  message: string;
}

interface ChatItemDivider {
  type: "divider";
  date: string;
}

type ChatItemProps = ChatItemMessage | ChatItemDivider;

const ChatItem: React.FC<ChatItemProps> = (props) => {
  switch (props.type) {
    case "outbound-message":
      return <ChatMessage {...props} />;
    case "inbound-message":
      return <ChatMessage {...props} />;
    case "divider":
      return <ChatItemDateDivider {...props} />;
    default:
      return null;
  }
};

interface ChatMessageProps {
  type: "outbound-message" | "inbound-message";
  message: string;
  date: string;
  from: ChatItemFrom;
}

const ChatMessage: React.FC<ChatMessageProps> = (props) => {
  const { type, from, message, date } = props;

  let styles = {
    alignItems: "flex-start",
    "--message-bg": "colors.gray.500",
  };

  if (type === "outbound-message") {
    styles = {
      alignItems: "flex-end",
      "--message-bg": "colors.accent.solid",
    };
  }

  return (
    <Flex mt="4" _first={{ mt: 0 }} direction="column" css={styles}>
      <Box
        px="2"
        py="1"
        borderRadius="md"
        bg="var(--message-bg)"
        color="white"
        maxW="80%"
        textStyle="sm"
      >
        {message}
      </Box>
      <HStack fontSize="xs" color="fg.muted" alignItems="center" mt="2" gap="1">
        <Persona size="2xs" label={from.name} src={from.avatar} />
        <span>∙</span>
        <Box>
          <FormattedDate date={date} />
        </Box>
      </HStack>
    </Flex>
  );
};

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

interface ChatItemDateDividerProps {
  date: string;
}

const ChatItemDateDivider: React.FC<ChatItemDateDividerProps> = (props) => {
  const { label, color } = React.useMemo(() => {
    let label = "";
    const date = new Date(props.date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = isSameDay(date, today);

    if (isToday) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString();
    }

    return {
      label,
      color: isToday ? "red.500" : "muted",
    };
  }, [props.date]);

  const divider = (
    <Separator
      borderColor="currentColor"
      opacity="0.15"
      _dark={{ opacity: "0.5" }}
    />
  );

  return (
    <HStack color={color} fontSize="xs" fontWeight="medium" gap="3" my="3">
      {divider}
      <Box flexShrink="0">{label}</Box>
      {divider}
    </HStack>
  );
};

const FormattedDate: React.FC<{ date: string }> = (props) => {
  const [now, setNow] = React.useState(new Date());
  const [date] = React.useState(new Date(props.date));

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  const diff = now.getTime() - date.getTime();

  if (diff < 1000 * 60) {
    return "Just now";
  } else if (isSameDay(now, date)) {
    return (
      <>
        {date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </>
    );
  }

  return (
    <>
      {date.toLocaleDateString()}{" "}
      {date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </>
  );
};
