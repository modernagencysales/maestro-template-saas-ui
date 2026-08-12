import * as React from "react";

import {
  goldenFixtures,
  type GoldenState,
  type NavigationFixture,
  type SearchResultFixture,
  type UserFixture,
  type WorkspaceFixture,
} from "./fixtures";

export type GoldenFrontendAdapter = Readonly<{
  currentUser: UserFixture;
  currentWorkspace: WorkspaceFixture;
  workspaces: readonly WorkspaceFixture[];
  navigation: readonly NavigationFixture[];
  search(query: string): readonly SearchResultFixture[];
  navigate(to: string): void;
  signOut(): Promise<void>;
}>;

const GoldenAdapterContext = React.createContext<GoldenFrontendAdapter | null>(
  null,
);
const GoldenStateContext = React.createContext<GoldenState>("ready-read");

export function createGoldenAdapter(
  navigate: (to: string) => void = () => undefined,
): GoldenFrontendAdapter {
  return {
    currentUser: goldenFixtures.currentUser,
    currentWorkspace: goldenFixtures.currentWorkspace,
    workspaces: goldenFixtures.workspaces,
    navigation: goldenFixtures.navigation,
    search(query) {
      const normalized = query.trim().toLowerCase();
      return goldenFixtures.navigation
        .filter((item) => item.label.toLowerCase().includes(normalized))
        .map((item) => ({ ...item, description: `Open ${item.label}` }));
    },
    navigate,
    signOut: async () => undefined,
  };
}

export function GoldenAdapterProvider({
  children,
  initialState = "ready-read",
  adapter = createGoldenAdapter(),
}: {
  children: React.ReactNode;
  initialState?: GoldenState;
  adapter?: GoldenFrontendAdapter;
}) {
  return (
    <GoldenAdapterContext.Provider value={adapter}>
      <GoldenStateContext.Provider value={initialState}>
        {children}
      </GoldenStateContext.Provider>
    </GoldenAdapterContext.Provider>
  );
}

export function useGoldenAdapter(): GoldenFrontendAdapter {
  const adapter = React.useContext(GoldenAdapterContext);
  if (!adapter) {
    throw new Error("GoldenFrontendAdapter is required for this surface");
  }
  return adapter;
}

export function useGoldenState(): GoldenState {
  return React.useContext(GoldenStateContext);
}
