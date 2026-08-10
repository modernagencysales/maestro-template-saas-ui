import { createFileRoute } from "@tanstack/react-router";
import { Page, SimpleGrid } from "@saas-ui/react";
import { Plug } from "lucide-react";
import { IntegrationCard, PageStateView } from "../saas-ui/patterns";

export const Route = createFileRoute("/_workspace/integrations")({
  component: WorkspaceIntegrationsRoute,
});

type IntegrationItem = Omit<Parameters<typeof IntegrationCard>[0], "icon">;

export function WorkspaceIntegrationsRoute({
  integrations = [],
}: {
  readonly integrations?: readonly IntegrationItem[];
}) {
  return (
    <Page.Root as="main" id="workspace-main" tabIndex={-1}>
      <Page.Header
        description="Connect owned customer systems without adding speculative providers."
        title="Integrations"
      />
      <Page.Body>
        {integrations.length === 0 ? (
          <PageStateView
            description="Add an approved provider adapter before connecting an integration."
            state="empty"
            title="No integrations configured yet"
          />
        ) : (
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
            {integrations.map((integration) => (
              <IntegrationCard
                {...integration}
                icon={Plug}
                key={integration.name}
              />
            ))}
          </SimpleGrid>
        )}
      </Page.Body>
    </Page.Root>
  );
}
