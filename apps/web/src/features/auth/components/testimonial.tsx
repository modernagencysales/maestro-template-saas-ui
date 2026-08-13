import { Box, Container, HStack, Link, Text } from '@chakra-ui/react'
import { Avatar } from '@saas-ui/react'

export const Testimonial = () => {
  return (
    <Container maxW="lg">
      <HStack mb="4" gap="4">
        <Avatar name="Ahmed" size="lg" colorPalette="cyan" />
        <Box>
          <Text color="white" fontSize="md" fontWeight="medium">
            Ahmed
          </Text>
          <Text color="whiteAlpha.700" fontSize="md">
            Founder of{' '}
            <Link href="https://localxpose.io" color="white">
              LocalXpose
            </Link>
          </Text>
        </Box>
      </HStack>
      <Text color="white" textStyle="lg">
        I really recommend Saas UI to any developer or team seeking a robust,
        visually appealing, and easy-to-implement UI framework. The support and
        updates from the Saas UI team were exceptional, Thank you.
      </Text>
    </Container>
  )
}
