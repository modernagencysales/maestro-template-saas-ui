import { Container } from '@chakra-ui/react'

export function StoryCanvas(props: {
  children: React.ReactNode
  center?: boolean
  maxWidth?: string
}) {
  return (
    <Container maxWidth={props.maxWidth} centerContent height="100dvh">
      {props.children}
    </Container>
  )
}
