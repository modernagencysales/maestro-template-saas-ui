// import * as React from 'react'

// import {
//   BenefitsModal,
//   BenefitsModalBody,
//   BenefitsModalFooter,
//   BenefitsModalHeader,
//   Tour,
//   TourDialog,
//   TourDialogActions,
//   TourDialogBody,
//   TourDialogFooter,
//   TourDialogHeader,
//   TourDismissButton,
//   TourNextButton,
//   TourSpotlight,
// } from '@saas-ui-pro/onboarding'

// import { LogoIcon } from '#components/logo'

/**
 * @todo move this to a TourManager context provider
 */
export const IntroTour = () => {
  return ull
  // const [tour, setTour] = useLocalStorage('saas-ui.intro-tour', false)

  // const steps = [
  //   {
  //     target: useBreakpointValue({
  //       base: '.sui-sidebar__toggle-button',
  //       lg: '.workspaces-menu',
  //     }),
  //     title: 'Switch workspaces',
  //     content: 'Saas UI Pro supports multiple workspaces.',
  //     disableBeacon: true,
  //     primaryAction: 'Next',
  //   },
  //   {
  //     target: '.pre-order',
  //     title: 'Share the love ❤️',
  //     content: 'Pre-order Saas UI Pro now.',
  //     primaryAction: 'Complete',
  //   },
  // ]

  // const onDismiss = () => {
  //   setTour(true)
  // }

  // const onTourComplete = () => {
  //   setTour(true)
  // }

  // return (
  //   <ErrorBoundary>
  //     <Tour
  //       defaultIsActive={!tour}
  //       onDismiss={onDismiss}
  //       onComplete={onTourComplete}
  //     >
  //       <BenefitsModal data-target="modal" hideOverlay>
  //         <BenefitsModalHeader>
  //           <LogoIcon boxSize="8" mb="4" /> <Text>Welcome to Saas UI</Text>
  //         </BenefitsModalHeader>
  //         <BenefitsModalBody fontSize="md" color="muted">
  //           Benefits modals can be used to highlight new features and their
  //           benefits in your app. Embed illustrations or videos to make ideas
  //           more accessible.
  //         </BenefitsModalBody>
  //         <BenefitsModalFooter>
  //           <ButtonGroup>
  //             <TourDismissButton />
  //             <TourNextButton>Start</TourNextButton>
  //           </ButtonGroup>
  //         </BenefitsModalFooter>
  //       </BenefitsModal>
  //       {steps.map((step, i) => (
  //         <TourDialog key={i} data-target={step.target}>
  //           <TourDialogHeader>{step.title}</TourDialogHeader>
  //           <TourDialogBody>{step.content}</TourDialogBody>
  //           <TourDialogFooter>
  //             <Text>
  //               Step {i + 2} of {steps.length + 1}
  //             </Text>
  //             <TourDialogActions>
  //               <TourDismissButton />
  //               <TourNextButton variant="subtle" colorScheme="white">
  //                 {step.primaryAction}
  //               </TourNextButton>
  //             </TourDialogActions>
  //           </TourDialogFooter>
  //         </TourDialog>
  //       ))}
  //       <TourSpotlight />
  //     </Tour>
  //   </ErrorBoundary>
  // )
}
