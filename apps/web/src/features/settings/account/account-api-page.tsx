"use client";

import {
  Button,
  ButtonGroup,
  GridList,
  IconButton,
  Section,
  Text,
  useClipboard,
} from "@saas-ui/react";
import { LuCheck, LuCopy, LuX } from "react-icons/lu";

import { LinkButton } from "@workspace/ui/button";
import { SettingsPage } from "@workspace/ui/settings-page";

import { SettingsCard } from "../common/settings-card";

function AccessToken({ token, onRemove }: any) {
  const { value, copy, copied } = useClipboard(token);

  const handleRemove = () => {
    onRemove?.(token);
  };

  return (
    <GridList.Item onClick={copy}>
      <GridList.Cell flex="1">
        <Text textStyle="sm">{value}</Text>
      </GridList.Cell>
      <GridList.Cell px="4">{copied ? <LuCheck /> : <LuCopy />}</GridList.Cell>
      <GridList.Cell>
        <IconButton
          aria-label="Remove access token"
          variant="ghost"
          onClick={handleRemove}
        >
          <LuX />
        </IconButton>
      </GridList.Cell>
    </GridList.Item>
  );
}

function PersonalAccessTokens() {
  const onRemove = () => null;

  return (
    <Section.Root>
      <Section.Header title="Personal access tokens" />
      <Section.Body>
        <SettingsCard
          footer={<Button variant="primary">Create new token</Button>}
        >
          <GridList.Root p="0">
            <AccessToken token="12345" onRemove={onRemove} />
          </GridList.Root>
        </SettingsCard>
      </Section.Body>
    </Section.Root>
  );
}

export function AccountApiPage() {
  return (
    <SettingsPage
      title="API access"
      description="Access the our API."
      actions={
        <ButtonGroup>
          <LinkButton href="#">API documentation</LinkButton>
        </ButtonGroup>
      }
    >
      <PersonalAccessTokens />
    </SettingsPage>
  );
}
