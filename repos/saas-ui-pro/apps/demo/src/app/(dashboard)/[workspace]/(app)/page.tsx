import { redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace } = await props.params

  redirect(`/${workspace}/updates`)
}
