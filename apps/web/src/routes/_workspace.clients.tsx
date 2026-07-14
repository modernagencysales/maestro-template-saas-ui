import { createFileRoute } from "@tanstack/react-router";

import { ClientsScreen } from "../features/clients/clients-screen";
import { BusinessAppShell, BusinessPageRoot } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/clients")({
  component: ClientsRoute,
});

const initialClientsState = {
  status: "ready",
  clients: [
    {
      key: "client-northstar",
      name: "Northstar Labs",
      health: "Ready",
      freshness: "Updated today",
      connections: 2,
    },
    {
      key: "client-fieldwire",
      name: "Fieldwire Systems",
      health: "Ready",
      freshness: "Updated yesterday",
      connections: 1,
    },
  ],
} as const;

function ClientsRoute() {
  return (
    <BusinessAppShell activePath="/clients">
      <BusinessPageRoot>
        <ClientsScreen state={initialClientsState} />
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}
