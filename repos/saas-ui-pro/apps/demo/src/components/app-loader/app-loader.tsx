import { keyframes } from '@emotion/react'

import * as LoadingOverlay from '#ui/loading-overlay/loading-overlay'

import { SaasUIGlyph } from '../logo/saas-ui-glyph'

const scale = keyframes`
  0% {
    scale: 1.3;
  }
  100% {
    scale: 1;
  }
`

/**
 * Show a fullscreen loading animation while the app is loading.
 */
export const AppLoader: React.FC<LoadingOverlay.RootProps> = (props) => {
  return (
    <LoadingOverlay.Root {...props} variant="fullscreen">
      <SaasUIGlyph
        boxSize="8"
        animation={`5s ease-out ${scale}`}
        opacity="0.8"
      />
    </LoadingOverlay.Root>
  )
}
