import {
  Container,
  type ContainerProps,
  StackSeparator,
  VStack,
} from '@chakra-ui/react'

import * as Page from '#ui/page/page'

interface SettingsPageProps
  extends Omit<Page.RootProps, 'title'>,
    Pick<Page.HeaderProps, 'title' | 'description' | 'actions'> {
  /**
   * The maximum width of the main content.
   */
  contentWidth?: ContainerProps['maxW']
}

/**
 * SettingsPage
 *
 * Use this component as a base for your settings pages.
 */
export const SettingsPage = (props: SettingsPageProps) => {
  const {
    children,
    title,
    description,
    actions,
    contentWidth = '2xl',
    ...rest
  } = props

  return (
    <Page.Root variant="settings" mt={[14, null, 0]} bg="bg.muted/50" {...rest}>
      <Container maxW={contentWidth}>
        <Page.Header
          title={title}
          description={description}
          actions={actions}
        />
        <Page.Body>
          <VStack
            align="stretch"
            gap={8}
            separator={<StackSeparator />}
            pb="16"
          >
            {children}
          </VStack>
        </Page.Body>
      </Container>
    </Page.Root>
  )
}
