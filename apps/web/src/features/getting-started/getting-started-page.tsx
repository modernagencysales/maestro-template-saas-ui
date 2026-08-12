"use client";

import * as React from "react";

import {
  Center,
  Container,
  defineSlotRecipe,
  useStepsContext,
} from "@chakra-ui/react";
import { useSessionStorageValue } from "@react-hookz/web";
import { LoadingOverlay, Steps } from "@saas-ui/react";
import { useNavigate } from "@tanstack/react-router";

import { AppearanceStep } from "./appearance";
import { CreateWorkspaceStep } from "./create-workspace";
import { InviteTeamMembersStep } from "./invite-team-members";
import { OnboardingLayout } from "./onboarding-layout";
import { SubscribeStep } from "./subscribe";

// TODO move to theme
const recipe = defineSlotRecipe({
  className: "steps",
  slots: ["root", "list", "item", "indicator", "title"],
  variants: {
    variant: {
      dots: {
        list: {
          display: "flex",
          gap: 2,
          justifyContent: "center",
        },
        indicator: {
          boxSize: 2,
          overflow: "hidden",
          bg: "colorPalette.subtle",
          rounded: "full",
          _current: {
            bg: "colorPalette.solid",
          },
          "& *": {
            display: "none",
          },
        },
        title: {
          display: "none",
        },
      },
    },
  },
});

export const GettingStartedPage: React.FC = () => {
  const workspace = useSessionStorageValue<string>("getting-started.workspace");

  const defaultStep = workspace.value ? 1 : 0;

  return (
    <OnboardingLayout>
      <Container maxW="container.md">
        <Center minH="calc(100vh - 100px)">
          <Steps.Root
            variant={"dots" as any}
            recipe={recipe}
            defaultStep={defaultStep}
            count={4}
            width="full"
          >
            <OnboardingSteps />

            <Steps.List>
              <Steps.Item index={0} title="Create organization" />
              <Steps.Item index={1} title="Choose your style" />
              <Steps.Item index={2} title="Invite team members" />
              <Steps.Item index={3} title="Subscribe to updates" />
            </Steps.List>
          </Steps.Root>
        </Center>
      </Container>
    </OnboardingLayout>
  );
};

function OnboardingSteps() {
  const stepper = useStepsContext();

  return (
    <>
      <Steps.Content index={0} title="Create organization">
        {stepper.value === 0 && <CreateWorkspaceStep />}
      </Steps.Content>
      <Steps.Content index={1} title="Choose your style">
        {stepper.value === 1 && <AppearanceStep />}
      </Steps.Content>
      <Steps.Content index={2} title="Invite team members">
        {stepper.value === 2 && <InviteTeamMembersStep />}
      </Steps.Content>
      <Steps.Content index={3} title="Subscribe to updates">
        {stepper.value === 3 && <SubscribeStep />}
      </Steps.Content>

      <Steps.CompletedContent>
        {stepper.percent === 100 && <OnboardingCompleted />}
      </Steps.CompletedContent>
    </>
  );
}

const OnboardingCompleted = () => {
  const navigate = useNavigate();

  const workspace = useSessionStorageValue<string>("getting-started.workspace");

  return (
    <LoadingOverlay.Root
      position="fixed"
      inset="0"
      bg="bg"
      ref={() => {
        navigate({
          to: "/$workspace",
          params: {
            workspace: workspace.value!,
          },
        });
      }}
    >
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  );
};
