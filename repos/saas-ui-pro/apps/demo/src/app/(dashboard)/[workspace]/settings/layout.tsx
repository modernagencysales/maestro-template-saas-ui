import { SettingsLayout } from '#features/common/layouts/settings-layout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>
}
