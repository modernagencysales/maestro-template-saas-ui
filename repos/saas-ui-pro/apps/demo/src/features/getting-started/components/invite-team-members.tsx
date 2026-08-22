import * as z from 'zod'
import { useSessionStorageValue } from '@react-hookz/web'
import { useMutation } from '@tanstack/react-query'

import * as Steps from '#ui/steps/steps'
import { inviteToOrganization } from '#api'
import { Form, useAppForm } from '#components/forms'
import { toast } from '#ui/toaster/toaster'

import { OnboardingStep } from './onboarding-step'

const schema = z.object({
  emails: z.string(),
})

function parseEmails(emails: string) {
  return emails.split(',').map((email) => email.trim())
}

export const InviteTeamMembersStep = () => {
  const workspace = useSessionStorageValue<string>('getting-started.workspace')

  const stepper = Steps.useContext()

  const { mutateAsync: invite } = useMutation({
    mutationFn: inviteToOrganization,
  })

  const form = useAppForm({
    validators: { onSubmit: schema },
    defaultValues: { emails: '' },
    onSubmit: async ({ value }) => {
      if (workspace.value && value.emails) {
        try {
          await invite({
            organizationId: workspace.value,
            emails: parseEmails(value.emails),
          })
        } catch {
          toast.error({
            title: 'Failed to invite team members',
            description: 'Please try again or skip this step.',
            action: {
              label: 'Skip',
              onClick: () => stepper.goToNextStep(),
            },
          })
          return
        }
      }
      stepper.goToNextStep()
    },
  })

  return (
    <Form form={form}>
      <OnboardingStep
        title="Invite your team"
        description="Saas UI works better with your team."
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
  )
}
