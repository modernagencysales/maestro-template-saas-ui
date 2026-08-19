import * as React from 'react'

import { Box, Portal, SystemStyleObject, useRecipe } from '@chakra-ui/react'

import { TourSpotlightProps, useTourSpotlight } from './use-tour-spotlight'
import { cx } from './utils'

export const TourSpotlight: React.FC<TourSpotlightProps> = React.forwardRef(
  (props, ref) => {
    const recipe = useRecipe({
      key: 'suiTourSpotlight',
    })

    const [variantProps, rest] = recipe.splitVariantProps(props)

    const styles = recipe(variantProps)

    const { getSpotlightProps } = useTourSpotlight()

    const spotlightStyles: SystemStyleObject = {
      position: 'absolute',
      zIndex: 'overlay',
      transitionProperty: 'all',
      transitionDuration: 'slow',
      borderRadius: 'md',
      borderWidth: '2px',
      borderColor: 'primary.500',
      ...styles,
    }

    return (
      <Portal>
        <Box
          {...rest}
          {...getSpotlightProps(props)}
          ref={ref}
          css={spotlightStyles}
          className={cx('sui-spotlight', props.className)}
        />
      </Portal>
    )
  },
)

TourSpotlight.displayName = 'TourSpotlight'
