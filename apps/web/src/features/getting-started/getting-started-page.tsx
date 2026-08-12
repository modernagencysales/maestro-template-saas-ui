"use client";

import * as React from "react";

import {
  Box,
  Center,
  Container,
  HStack,
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

export const GettingStartedPage: React.FC = () => {
  const workspace = useSessionStorageValue<string>("getting-started.workspace");

  const defaultStep = workspace.value ? 1 : 0;

  return (
    <OnboardingLayout>
      <Container maxW="container.md">
        <Center minH="calc(100vh - 100px)">
          <Steps.Root defaultStep={defaultStep} count={4} width="full">
            <OnboardingSteps />
            <OnboardingProgress />
          </Steps.Root>
        </Center>
      </Container>
    </OnboardingLayout>
  );
};

function OnboardingProgress() {
  const stepper = useStepsContext();

  return (
    <HStack
      aria-label={`Onboarding step ${stepper.value + 1} of 4`}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={stepper.value + 1}
      gap="2"
      justifyContent="center"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Box
          key={index}
          aria-hidden="true"
          boxSize="2"
          bg={
            index === stepper.value
              ? "colorPalette.solid"
              : "colorPalette.subtle"
          }
          rounded="full"
        />
      ))}
    </HStack>
  );
}

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

  return (
    <LoadingOverlay.Root
      position="fixed"
      inset="0"
      bg="bg"
      ref={() => {
        navigate({
          to: "/",
        });
      }}
    >
      <LoadingOverlay.Spinner />
    </LoadingOverlay.Root>
  );
};
