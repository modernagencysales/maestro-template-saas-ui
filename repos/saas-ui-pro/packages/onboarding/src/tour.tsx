import { Tour as TourPrimitive } from '@ark-ui/react'
import { createSlotRecipeContext } from '@chakra-ui/react'

import { TourBeacon } from './tour-beacon.tsx'
import { tourSlotRecipe } from './tour.recipe.ts'

const { withRootProvider, withContext } = createSlotRecipeContext({
  key: 'suiTour',
  recipe: tourSlotRecipe,
})

interface TourRootProps extends TourPrimitive.RootProps {}

const TourRoot = withRootProvider<TourRootProps>(TourPrimitive.Root)

const TourBackdrop = withContext<HTMLDivElement, TourPrimitive.BackdropProps>(
  TourPrimitive.Backdrop,
  'backdrop',
)

const TourSpotlight = withContext<HTMLDivElement, TourPrimitive.SpotlightProps>(
  TourPrimitive.Spotlight,
  'spotlight',
)

export const TourPositioner = withContext<
  HTMLDivElement,
  TourPrimitive.PositionerProps
>(TourPrimitive.Positioner, 'positioner')

const TourContent = withContext<HTMLDivElement, TourPrimitive.ContentProps>(
  TourPrimitive.Content,
  'content',
)

const TourArrow = withContext<HTMLDivElement, TourPrimitive.ArrowProps>(
  TourPrimitive.Arrow,
  'arrow',
)

const TourArrowTip = withContext<HTMLDivElement, TourPrimitive.ArrowTipProps>(
  TourPrimitive.ArrowTip,
  'arrowTip',
)

const TourCloseTrigger = withContext<
  HTMLDivElement,
  TourPrimitive.CloseTriggerProps
>(TourPrimitive.CloseTrigger, 'closeTrigger')

const TourProgressText = withContext<
  HTMLDivElement,
  TourPrimitive.ProgressTextProps
>(TourPrimitive.ProgressText, 'progressText')

const TourTitle = withContext<HTMLDivElement, TourPrimitive.TitleProps>(
  TourPrimitive.Title,
  'title',
)

const TourControl = withContext<HTMLDivElement, TourPrimitive.ControlProps>(
  TourPrimitive.Control,
  'control',
)

const TourDescription = withContext<
  HTMLDivElement,
  TourPrimitive.DescriptionProps
>(TourPrimitive.Description, 'description')

const TourActions = TourPrimitive.Actions

const TourActionTrigger = TourPrimitive.ActionTrigger

const TourContext = TourPrimitive.Context
export {
  TourRoot as Root,
  TourBackdrop as Backdrop,
  TourSpotlight as Spotlight,
  TourPositioner as Positioner,
  TourContent as Content,
  TourArrow as Arrow,
  TourArrowTip as ArrowTip,
  TourCloseTrigger as CloseTrigger,
  TourProgressText as ProgressText,
  TourTitle as Title,
  TourControl as Control,
  TourActions as Actions,
  TourDescription as Description,
  TourActionTrigger as ActionTrigger,
  TourContext as Context,
  TourBeacon as Beacon,
}

export type { TourRootProps as RootProps }
