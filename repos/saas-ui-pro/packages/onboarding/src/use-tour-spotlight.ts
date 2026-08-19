import * as React from 'react'

import { HTMLChakraProps } from '@chakra-ui/react'

import { useTourContext } from './use-tour'
import { callAll } from './utils'

export interface TourSpotlightOptions {
  motionPreset?: 'fade' | 'none'
  closeOnClick?: boolean
  hideOverlay?: boolean
  spacing?: number
}

export interface TourSpotlightProps
  extends TourSpotlightOptions,
    HTMLChakraProps<'div'> {}

export function useTourSpotlight() {
  const [dimensions, setDimensions] = React.useState<DOMRect | null>(null)
  const { isActive, stop, targetElement } = useTourContext()

  const rafId = React.useRef<number>(null)

  React.useLayoutEffect(() => {
    if (!isActive) return undefined

    function measure() {
      rafId.current = requestAnimationFrame(() => {
        const rect = targetElement?.getBoundingClientRect() || null
        setDimensions(rect)
      })
    }

    measure()

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)

      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [targetElement, isActive])

  const getSpotlightProps = React.useCallback(
    (props: TourSpotlightProps = {}) => {
      const {
        spacing = 4,
        closeOnClick = false,
        hideOverlay,
        onClick,
        css,
      } = props
      if (isActive) {
        const scrollTop =
          document.scrollingElement?.scrollTop ||
          document.documentElement.scrollTop ||
          0
        const scrollLeft =
          document.scrollingElement?.scrollLeft ||
          document.documentElement.scrollLeft ||
          0

        return {
          // animate: 'enter',
          css: [
            {
              width: dimensions ? dimensions.width + spacing * 2 + 'px' : '0',
              height: dimensions ? dimensions.height + spacing * 2 + 'px' : '0',
              top: dimensions
                ? dimensions.top + scrollTop - spacing + 'px'
                : '-10px',
              left: dimensions
                ? dimensions.left + scrollLeft - spacing + 'px'
                : '50%',
              boxShadow: !hideOverlay
                ? '0 0 0 9999px rgba(0, 0, 0, 0.2)'
                : 'none',
              pointerEvents: closeOnClick ? 'auto' : 'none',
            },
            props.css,
          ],
          onClick: callAll(onClick, () => {
            // closeOnClick && stop()
          }),
        } satisfies TourSpotlightProps
      }

      return {
        animate: 'exit',
        css,
      }
    },
    [isActive, dimensions, stop],
  )

  return {
    isActive,
    getSpotlightProps,
  }
}
