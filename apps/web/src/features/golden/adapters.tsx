import * as React from "react";
import { ClientOnly } from "@saas-ui/react";

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
const goldenFixtureStorageKey = "maestro-golden-fixture";

function readGoldenFixtureState(): GoldenState {
  if (typeof window === "undefined") return "ready-read";

  try {
    const fixture = JSON.parse(
      window.localStorage.getItem(goldenFixtureStorageKey) ?? "{}",
    ) as { state?: unknown };
    return isGoldenState(fixture.state) ? fixture.state : "ready-read";
  } catch {
    return "ready-read";
  }
}

function isGoldenState(value: unknown): value is GoldenState {
  return (
    typeof value === "string" &&
    [
      "loading",
      "empty",
      "ready-read",
      "ready-edit",
      "mutation-success",
      "mutation-failure",
      "error",
      "not-found",
      "permission-denied",
    ].includes(value)
  );
}

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
  initialState,
  adapter = createGoldenAdapter(),
}: {
  children: React.ReactNode;
  initialState?: GoldenState;
  adapter?: GoldenFrontendAdapter;
}) {
  const fallback = (
    <GoldenStateContext.Provider value={initialState ?? "ready-read"}>
      {children}
    </GoldenStateContext.Provider>
  );

  return (
    <GoldenAdapterContext.Provider value={adapter}>
      <ClientOnly fallback={fallback}>
        <GoldenFixtureStateProvider initialState={initialState}>
          {children}
        </GoldenFixtureStateProvider>
      </ClientOnly>
    </GoldenAdapterContext.Provider>
  );
}

function GoldenFixtureStateProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: GoldenState;
}) {
  const state = initialState ?? readGoldenFixtureState();
  return (
    <GoldenStateContext.Provider value={state}>
      {children}
    </GoldenStateContext.Provider>
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
