import {
  AspectRatio,
  Flex,
  Image,
  Stack,
  StackProps,
  Text,
  useStepsContext,
} from '@chakra-ui/react'

import { Form, useAppForm } from '@workspace/ui/form'

import { type ColorMode, useColorMode } from '#components/color-mode.tsx'

import { OnboardingStep } from './onboarding-step'
import { appearanceSchema } from './schema/appearance.schema'

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
  const stepper = useStepsContext()
  const { colorMode, setColorMode } = useColorMode()

  const form = useAppForm({
    validators: {
      onSubmit: appearanceSchema,
    },
    defaultValues: {},
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
          <ThemeOption
            mode="light"
            isSelected={colorMode === 'light'}
            onSelect={setColorMode}
          />
          <ThemeOption
            mode="dark"
            isSelected={colorMode === 'dark'}
            onSelect={setColorMode}
          />
        </Flex>
      </OnboardingStep>
    </Form>
  )
}
