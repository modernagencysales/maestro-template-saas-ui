import * as React from 'react'

import {
  HTMLChakraProps,
  type RecipeProps,
  chakra,
  useRecipe,
} from '@chakra-ui/react'

import { type BeaconVariantProps, beaconRecipe } from './beacon.recipe.ts'
import { cx } from './utils'

export interface BeaconProps
  extends HTMLChakraProps<'div'>,
    RecipeProps<'suiBeacon'>,
    BeaconVariantProps {}

export const Beacon = React.forwardRef<HTMLDivElement, BeaconProps>(
  function Beacon(props, ref) {
    const recipe = useRecipe({
      key: 'suiBeacon',
      recipe: beaconRecipe,
    })

    const [variantProps, rest] = recipe.splitVariantProps(props)

    const styles = recipe(variantProps)

    return (
      <chakra.div
        ref={ref}
        {...rest}
        css={[styles, rest.css]}
        className={cx(recipe.className, props.className)}
      />
    )
  },
)

Beacon.displayName = 'Beacon'
