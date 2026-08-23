export type ShellConfigurationOptions = Readonly<{
  dashboardLabel: string;
  dashboardScreen: "reports" | "connections";
  inboxLabel: string;
  inboxScreen: "contacts" | "brain";
  contactsLabel: string;
  contactsScreen: "contacts" | "clients";
  kanbanLabel: string;
  kanbanRoute: "/$workspace/kanban" | "/$workspace/settings/account/profile";
  showcaseLabel: string;
  showcaseRoute: "/$workspace/showcase" | "/$workspace/search";
  searchScreen: "workspace" | "assistant";
}>;

const requiredLabel = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Shell configuration requires ${field}`);
  return normalized;
};

export const buildShellConfigurationFiles = (
  options: ShellConfigurationOptions,
) => {
  const labels = {
    dashboard: requiredLabel(options.dashboardLabel, "--dashboard-label"),
    inbox: requiredLabel(options.inboxLabel, "--inbox-label"),
    contacts: requiredLabel(options.contactsLabel, "--contacts-label"),
    kanban: requiredLabel(options.kanbanLabel, "--kanban-label"),
    showcase: requiredLabel(options.showcaseLabel, "--showcase-label"),
  };
  const configuration = `export const productShell = {
  navigation: {
    dashboard: { label: ${JSON.stringify(labels.dashboard)}, to: '/$workspace' },
    inbox: { label: ${JSON.stringify(labels.inbox)}, to: '/$workspace/inbox' },
    contacts: { label: ${JSON.stringify(labels.contacts)}, to: '/$workspace/contacts' },
    kanban: { label: ${JSON.stringify(labels.kanban)}, to: ${JSON.stringify(options.kanbanRoute)} },
    showcase: { label: ${JSON.stringify(labels.showcase)}, to: ${JSON.stringify(options.showcaseRoute)} },
  },
  labels: {
    contacts: ${JSON.stringify(labels.contacts)},
    inbox: ${JSON.stringify(labels.inbox)},
  },
  dashboard: ${JSON.stringify(options.dashboardScreen)} as 'reports' | 'connections',
  inbox: ${JSON.stringify(options.inboxScreen)} as 'contacts' | 'brain',
  contacts: ${JSON.stringify(options.contactsScreen)} as 'contacts' | 'clients',
  search: ${JSON.stringify(options.searchScreen)} as 'workspace' | 'assistant',
} as const
`;
  const generatedPath = "apps/web/src/config/product-shell.ts";
  const files = [
    { path: generatedPath, content: configuration },
    {
      path: "docs/template/generated/provenance/configure-shell.json",
      content: `${JSON.stringify(
        {
          generator: "configure-shell",
          commandFamily: "template:configure-shell",
          screenAuthority: {
            shell: "app-shell",
            dashboard:
              options.dashboardScreen === "connections"
                ? "pro-story:packages/blocks/settings/integration-card/integration-card.stories.tsx"
                : "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/index.tsx",
            inbox:
              "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/inbox.tsx",
            inboxDetail:
              "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/inbox/$id.tsx",
            contacts:
              "starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx",
            editor: "starter-story:packages/ui/src/editor/editor.stories.tsx",
            settings: "starter-route-tree",
          },
          options: { ...options, ...labels },
          generatedPaths: [generatedPath],
        },
        null,
        2,
      )}\n`,
    },
  ];
  return { configuration: options, files } as const;
};
