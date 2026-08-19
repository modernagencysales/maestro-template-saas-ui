import { SidebarLayout } from '#features/common/layouts/sidebar-layout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>
}
