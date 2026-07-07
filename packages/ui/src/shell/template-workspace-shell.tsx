import type { ReactNode } from "react";
import { useState } from "react";
import { TemplateMainContent } from "../blocks/ux-essentials";

export type TemplateShellRouteItem = {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly href?: string;
  readonly hint?: string;
};

export type TemplateShellNavCategory = {
  readonly label: string;
  readonly defaultExpanded?: boolean;
  readonly items: readonly TemplateShellRouteItem[];
};

export type TemplateShellActionItem = {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly hint?: string;
  readonly onSelect: () => void;
};

export type TemplateWorkspaceShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly activeKey?: string;
  readonly navigation: readonly TemplateShellNavCategory[];
  readonly actions?: readonly TemplateShellActionItem[];
  readonly footerItems?: readonly TemplateShellActionItem[];
  readonly topbarTitle?: string;
  readonly onNavigate?: (key: string) => void;
  readonly children: ReactNode;
};

export function TemplateRouteItem({
  item,
  activeKey,
  onNavigate,
  onClose,
}: {
  readonly item: TemplateShellRouteItem;
  readonly activeKey?: string | undefined;
  readonly onNavigate?: ((key: string) => void) | undefined;
  readonly onClose?: (() => void) | undefined;
}) {
  const isActive = activeKey === item.key;

  return (
    <li className="template-sidebar-menuitem">
      <a
        aria-current={isActive ? "page" : undefined}
        className={
          isActive ? "template-sidebar-row is-active" : "template-sidebar-row"
        }
        href={item.href ?? `#${item.key}`}
        onClick={(event) => {
          if (!item.href || item.href.startsWith("#")) {
            event.preventDefault();
          }

          onNavigate?.(item.key);
          onClose?.();

          if (item.href?.startsWith("#") && typeof window !== "undefined") {
            window.history.replaceState(null, "", item.href);
          }
        }}
      >
        <span className="template-sidebar-icon" aria-hidden="true">
          {item.icon ?? item.label.slice(0, 1)}
        </span>
        <span className="template-sidebar-label">{item.label}</span>
        {item.hint ? (
          <span className="template-sidebar-hint">{item.hint}</span>
        ) : null}
      </a>
    </li>
  );
}

export function TemplateActionItem({
  item,
}: {
  readonly item: TemplateShellActionItem;
}) {
  return (
    <li className="template-sidebar-menuitem">
      <button
        className="template-sidebar-row"
        onClick={item.onSelect}
        type="button"
      >
        <span className="template-sidebar-icon" aria-hidden="true">
          {item.icon ?? item.label.slice(0, 1)}
        </span>
        <span className="template-sidebar-label">{item.label}</span>
        {item.hint ? (
          <span className="template-sidebar-hint">{item.hint}</span>
        ) : null}
      </button>
    </li>
  );
}

export function TemplateFooterItem({
  item,
}: {
  readonly item: TemplateShellActionItem;
}) {
  return <TemplateActionItem item={item} />;
}

export function TemplateWorkspaceShell({
  title,
  subtitle,
  activeKey,
  navigation,
  actions = [],
  footerItems = [],
  topbarTitle,
  onNavigate,
  children,
}: TemplateWorkspaceShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  return (
    <div
      className={
        sidebarOpen
          ? "template-workspace-shell"
          : "template-workspace-shell is-sidebar-closed"
      }
    >
      {sidebarOpen ? (
        <TemplateSidebar
          actions={actions}
          activeKey={activeKey}
          footerItems={footerItems}
          navigation={navigation}
          onClose={closeSidebar}
          onNavigate={onNavigate}
          subtitle={subtitle}
          title={title}
        />
      ) : null}

      <TemplateShellMain
        onOpenSidebar={openSidebar}
        sidebarOpen={sidebarOpen}
        title={topbarTitle ?? title}
      >
        {children}
      </TemplateShellMain>
    </div>
  );
}

function TemplateSidebar({
  actions,
  activeKey,
  footerItems,
  navigation,
  onClose,
  onNavigate,
  subtitle,
  title,
}: {
  readonly actions: readonly TemplateShellActionItem[];
  readonly activeKey?: string | undefined;
  readonly footerItems: readonly TemplateShellActionItem[];
  readonly navigation: readonly TemplateShellNavCategory[];
  readonly onClose: () => void;
  readonly onNavigate?: ((key: string) => void) | undefined;
  readonly subtitle?: string | undefined;
  readonly title: string;
}) {
  return (
    <aside className="template-sidebar" aria-label="Workspace navigation">
      <TemplateSidebarHeader
        onClose={onClose}
        subtitle={subtitle}
        title={title}
      />
      <div className="template-sidebar-content">
        <TemplateSidebarNav
          actions={actions}
          activeKey={activeKey}
          navigation={navigation}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      </div>
      <TemplateSidebarFooter items={footerItems} />
    </aside>
  );
}

function TemplateSidebarHeader({
  onClose,
  subtitle,
  title,
}: {
  readonly onClose: () => void;
  readonly subtitle?: string | undefined;
  readonly title: string;
}) {
  return (
    <header className="template-sidebar-header">
      <button className="template-workspace-switcher" type="button">
        <span className="template-workspace-mark" aria-hidden="true">
          {title.slice(0, 1)}
        </span>
        <span>
          <span className="template-workspace-name">{title}</span>
          {subtitle ? (
            <span className="template-workspace-subtitle">{subtitle}</span>
          ) : null}
        </span>
      </button>
      <button
        aria-label="Close sidebar"
        className="template-sidebar-toggle"
        onClick={onClose}
        type="button"
      >
        Close
      </button>
    </header>
  );
}

function TemplateSidebarNav({
  actions,
  activeKey,
  navigation,
  onClose,
  onNavigate,
}: {
  readonly actions: readonly TemplateShellActionItem[];
  readonly activeKey?: string | undefined;
  readonly navigation: readonly TemplateShellNavCategory[];
  readonly onClose: () => void;
  readonly onNavigate?: ((key: string) => void) | undefined;
}) {
  return (
    <nav aria-label="Primary">
      {navigation.map((category) => (
        <TemplateNavCategorySection
          activeKey={activeKey}
          category={category}
          key={category.label}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      ))}
      <TemplateActionsSection actions={actions} />
    </nav>
  );
}

function TemplateNavCategorySection({
  activeKey,
  category,
  onClose,
  onNavigate,
}: {
  readonly activeKey?: string | undefined;
  readonly category: TemplateShellNavCategory;
  readonly onClose: () => void;
  readonly onNavigate?: ((key: string) => void) | undefined;
}) {
  return (
    <section
      className="template-sidebar-group"
      data-default-expanded={category.defaultExpanded ? "true" : "false"}
    >
      <p className="template-sidebar-group-label">{category.label}</p>
      <ul>
        {category.items.map((item) => (
          <TemplateRouteItem
            activeKey={activeKey}
            item={item}
            key={item.key}
            onClose={onClose}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </section>
  );
}

function TemplateActionsSection({
  actions,
}: {
  readonly actions: readonly TemplateShellActionItem[];
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="template-sidebar-group">
      <p className="template-sidebar-group-label">Actions</p>
      <ul>
        {actions.map((item) => (
          <TemplateActionItem item={item} key={item.key} />
        ))}
      </ul>
    </section>
  );
}

function TemplateSidebarFooter({
  items,
}: {
  readonly items: readonly TemplateShellActionItem[];
}) {
  return (
    <footer className="template-sidebar-footer">
      <ul>
        {items.map((item) => (
          <TemplateFooterItem item={item} key={item.key} />
        ))}
      </ul>
    </footer>
  );
}

function TemplateShellMain({
  children,
  onOpenSidebar,
  sidebarOpen,
  title,
}: {
  readonly children: ReactNode;
  readonly onOpenSidebar: () => void;
  readonly sidebarOpen: boolean;
  readonly title: string;
}) {
  return (
    <div className="template-shell-main">
      <header className="template-shell-topbar" aria-label="Workspace">
        {!sidebarOpen ? (
          <button
            aria-label="Open sidebar"
            className="template-sidebar-toggle"
            onClick={onOpenSidebar}
            type="button"
          >
            Open
          </button>
        ) : null}
        <span className="template-topbar-title">{title}</span>
        <span aria-hidden="true" />
      </header>
      <TemplateMainContent className="template-shell-content">
        {children}
      </TemplateMainContent>
    </div>
  );
}
