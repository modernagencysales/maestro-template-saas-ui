import { useStepsContext } from "@chakra-ui/react";
import { useSessionStorageValue } from "@react-hookz/web";
import { toast } from "@saas-ui/react";

import { Form, useAppForm } from "@workspace/ui/form";

import { api } from "#lib/trpc/react";

import { OnboardingStep } from "./onboarding-step";
import { inviteTeamSchema, parseEmails } from "./schema/invite-team.schema";

export const InviteTeamMembersStep = () => {
  const workspace = useSessionStorageValue<string>("getting-started.workspace");

  const stepper = useStepsContext();

  const { mutateAsync: invite } = api.workspaceMembers.invite.useMutation();

  const form = useAppForm({
    validators: {
      onBlur: inviteTeamSchema,
      onSubmit: inviteTeamSchema,
    },
    defaultValues: { emails: "" },
    onSubmit: async ({ value }) => {
      if (workspace.value && value.emails) {
        try {
          await invite({
            workspaceId: workspace.value,
            emails: parseEmails(value.emails),
          });
        } catch {
          toast.error({
            title: "Failed to invite team members",
            description: "Please try again or skip this step.",
            action: {
              label: "Skip",
              onClick: () => stepper.goToNextStep(),
            },
          });
          return;
        }
      }
      stepper.goToNextStep();
    },
  });

  return (
    <Form form={form}>
      <OnboardingStep
        title="Invite your team"
        description="Saas.js works better with your team."
        submitLabel="Continue"
        maxW="lg"
      >
        <form.Layout>
          <form.AppField name="emails">
            {(field) => (
              <field.TextareaField
                label="Email address(es)"
                placeholder="member@acme.co, member2@acme.co"
                rows={3}
                autoFocus
              />
            )}
          </form.AppField>
        </form.Layout>
      </OnboardingStep>
    </Form>
  );
};
