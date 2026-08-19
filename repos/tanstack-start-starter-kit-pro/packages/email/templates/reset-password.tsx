import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'react-email'

import { config } from '#config'

import { Logo } from '../components/logo'
import {
  body,
  button,
  buttonContainer,
  container,
  heading,
  paragraph,
} from '../styles'

export function ResetPasswordEmail(props: {
  token: string
  resetUrl: string
  user: {
    email: string
    name: string
  }
}) {
  return (
    <Html>
      <Head />
      <Preview>Reset your {config.appName} password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Logo width="30" height="30" />

          <Heading style={heading}>Reset your password</Heading>

          <Text style={paragraph}>
            We received a request to reset the password for your{' '}
            {config.appName} account.
          </Text>

          <Text style={paragraph}>
            If you did not request a password reset, please ignore this email.
          </Text>

          <Section style={buttonContainer}>
            <Button href={props.resetUrl} style={button}>
              Reset password
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

ResetPasswordEmail.PreviewProps = {
  resetUrl: '#',
  user: {
    email: 'john@doe.com',
    name: 'John Doe',
  },
  token: '1234567890',
}

export default ResetPasswordEmail
