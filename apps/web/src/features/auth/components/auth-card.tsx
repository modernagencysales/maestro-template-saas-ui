import { Heading } from "@chakra-ui/react";
import { Card } from "@saas-ui/react/card";

import { Logo } from "@workspace/ui/logo";

export function AuthCard(props: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card.Root
      variant="elevated"
      size="lg"
      bg="bg.subtle"
      borderColor="border.emphasized/80"
    >
      <Card.Body borderRadius="lg" borderBottomWidth="1px" bg="bg.panel" p="6">
        <Logo mb="6" width="120px" mx="auto" />

        <Heading as="h2" size="lg" mb="4" textAlign="center">
          {props.title}
        </Heading>

        {props.children}
      </Card.Body>
      <Card.Footer
        borderBottomRadius="md"
        textAlign="center"
        justifyContent="center"
        pb="3"
      >
        {props.footer}
      </Card.Footer>
    </Card.Root>
  );
}
