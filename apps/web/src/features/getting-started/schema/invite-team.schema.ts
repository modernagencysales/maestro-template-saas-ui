import * as z from 'zod'

export function parseEmails(value: string): string[] {
  return (
    value
      // Split by commas, spaces, or newlines and filter out empty strings
      .split(/[,\s\n]+/)
      .map((email) => email.trim())
      .filter(Boolean)
  )
}

export const inviteTeamSchema = z.object({
  emails: z
    .string()
    .refine(
      (value) =>
        parseEmails(value).every((email) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        ),
      {
        message:
          'Please enter valid email addresses separated by commas, spaces, or new lines',
      },
    ),
})

export type InviteTeamFormInput = z.infer<typeof inviteTeamSchema>
