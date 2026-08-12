import { useCurrentUser } from "./use-current-user";
import { useGoldenAdapter } from "../../golden/adapters";

/**
 * Get all workspaces of the current user
 */
export const useWorkspaces = () => {
  useCurrentUser();
  const { workspaces } = useGoldenAdapter();
  return workspaces.map((workspace) => ({
    ...workspace,
    href: `/${workspace.slug}`,
  }));
};
