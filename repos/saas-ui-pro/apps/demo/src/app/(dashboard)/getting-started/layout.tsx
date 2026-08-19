import { FullscreenLayout } from '#features/common/layouts/fullscreen-layout'

export default function GettingStartedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <FullscreenLayout>{children}</FullscreenLayout>
}
