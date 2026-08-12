// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@saas-ui/auth-provider";
import { describe, expect, it } from "vitest";

import { AppProvider } from "./app-provider";

function ProviderConsumer() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["provider-closure"],
    queryFn: async () => "ready",
  });

  return <span data-auth={auth ? "present" : "absent"}>{query.status}</span>;
}

describe("AppProvider", () => {
  it("closes the generated auth and React Query provider boundary", () => {
    expect(() =>
      render(
        <AppProvider queryClient={new QueryClient()}>
          <ProviderConsumer />
        </AppProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByText("pending")).toBeTruthy();
  });
});
