import type { ReactNode } from "react";
import { Aside } from "@saas-ui-pro/react";
import { DataList, Text } from "@saas-ui/react";

// Adapted from the pinned starter contacts/view/contact-sidebar.tsx.
export function RecordAside({
  children,
  details,
  open,
  title,
}: {
  readonly children?: ReactNode;
  readonly details: readonly {
    readonly label: string;
    readonly value: ReactNode;
  }[];
  readonly open: boolean;
  readonly title: string;
}) {
  return (
    <Aside.Root
      bg="bg.panel"
      borderInlineStartWidth="1px"
      open={open}
      width={{ base: "min(80vw, 24rem)", lg: "22rem" }}
    >
      <Aside.Header>
        <Aside.Title>{title}</Aside.Title>
      </Aside.Header>
      <Aside.Body>
        <DataList.Root orientation="horizontal" size="sm">
          {details.map((detail) => (
            <DataList.Item key={detail.label}>
              <DataList.ItemLabel>{detail.label}</DataList.ItemLabel>
              <DataList.ItemValue>
                <Text overflowWrap="anywhere">{detail.value}</Text>
              </DataList.ItemValue>
            </DataList.Item>
          ))}
        </DataList.Root>
        {children}
      </Aside.Body>
    </Aside.Root>
  );
}
