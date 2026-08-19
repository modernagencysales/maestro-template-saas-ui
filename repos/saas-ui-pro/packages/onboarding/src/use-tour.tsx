import {
  type TourStepDetails,
  type UseTourProps,
  useTourContext as useTourContextPrimitive,
  useTour as useTourPrimitive,
} from '@ark-ui/react'

export function useTour<TSteps extends TourStepDetails[]>(
  props: UseTourProps = {},
) {
  const context = useTourPrimitive(props)

  return {
    ...context,
    steps: props.steps,
  } as ReturnType<typeof useTourPrimitive> & { steps: TSteps }
}

export function useTourContext<TSteps extends TourStepDetails[]>() {
  return useTourContextPrimitive() as ReturnType<
    typeof useTourContextPrimitive
  > & { steps: TSteps }
}

export function createTour<TSteps extends TourStepDetails[]>(steps: TSteps) {
  return {
    steps,
    useTour: useTour<TSteps>,
    useTourContext: useTourContext<TSteps>,
  }
}
