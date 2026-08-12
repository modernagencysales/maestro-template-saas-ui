import { useCurrentWorkspace } from "./use-current-workspace";

export const useTags = () => {
  const [workspace] = useCurrentWorkspace();

  return workspace?.tags ?? [];
};
