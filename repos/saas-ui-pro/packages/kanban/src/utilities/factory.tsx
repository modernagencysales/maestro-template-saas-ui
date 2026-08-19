import { forwardRef } from 'react'

import { SystemStyleObject, chakra } from '@chakra-ui/react'

export function factory<
  Props extends object,
  Component extends React.ElementType,
>(component: Component, styles: SystemStyleObject = {}) {
  const StyledComponent = chakra(component, {
    base: styles,
  })
  const Component = forwardRef<Component, Props>((props, ref) => {
    return <StyledComponent ref={ref} {...(props as any)} />
  })
  Component.displayName = StyledComponent.displayName
  return Component
}
