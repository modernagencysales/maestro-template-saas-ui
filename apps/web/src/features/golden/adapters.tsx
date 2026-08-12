import { createContext, type ReactNode } from "react";
import { useContext } from "react";
import { ClientOnly } from "@saas-ui/react";

import {
  goldenFixtures,
  goldenStates,
  type ContactFixture,
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
  contacts: readonly ContactFixture[];
  subscribe(listener: () => void): () => void;
  updateContactStatus(
    id: string,
    status: ContactFixture["status"],
  ): Promise<void>;
  search(query: string): readonly SearchResultFixture[];
  navigate(to: string): void;
  signOut(): Promise<void>;
  transitionState(
    state: GoldenState,
    action: GoldenStateAction,
  ): Promise<GoldenState | "access-requested">;
}>;

export type GoldenStateAction =
  "edit" | "save" | "continue" | "retry" | "back" | "request-access";

const stateTransitions: Partial<
  Record<
    GoldenState,
    Partial<Record<GoldenStateAction, GoldenState | "access-requested">>
  >
> = {
  "ready-read": { edit: "ready-edit" },
  "ready-edit": { save: "mutation-success" },
  "mutation-success": { continue: "ready-read" },
  "mutation-failure": { retry: "mutation-success" },
  error: { retry: "loading" },
  "not-found": { back: "ready-read" },
  "permission-denied": { "request-access": "access-requested" },
};

const GoldenAdapterContext = createContext<GoldenFrontendAdapter | null>(null);
const GoldenStateContext = createContext<GoldenState>("ready-read");
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
    typeof value === "string" && goldenStates.includes(value as GoldenState)
  );
}

export function createGoldenAdapter(
  navigate: (to: string) => void = () => undefined,
): GoldenFrontendAdapter {
  let contacts: readonly ContactFixture[] = goldenFixtures.contacts;
  const listeners = new Set<() => void>();

  return {
    currentUser: goldenFixtures.currentUser,
    currentWorkspace: goldenFixtures.currentWorkspace,
    workspaces: goldenFixtures.workspaces,
    navigation: goldenFixtures.navigation,
    get contacts() {
      return contacts;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async updateContactStatus(id, status) {
      if (!contacts.some((contact) => contact.id === id)) {
        throw new Error(`Contact not found: ${id}`);
      }
      contacts = contacts.map((contact) =>
        contact.id === id ? { ...contact, status } : contact,
      );
      for (const listener of listeners) listener();
    },
    search(query) {
      const normalized = query.trim().toLowerCase();
      return goldenFixtures.navigation
        .filter((item) => item.label.toLowerCase().includes(normalized))
        .map((item) => ({ ...item, description: `Open ${item.label}` }));
    },
    navigate,
    signOut: async () => undefined,
    transitionState: async (state, action) =>
      stateTransitions[state]?.[action] ?? state,
  };
}

export function GoldenAdapterProvider({
  children,
  initialState,
  adapter = createGoldenAdapter(),
}: {
  children: ReactNode;
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
  children: ReactNode;
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
  const adapter = useContext(GoldenAdapterContext);
  if (!adapter) {
    throw new Error("GoldenFrontendAdapter is required for this surface");
  }
  return adapter;
}

export function useGoldenState(): GoldenState {
  return useContext(GoldenStateContext);
}
