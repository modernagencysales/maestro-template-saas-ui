import { env } from 'env'

import { Resend } from 'resend'

export { render } from 'react-email'

let resend: Resend

const getResend = () => {
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY)
  }

  return resend
}

export interface SendParams {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export const mailer = {
  send: async (params: SendParams) => {
    await getResend().emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
  },
  batchSend: async (emails: SendParams[]) => {
    const result = await getResend().batch.send(
      emails.map((email) => ({
        from: env.EMAIL_FROM,
        ...email,
      })),
    )

    if (result.error) {
      throw new Error(result.error.message)
    }
  },
}
