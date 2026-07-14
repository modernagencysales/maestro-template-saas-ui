import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BusinessPageRoot } from "../../saas-ui/business-shell";
import { MaestroSaasUiProvider } from "../../saas-ui/provider";
import { ClientsScreen, type ClientsScreenState } from "./clients-screen";

const render = (state: ClientsScreenState) =>
  renderToStaticMarkup(
    <MaestroSaasUiProvider>
      <BusinessPageRoot>
        <ClientsScreen state={state} />
      </BusinessPageRoot>
    </MaestroSaasUiProvider>,
  );

describe("ClientsScreen", () => {
  it.each([
    ["loading" as const, "Loading client Brains"],
    ["empty" as const, "No client Brains yet"],
    ["typed_failure" as const, "Client list unavailable"],
    ["transport_failure" as const, "Connection interrupted"],
  ])("renders the %s state", (status, text) => {
    expect(render({ status })).toContain(text);
  });

  it("renders ready client rows without requiring a live provider", () => {
    const html = render({
      status: "ready",
      clients: [
        {
          key: "client_acme",
          name: "Acme Co",
          health: "Ready",
          freshness: "Updated today",
          connections: 2,
        },
      ],
    });

    expect(html).toContain("Clients");
    expect(html).toContain("Acme Co");
    expect(html).toContain("Updated today");
  });
});
