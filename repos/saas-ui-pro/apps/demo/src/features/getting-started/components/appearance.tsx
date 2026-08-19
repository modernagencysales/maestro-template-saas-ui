import {
  AspectRatio,
  Flex,
  Image,
  Stack,
  type StackProps,
  Text,
} from '@chakra-ui/react'
import { z } from 'zod'

import * as Steps from '#ui/steps/steps'
import { type ColorMode, useColorMode } from '#components/color-mode.tsx'
import { Form, useAppForm } from '#components/forms'

import { OnboardingStep } from './onboarding-step'

const appearanceSchema = z.object({
  mode: z.enum(['light', 'dark']),
})

interface ThemeOptionProps extends Omit<StackProps, 'onSelect'> {
  mode: ColorMode
  isSelected: boolean
  onSelect: (mode: ColorMode) => void
}

function ThemeOption({
  mode,
  isSelected,
  onSelect,
  ...stackProps
}: ThemeOptionProps) {
  return (
    <Stack
      flex="1"
      p="8"
      role="radio"
      aria-checked={isSelected}
      cursor="pointer"
      _hover={{ bg: 'bg.muted' }}
      onClick={() => onSelect(mode)}
      {...stackProps}
    >
      <AspectRatio
        className={mode}
        ratio={16 / 9}
        height="100px"
        borderRadius="md"
        overflow="hidden"
        borderWidth="1px"
        bg="bg"
        data-selected={isSelected ? '' : undefined}
        _selected={{
          borderColor: 'accent.solid',
        }}
      >
        <Image
          src={`/img/onboarding/${mode}.svg`}
          alt={`${mode} theme preview`}
          loading="lazy"
        />
      </AspectRatio>
      <Text textTransform="capitalize" textStyle="sm" textAlign="center">
        {mode}
      </Text>
    </Stack>
  )
}

export function AppearanceStep() {
  const stepper = Steps.useContext()

  const { colorMode, setColorMode } = useColorMode()

  const form = useAppForm({
    validators: { onSubmit: appearanceSchema },
    defaultValues: {
      mode: colorMode,
    },
    onSubmit: () => {
      stepper.goToNextStep()
    },
  })

  return (
    <Form form={form}>
      <OnboardingStep
        title="Choose your style"
        description="You can change the color mode at any time in your profile settings."
        submitLabel="Continue"
        maxW="lg"
      >
        <Flex m="-6" role="radiogroup" aria-label="Select colour theme">
          <form.AppField name="mode">
            {(field) => (
              <>
                <ThemeOption
                  mode="light"
                  isSelected={field.state.value === 'light'}
                  onSelect={(mode) => {
                    field.handleChange(mode)
                    setColorMode(mode)
                  }}
                />
                <ThemeOption
                  mode="dark"
                  isSelected={field.state.value === 'dark'}
                  onSelect={(mode) => {
                    field.handleChange(mode)
                    setColorMode(mode)
                  }}
                />
              </>
            )}
          </form.AppField>
        </Flex>
      </OnboardingStep>
    </Form>
  )
}
