import {
  Card,
  type ContainerProps,
  Flex,
  Heading,
  Text,
} from '@chakra-ui/react'
import { keyframes } from '@emotion/react'

import { SubmitButton } from '#components/forms'

export interface OnboardingStepProps {
  title: string
  description: string
  submitLabel: string
  maxW?: ContainerProps['maxW']
  children: React.ReactNode
}

const fade = keyframes`
  0% {
    opacity: 0;
    transform: translate3d(0px, -10px, 0px);
  }
  100% {
    opacity: 1;
    transform: none;
  }
`

const animation = (delay = 0) =>
  `.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s 1 normal both running ${fade}`

export const OnboardingStep = (props: OnboardingStepProps) => {
  const {
    title,
    description,
    submitLabel,
    maxW = { base: '100%', md: '80%' },
    children,
  } = props

  return (
    <Flex flexDirection="column" alignItems="center" textAlign="center" mb="12">
      <Heading as="h2" animation={animation(0)} size="2xl" mb="2">
        {title}
      </Heading>
      <Text color="fg.subtle" fontSize="md" animation={animation(0.1)} mb="8">
        {description}
      </Text>

      <Card.Root
        mb="6"
        animation={animation(0.2)}
        zIndex="2"
        mx="auto"
        width="100%"
        maxW={maxW}
        variant="elevated"
      >
        <Card.Body p="6">{children}</Card.Body>
      </Card.Root>

      <SubmitButton
        size="lg"
        width="80%"
        maxW="320px"
        margin="0 10%"
        animation={animation(0.3)}
      >
        {submitLabel}
      </SubmitButton>
    </Flex>
  )
}
