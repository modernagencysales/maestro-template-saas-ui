import * as React from "react";

import { Box, Card, HStack, Heading, Input, Text } from "@chakra-ui/react";
import {
  LuCalendar,
  LuCircleCheck,
  LuCircleDashed,
  LuCircleDot,
  LuListChecks,
  LuMilestone,
  LuSignalHigh,
  LuSignalLow,
  LuSignalMedium,
  LuSignalZero,
} from "react-icons/lu";

import * as Menu from "@/components/ui/menu/menu";
import * as Persona from "@/components/ui/persona/persona";
import type { PersonaPresence } from "@/components/ui/persona/presence";
import { Tag } from "@/components/ui/tag/tag";
import { Tooltip } from "@/components/ui/tooltip/tooltip";

export interface Task {
  status: TaskState;
  priority: Priority;
  dueDate: string;
  milestone: string;
  subtasks: string;
  tags: Array<string>;
  user: {
    name: string;
    avatar: string;
    presence: PersonaPresence;
  };
}

export function TaskCardWithLabels(props: { task: Task }) {
  const { task } = props;

  return (
    <Card.Root size="md">
      <Card.Header gap="2" position="relative">
        <HStack mb="1" alignItems="center">
          <TaskStatus status={task.status} />

          <Heading size="sm" fontWeight="medium" lineClamp={1}>
            Define design tokens
          </Heading>
        </HStack>

        <Text textStyle="sm" color="fg.muted" mb="2" lineClamp={2}>
          Design consistent variables for visual properties like colors,
          typography, and spacing.
        </Text>

        <Persona.Root
          size="2xs"
          position="absolute"
          top="2"
          right="3"
          presence={task.user.presence}
        >
          <Persona.Avatar src={task.user.avatar} name={task.user.name}>
            <Persona.PresenceBadge />
          </Persona.Avatar>
        </Persona.Root>
      </Card.Header>
      <Card.Footer borderTopWidth="1px">
        <TaskTags tags={task.tags} />
      </Card.Footer>
    </Card.Root>
  );
}

function TaskStatus(props: { status: Task["status"] }) {
  const status = states[props.status];

  const trigger = React.useId();

  const [search, setSearch] = React.useState("");

  const items = React.useMemo(() => {
    return Object.entries(states).filter(([key, status]) =>
      status.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  return (
    <Tooltip ids={{ trigger }} content="Change status">
      <Menu.Root
        ids={{ trigger }}
        positioning={{ placement: "right-start", offset: { crossAxis: -9 } }}
      >
        <Menu.Trigger asChild>
          <Box color={status.color} rounded="full" aria-label={status.label}>
            {status.icon}
          </Box>
        </Menu.Trigger>
        <Menu.Content>
          <Input
            placeholder="Change status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            border="0"
            mx="-1"
            mt="-1"
          />
          <Menu.Separator mt="0" />
          {items.map(([key, status]) => (
            <Menu.Item key={key} value={key}>
              {status.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Root>
    </Tooltip>
  );
}

function TaskTags(props: { tags: Array<string> }) {
  const visibleTags = props.tags.slice(0, 3);
  const hiddenTags = props.tags.slice(3).length;

  return (
    <>
      {visibleTags?.map((id, i) => {
        const tag = tags.find((t) => t.id === id);

        if (!tag) {
          return null;
        }

        return (
          <Tag
            key={i}
            variant="outline"
            boxShadow="none"
            border="1px solid"
            borderColor="blackAlpha.300"
            color="gray.600"
            _dark={{
              borderColor: "whiteAlpha.300",
              color: "gray.300",
            }}
            startElement={
              <Box
                colorPalette={tag.color}
                bg="colorPalette.solid"
                boxSize="2"
                rounded="full"
                me="1"
              />
            }
          >
            {tag.label}
          </Tag>
        );
      })}
      {hiddenTags > 0 && (
        <Tag
          variant="outline"
          mr="1"
          boxShadow="none"
          border="1px dashed"
          borderColor="blackAlpha.300"
          color="muted"
          _dark={{
            borderColor: "whiteAlpha.200",
          }}
        >
          +{hiddenTags}
        </Tag>
      )}
    </>
  );
}

const states = {
  backlog: {
    label: "Backlog",
    color: "gray",
    icon: <LuCircleDashed />,
  },
  "in-progress": {
    label: "In progress",
    color: "green",
    icon: <LuCircleDot />,
  },
  completed: {
    label: "Completed",
    color: "blue",
    icon: <LuCircleCheck />,
  },
};

type TaskState = keyof typeof states;

const properties = {
  dueDate: {
    icon: <LuCalendar />,
    label: "Due date",
  },
  milestone: {
    icon: <LuMilestone />,
    label: "Milestone",
  },
  priority: {
    icon: (priority: Task["priority"]) => priorities[priority]?.icon,
    label: "Priority",
    value: (priority: Task["priority"]) => priorities[priority]?.label,
  },
  subtasks: {
    icon: <LuListChecks />,
    label: "Subtasks",
  },
};

type TaskPropertyId = keyof typeof properties;

const priorities = {
  0: {
    label: "None",
    icon: <LuSignalZero />,
  },
  1: {
    label: "Low",
    icon: <LuSignalLow />,
  },
  2: {
    label: "Medium",
    icon: <LuSignalMedium />,
  },
  3: {
    label: "High",
    icon: <LuSignalHigh />,
  },
};

const tags = [
  {
    id: "css",
    label: "CSS",
    color: "blue",
  },
  {
    id: "ui",
    label: "UI",
    color: "green",
  },
  {
    id: "javascript",
    label: "Javascript",
    color: "yellow",
  },
  {
    id: "react",
    label: "React",
    color: "blue",
  },
];

type Priority = keyof typeof priorities;
