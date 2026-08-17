import { Box, type BoxProps } from '@chakra-ui/react'
import { SaasUIIcon, SaasUILogo } from '@saas-ui/assets'

export const Logo = (props: BoxProps) => {
  return (
    <Box width="160px" {...props} asChild>
      <SaasUILogo color="oklch(0.511 0.262 276.966)" />
    </Box>
  )
}

export const LogoIcon = (props: BoxProps) => {
  return (
    <Box {...props}>
      <SaasUIIcon color="oklch(0.511 0.262 276.966)" />
    </Box>
  )
}
