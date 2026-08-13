import { useCurrentWorkspace } from '#features/common/hooks/use-current-workspace'

export const useTags = () => {
  const [workspace] = useCurrentWorkspace()

  return workspace.tags
}
