import { useEffect } from 'react'

import {
  Box,
  Button,
  Card,
  CloseButton,
  Container,
  Portal,
  Stack,
  Tooltip,
} from '@chakra-ui/react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'

import { Form, useAppForm } from '#registry/default/forms/index.ts'

import { Beacon, Tour } from './index.ts'
import { createTour } from './use-tour.tsx'

const { steps, useTour } = createTour([
  {
    id: 'step-0',
    type: 'dialog',
    title: 'Welcome to the app',
    description: 'Start the tour to see how it works.',
    actions: [
      {
        label: 'Start tour',
        action: 'next',
      },
    ],
  },
  {
    id: 'step-1',
    type: 'tooltip',
    title: 'Create a new feature',
    description: 'Press the button to create a new feature.',
    target: () => document.getElementById('tour-1'),
    actions: [
      {
        label: 'Dismiss',
        action: 'dismiss',
      },
      {
        label: 'Next',
        action: 'next',
      },
    ],
  },
  {
    id: 'step-2',
    type: 'tooltip',
    title: 'Enter a title',
    description: 'Enter a title to save the feature.',
    target: () => document.getElementById('tour-2'),
    actions: [
      {
        label: 'Dismiss',
        action: 'dismiss',
      },
      {
        label: 'Next',
        action: 'next',
      },
    ],
  },
  {
    id: 'step-3',
    type: 'tooltip',
    title: 'Another feature',
    description: 'Another feature to see how it works.',
    target: () => document.getElementById('tour-3'),
    actions: [
      {
        label: 'Done',
        action: 'dismiss',
      },
    ],
  },
])

const TourTemplate = (args: Tour.RootProps & { defaultActive?: boolean }) => {
  const { defaultActive } = args

  const tour = useTour({
    steps,
  })

  useEffect(() => {
    if (defaultActive) {
      tour.start()
    }
  }, [])

  const form = useAppForm({
    validators: {
      onSubmit: z.object({
        title: z.string().min(1),
      }),
    },
    defaultValues: {
      title: 'Title',
    },
    onSubmit: () => {
      tour.next()
    },
  })

  return (
    <>
      <Stack gap="40" alignItems="center">
        <Button id="tour-1" onClick={() => tour.next()}>
          Create
        </Button>

        <Box id="tour-2">
          <Form form={form}>
            <form.AppField name="title">
              {(field) => <field.TextField label="Title" />}
            </form.AppField>
          </Form>
        </Box>
        <Card.Root id="tour-3">
          <Card.Body>Another feature</Card.Body>
        </Card.Root>
      </Stack>

      <Tour.Root tour={tour}>
        <Portal>
          <Tour.Backdrop />
          <Tour.Spotlight />
          <Tour.Positioner>
            <Tour.Content>
              <Tour.Arrow>
                <Tour.ArrowTip />
              </Tour.Arrow>
              <Stack gap="6">
                <Stack gap="1">
                  <Tour.ProgressText />
                  <Tour.Title />
                  <Tour.Description />
                  <Tour.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Tour.CloseTrigger>
                </Stack>
                <Tour.Control>
                  <Tour.Actions>
                    {(actions) =>
                      actions.map((action) => (
                        <Tour.ActionTrigger
                          key={action.label}
                          action={action}
                          asChild
                        >
                          <Button
                            size="sm"
                            variant={
                              action.action === 'next' ? 'glass' : 'surface'
                            }
                            colorPalette={
                              action.action === 'next' ? 'accent' : 'gray'
                            }
                          >
                            {action.label}
                          </Button>
                        </Tour.ActionTrigger>
                      ))
                    }
                  </Tour.Actions>
                </Tour.Control>
              </Stack>
            </Tour.Content>
          </Tour.Positioner>
        </Portal>
      </Tour.Root>
    </>
  )
}

const meta: Meta = {
  title: 'Components/Onboarding/Tour',
  component: TourTemplate,
  parameters: {
    controls: { expanded: true },
  },
  args: {},
  decorators: [
    (Story) => {
      return (
        <Container>
          <Story />
        </Container>
      )
    },
  ],
}

export default meta

type Story = StoryObj<Tour.RootProps & { defaultActive?: boolean }>

export const Basic: Story = {
  args: {
    defaultActive: true,
  },
}

export const WithBeacon = () => {
  const tour = useTour({
    steps,
  })

  const form = useAppForm({
    validators: {
      onSubmit: z.object({
        title: z.string().min(1),
      }),
    },
    defaultValues: {
      title: 'Title',
    },
    onSubmit: () => {
      tour.next()
    },
  })

  return (
    <>
      <Stack gap="40" alignItems="center">
        <Button id="tour-1">
          Create
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Beacon
                onClick={() => tour.start()}
                position="absolute"
                top="-2px"
                right="-2px"
                colorPalette="accent"
              />
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Positioner>
                <Tooltip.Content>Start tour</Tooltip.Content>
              </Tooltip.Positioner>
            </Portal>
          </Tooltip.Root>
        </Button>

        <Box id="tour-2">
          <Form form={form}>
            <form.AppField name="title">
              {(field) => <field.TextField label="Title" />}
            </form.AppField>
          </Form>
        </Box>

        <Card.Root id="tour-3">
          <Card.Body>Another feature</Card.Body>
        </Card.Root>
      </Stack>

      <Tour.Root tour={tour}>
        <Portal>
          <Tour.Backdrop />
          <Tour.Spotlight />
          <Tour.Positioner>
            <Tour.Content>
              <Tour.Arrow>
                <Tour.ArrowTip />
              </Tour.Arrow>
              <Stack gap="6">
                <Stack gap="1">
                  <Tour.ProgressText />
                  <Tour.Title />
                  <Tour.Description />
                  <Tour.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Tour.CloseTrigger>
                </Stack>
                <Tour.Control>
                  <Tour.Actions>
                    {(actions) =>
                      actions.map((action) => (
                        <Tour.ActionTrigger
                          key={action.label}
                          action={action}
                          asChild
                        >
                          <Button
                            size="sm"
                            variant={
                              action.action === 'next' ? 'glass' : 'surface'
                            }
                            colorPalette={
                              action.action === 'next' ? 'accent' : 'gray'
                            }
                          >
                            {action.label}
                          </Button>
                        </Tour.ActionTrigger>
                      ))
                    }
                  </Tour.Actions>
                </Tour.Control>
              </Stack>
            </Tour.Content>
          </Tour.Positioner>
        </Portal>
      </Tour.Root>
    </>
  )
}

// export const WithModal = () => {
//   return (
//     <>
//       <Stack gap="40" alignItems="center">
//         <Button id="tour-1">Create</Button>
//         <Form onSubmit={() => null}>
//           <Field name="title" label="Title" id="tour-2" />
//         </Form>
//         <Card.Root id="tour-3">
//           <Card.Body>Another feature</Card.Body>
//         </Card.Root>
//       </Stack>

//       <Tour defaultIsActive>
//         <BenefitsModal data-target="modal" backdrop={false}>
//           <BenefitsModalMedia
//             src="onboarding/undraw_building_blocks_re_5ahy.svg"
//             mx="16"
//             my="8"
//           />
//           <BenefitsModalHeader textAlign="center">
//             Check out this new feature
//           </BenefitsModalHeader>
//           <BenefitsModalBody textAlign="center">
//             Benefits modals can be used to highlight new features and their
//             benefits in your app. Embed illustrations or videos to make ideas
//             more accessible.
//           </BenefitsModalBody>
//           <BenefitsModalFooter>
//             <BenefitsModalActions>
//               <TourDismissButton />
//               <TourNextButton />
//             </BenefitsModalActions>
//           </BenefitsModalFooter>
//         </BenefitsModal>

//         <TourDialog data-target="#tour-1">
//           <TourDialogCloseButton />
//           <TourDialogHeader>Check out this new feature</TourDialogHeader>
//           <TourDialogBody>Start the tour to see how it works.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 1 of 3</Text>
//             <TourDialogActions>
//               <TourDismissButton />
//               <TourNextButton>Start</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-2">
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 2</TourDialogHeader>
//           <TourDialogBody>Tour step 2.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 2 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton />
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-3">
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 3</TourDialogHeader>
//           <TourDialogBody>Tour step 3.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 3 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton>Finish</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourSpotlight />
//       </Tour>
//     </>
//   )
// }

// export const WithNoCloseOnBlur = () => {
//   return (
//     <>
//       <Stack gap="40" alignItems="center">
//         <Button id="tour-1">Create</Button>
//         <Form onSubmit={() => null}>
//           <Field name="title" label="Title" id="tour-2" />
//         </Form>
//         <Card.Root id="tour-3">
//           <Card.Body>Another feature</Card.Body>
//         </Card.Root>
//       </Stack>

//       <Tour defaultIsActive>
//         <TourDialog data-target="#tour-1" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Check out this new feature</TourDialogHeader>
//           <TourDialogBody>Start the tour to see how it works.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 1 of 3</Text>
//             <TourDialogActions>
//               <TourDismissButton />
//               <TourNextButton>Start</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-2" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 2</TourDialogHeader>
//           <TourDialogBody>Tour step 2.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 2 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton />
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-3" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 3</TourDialogHeader>
//           <TourDialogBody>Tour step 3.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 3 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton>Finish</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourSpotlight closeOnClick={false} />
//       </Tour>
//     </>
//   )
// }

// export const AccessContext = () => {
//   const tourRef = React.useRef<TourContextValue>(null)

//   return (
//     <>
//       <Stack gap="40" alignItems="center">
//         <Button onClick={() => tourRef.current?.start()}>Start tour</Button>

//         <Button id="tour-1">Create</Button>
//         <Form onSubmit={() => null}>
//           <Field name="title" label="Title" id="tour-2" />
//         </Form>
//         <Card.Root id="tour-3">
//           <Card.Body>Another feature</Card.Body>
//         </Card.Root>
//       </Stack>

//       <Tour tourRef={tourRef}>
//         <TourDialog data-target="#tour-1" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Check out this new feature</TourDialogHeader>
//           <TourDialogBody>Start the tour to see how it works.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 1 of 3</Text>
//             <TourDialogActions>
//               <TourDismissButton />
//               <TourNextButton>Start</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-2" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 2</TourDialogHeader>
//           <TourDialogBody>Tour step 2.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 2 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton />
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourDialog data-target="#tour-3" closeOnInteractOutside={false}>
//           <TourDialogCloseButton />
//           <TourDialogHeader>Step 3</TourDialogHeader>
//           <TourDialogBody>Tour step 3.</TourDialogBody>
//           <TourDialogFooter>
//             <Text>Step 3 of 3</Text>
//             <TourDialogActions>
//               <TourNextButton>Finish</TourNextButton>
//             </TourDialogActions>
//           </TourDialogFooter>
//         </TourDialog>

//         <TourSpotlight closeOnClick={false} />
//       </Tour>
//     </>
//   )
// }
