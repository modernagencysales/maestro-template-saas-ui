import { useCurrentUser } from './use-current-user'

/**
 * Get all workspaces of the current user
 */
export const useWorkspaces = () => {
  const [currentUser] = useCurrentUser()

  return (
    currentUser?.workspaces?.map((workspace) => ({
      id: workspace.id,
      slug: workspace.slug,
      label: workspace.name || workspace.id,
      logo: workspace.logo || undefined,
      href: `/${workspace.slug}`,
    })) || []
  )
}
