import { createFileRoute } from "@tanstack/react-router";

import { ConnectionsScreen } from "../features/connections/connections-screen";
import { BusinessAppShell, BusinessPageRoot } from "../saas-ui/business-shell";

export const Route = createFileRoute("/_workspace/connections")({
  component: ConnectionsRoute,
});

const initialConnectionsState = {
  status: "ready",
  connections: [
    {
      key: "slack",
      provider: "Slack",
      status: "Ready",
      scope: "Agency workspace",
      lastSync: "Local fixture",
    },
  ],
} as const;

function ConnectionsRoute() {
  return (
    <BusinessAppShell activePath="/connections">
      <BusinessPageRoot>
        <ConnectionsScreen state={initialConnectionsState} />
      </BusinessPageRoot>
    </BusinessAppShell>
  );
}
