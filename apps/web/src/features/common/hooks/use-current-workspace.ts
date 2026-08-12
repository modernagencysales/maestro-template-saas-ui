"use client";

import { useGoldenAdapter } from "../../golden/adapters";

import { useWorkspaceSlug } from "./use-workspace-slug";

export const useCurrentWorkspace = () => {
  useWorkspaceSlug();
  const { currentWorkspace } = useGoldenAdapter();
  return [currentWorkspace] as const;
};
