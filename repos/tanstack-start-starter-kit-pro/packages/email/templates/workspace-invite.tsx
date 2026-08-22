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

export function WorkspaceInviteEmail(props: {
  token: string
  confirmUrl: string
  workspace?: string
  invitedBy?: string
}) {
  return (
    <Html>
      <Head />
      <Preview>
        You have been invited to join a workspace on {config.appName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Logo width="30" height="30" />

          <Heading style={heading}>You have been invited</Heading>

          <Text style={paragraph}>
            {props.invitedBy
              ? `${props.invitedBy} invited you`
              : "You've been invited"}{' '}
            to join {props.workspace ?? 'a workspace'} on {config.appName}.
          </Text>

          <Section style={buttonContainer}>
            <Button href={props.confirmUrl} style={button}>
              Accept invitation
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

WorkspaceInviteEmail.PreviewProps = {
  confirmUrl: '#',
  token: '1234567890',
  workspace: 'Acme',
  invitedBy: 'John Doe',
}

export default WorkspaceInviteEmail
