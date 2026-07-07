import { useState } from "react";

export type TemplateSettingsTab =
  "general" | "people" | "billing" | "notifications" | "security";

export type TemplateSettingsAccount = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

export type TemplateSettingsWorkspace = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly plan: "free" | "business" | "enterprise";
  readonly role: "owner" | "admin" | "member";
};

export type TemplateSettingsAdapters = {
  readonly account: TemplateSettingsAccount;
  readonly workspace: TemplateSettingsWorkspace;
  readonly sessions: readonly {
    readonly id: string;
    readonly device: string;
    readonly lastActive: number;
    readonly location: string;
  }[];
};

const templateSettingsTabs: readonly {
  readonly key: TemplateSettingsTab;
  readonly label: string;
  readonly icon: string;
}[] = [
  { key: "general", label: "Workspace", icon: "W" },
  { key: "people", label: "People", icon: "P" },
  { key: "billing", label: "Billing", icon: "$" },
  { key: "notifications", label: "Notifications", icon: "N" },
  { key: "security", label: "Security", icon: "S" },
];

export function createTemplateSettingsMockAdapters(options?: {
  readonly appName?: string;
  readonly workspaceSlug?: string;
}): TemplateSettingsAdapters {
  const workspaceName = options?.appName ?? "Maestro Template";

  return {
    account: {
      id: "user_template_operator",
      name: "Template Operator",
      email: "operator@example.test",
    },
    workspace: {
      id: "workspace_template",
      name: workspaceName,
      slug: options?.workspaceSlug ?? "maestro-template",
      plan: "business",
      role: "owner",
    },
    sessions: [
      {
        id: "session_template_local",
        device: "Local browser",
        lastActive: 1782921600000,
        location: "Local fake mode",
      },
    ],
  };
}

export function TemplateSettingsPanel({
  adapters = createTemplateSettingsMockAdapters(),
  initialTab = "general",
}: {
  readonly adapters?: TemplateSettingsAdapters;
  readonly initialTab?: TemplateSettingsTab;
}) {
  const [activeTab, setActiveTab] = useState<TemplateSettingsTab>(initialTab);

  return (
    <section className="template-settings-panel" aria-label="Settings">
      <aside className="template-settings-sidebar">
        <h2>Settings</h2>
        <nav aria-label="Settings sections">
          {templateSettingsTabs.map((tab) => (
            <button
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={
                activeTab === tab.key
                  ? "template-settings-tab is-active"
                  : "template-settings-tab"
              }
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="template-settings-content">
        <section className="template-settings-section">
          <h3>{activeTabLabel(activeTab)}</h3>
          <dl>
            <div className="template-settings-rule">
              <dt>Provider posture</dt>
              <dd>
                Fake/local adapters are active until this client fork explicitly
                enables live providers.
              </dd>
              <dd>Fake mode</dd>
            </div>
            <div className="template-settings-rule">
              <dt>Client setup</dt>
              <dd>
                WorkOS, PostHog, billing, email, storage, and AI provider setup
                stay behind typed adapters.
              </dd>
              <dd>Adapter-backed</dd>
            </div>
            <div className="template-settings-rule">
              <dt>Workspace</dt>
              <dd>{adapters.workspace.name}</dd>
              <dd>{adapters.account.email}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}

function activeTabLabel(tab: TemplateSettingsTab): string {
  return (
    templateSettingsTabs.find((candidate) => candidate.key === tab)?.label ??
    "Settings"
  );
}
