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

import { Logo } from '../components/logo'
import {
  body,
  button,
  buttonContainer,
  container,
  heading,
  paragraph,
} from '../styles'

export function ConfirmEmailAddressEmail(props: {
  token: string
  confirmUrl: string
}) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your email address</Preview>
      <Body style={body}>
        <Container style={container}>
          <Logo width="30" height="30" />

          <Heading style={heading}>Confirm your email address</Heading>

          <Text style={paragraph}>
            Please confirm your email address by clicking the button below.
          </Text>

          <Section style={buttonContainer}>
            <Button href={props.confirmUrl} style={button}>
              Confirm email address
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

ConfirmEmailAddressEmail.PreviewProps = {
  confirmUrl: '#',
  token: '1234567890',
  user: {
    email: 'john@doe.com',
    name: 'John Doe',
  },
}

export default ConfirmEmailAddressEmail
