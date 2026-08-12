import * as React from "react";

import {
  Card,
  LinkBox,
  LinkOverlay,
  LinkOverlayProps,
  Stack,
  Text,
} from "@chakra-ui/react";
import { IconBadge } from "@saas-ui/react";

interface SupportCardProps
  extends Omit<Card.RootProps, "title">, Pick<LinkOverlayProps, "href"> {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}

export const SupportCard: React.FC<SupportCardProps> = (props) => {
  const { title, description, icon, href } = props;
  return (
    <Card.Root
      variant="outline"
      size="sm"
      _hover={{ borderColor: "border.emphasized" }}
      asChild
    >
      <LinkBox>
        <Card.Body display="flex" flexDirection="row" gap="2">
          <IconBadge
            icon={icon}
            borderRadius="full"
            colorPalette="gray"
            fontSize="1em"
            flexShrink={0}
          />
          <Stack gap="0">
            <LinkOverlay href={href} fontWeight="medium" textStyle="sm">
              {title}
            </LinkOverlay>

            <Text fontSize="xs" color="fg.muted">
              {description}
            </Text>
          </Stack>
        </Card.Body>
      </LinkBox>
    </Card.Root>
  );
};
