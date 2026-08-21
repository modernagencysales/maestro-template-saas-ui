import { Button, SimpleGrid } from '@chakra-ui/react'
import { Section } from '@saas-ui/react'
import { LuBox, LuCircleHelp, LuGithub, LuShield } from 'react-icons/lu'

import { SettingsPage } from '@workspace/ui/settings-page'

import { SettingsCard } from './settings-card'
import { SupportCard } from './support-card'

export function SettingsOverviewPage() {
  return (
    <SettingsPage
      title="Overview"
      description="Manage your organization settings"
      contentWidth="6xl"
    >
      <Section.Root>
        <Section.Header title="Your account" />
        <Section.Body>
          <SimpleGrid columns={[1, null, 2]} gap={4}>
            <SettingsCard
              title="Security recommendations"
              description="Improve your account security by enabling two-factor authentication."
              icon={<LuShield />}
              footer={
                <Button variant="surface">
                  Enable two-factor authentication
                </Button>
              }
            />
          </SimpleGrid>
        </Section.Body>
      </Section.Root>

      <Section.Root>
        <Section.Header title="More" />
        <Section.Body>
          <SimpleGrid columns={[1, null, 3]} gap={4}>
            <SupportCard
              title="Start guide"
              description="Read how to get started with Saas UI Pro."
              icon={<LuCircleHelp />}
              href="https://saas-ui.dev/docs/pro/overview"
            />
            <SupportCard
              title="Components"
              description="See all components and how they work."
              icon={<LuBox />}
              href="https://www.saas-ui.dev/docs/components"
            />
            <SupportCard
              title="Roadmap"
              description="Post feedback, bugs and feature requests."
              icon={<LuGithub />}
              href="https://roadmap.saas-ui.dev"
            />
          </SimpleGrid>
        </Section.Body>
      </Section.Root>
    </SettingsPage>
  )
}
