import { Flex, type FlexProps } from '@chakra-ui/react'

import { SaasUILogo } from './saas-ui'

export const Logo = (props: FlexProps & { logo?: React.ReactNode }) => {
  const { logo } = props
  return (
    <Flex width="160px" {...props}>
      {logo || <SaasUILogo />}
    </Flex>
  )
}
