import * as React from 'react'

import { useTourContext } from '@ark-ui/react'
import {
  HTMLChakraProps,
  Portal,
  PortalProps,
  Presence,
  type RecipeProps,
  VisuallyHidden,
  chakra,
  useRecipe,
} from '@chakra-ui/react'

import { Beacon } from './beacon'
import { UseTourBeaconProps, useTourBeacon } from './use-tour-beacon'
import { splitProps } from './utils'

const scaleAnimation = {
  '@keyframes scale-in': {
    from: {
      scale: '0.1',
      opacity: '0',
    },
    to: {
      scale: '1',
      opacity: '1',
    },
  },
  '@keyframes scale-out': {
    from: {
      scale: '1',
      opacity: '1',
    },
    to: {
      scale: '0.1',
      opacity: '0',
    },
  },
  '&[data-state=open]': {
    animation: 'scale-in 0.2s cubic-bezier(0.175, 0.885, 0.4, 1.1) forwards',
  },
  '&[data-state=closed]': {
    animation: 'scale-out 0.2s ease-in-out forwards',
  },
}

export interface TourBeaconProps
  extends Omit<HTMLChakraProps<'div'>, 'direction' | 'offset' | 'transform'>,
    RecipeProps<'tourBeacon'>,
    UseTourBeaconProps {
  /**
   * The accessible, human friendly label to use for
   * screen readers.
   */
  'aria-label'?: string
  /**
   * Props to be forwarded to the portal component
   */
  portalProps?: PortalProps
}

/**
 * TourBeacons highlights new features and allows users to start or continue a paused tour.
 *
 * @see Docs     https://saas-ui.com/docs
 */
export const TourBeacon = React.forwardRef<HTMLDivElement, TourBeaconProps>(
  function TourBeacon(props, ref) {
    const recipe = useRecipe({
      key: 'tourBeacon',
    })

    const [variantProps, ownProps] = recipe.splitVariantProps(props)

    const styles = recipe(variantProps)

    const { 'aria-label': ariaLabel, portalProps, ...rest } = ownProps

    const beacon = useTourBeacon({ ...rest })

    const hasAriaLabel = !!ariaLabel

    const _beaconProps = beacon.getTourBeaconProps({}, ref)

    const [, beaconProps] = hasAriaLabel
      ? splitProps(_beaconProps, ['role', 'id'])
      : [{}, _beaconProps]

    const [hiddenProps] = splitProps(_beaconProps, ['role', 'id'])

    return (
      <Presence present={beacon.open}>
        <Portal {...portalProps}>
          <chakra.div
            {...beacon.getTourBeaconPositionerProps()}
            css={{
              zIndex: 'tooltip',
            }}
          >
            <Beacon {...(beaconProps as any)} css={[scaleAnimation, styles]}>
              {hasAriaLabel && (
                <VisuallyHidden {...hiddenProps}>{ariaLabel}</VisuallyHidden>
              )}
            </Beacon>
          </chakra.div>
        </Portal>
      </Presence>
    )
  },
)

TourBeacon.displayName = 'TourBeacon'
