import { UpdatesLayout } from '#features/updates/updates-layout.tsx'

export default async function Layout(props: {
  children: React.ReactNode
  params: Promise<{
    workspace: string
  }>
}) {
  const params = await props.params

  return <UpdatesLayout params={params}>{props.children}</UpdatesLayout>
}
