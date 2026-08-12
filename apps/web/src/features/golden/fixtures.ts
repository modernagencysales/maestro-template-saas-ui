export type GoldenState =
  | "loading"
  | "empty"
  | "ready-read"
  | "ready-edit"
  | "mutation-success"
  | "mutation-failure"
  | "error"
  | "not-found"
  | "permission-denied";

export type UserFixture = {
  id: string;
  name: string;
  email: string;
  image?: string;
  avatar?: string;
  workspaces: readonly WorkspaceFixture[];
};

export type WorkspaceFixture = {
  id: string;
  slug: string;
  name: string;
  label: string;
  logo?: string;
  tags: readonly TagFixture[];
  members: readonly {
    id: string;
    name?: string;
    email: string;
    roles: string[];
    status: string;
  }[];
  subscription: {
    accountId: string | null;
    status: string;
    planId: string;
    startedAt: string;
    trialEndsAt: string;
    cancelAt: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
  };
};

export type TagFixture = {
  id: string;
  name: string;
  label: string;
  color: string;
};

export type ContactFixture = {
  id: string;
  name: string;
  email: string;
  company: string;
  status: "active" | "inactive";
  type: "lead" | "customer";
  tags: readonly string[];
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export type NavigationFixture = {
  label: string;
  to: string;
};

export type SearchResultFixture = NavigationFixture & {
  description: string;
};

const tags = [
  { id: "tag-1", name: "Priority", label: "Priority", color: "red" },
  { id: "tag-2", name: "Partner", label: "Partner", color: "blue" },
] as const satisfies readonly TagFixture[];

const workspace = {
  id: "workspace-1",
  slug: "acme",
  name: "Acme Inc.",
  label: "Acme Inc.",
  tags,
  members: [
    {
      id: "user-1",
      name: "Alex Morgan",
      email: "alex@example.com",
      roles: ["admin"],
      status: "active",
    },
  ],
  subscription: {
    accountId: null,
    status: "active",
    planId: "starter",
    startedAt: "2026-01-01T00:00:00.000Z",
    trialEndsAt: "2026-02-01T00:00:00.000Z",
    cancelAt: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-02-28T00:00:00.000Z",
  },
} satisfies WorkspaceFixture;

export const goldenFixtures = {
  currentWorkspace: workspace,
  workspaces: [workspace],
  currentUser: {
    id: "user-1",
    name: "Alex Morgan",
    email: "alex@example.com",
    workspaces: [workspace],
  } satisfies UserFixture,
  contacts: [
    {
      id: "contact-1",
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Northstar Labs",
      status: "active",
      type: "lead",
      tags: ["Priority"],
      workspaceId: "workspace-1",
      createdAt: "2026-01-12T09:00:00.000Z",
      updatedAt: "2026-01-15T09:00:00.000Z",
    },
    {
      id: "contact-2",
      name: "Sam Rivera",
      email: "sam@example.com",
      company: "Acme Inc.",
      status: "inactive",
      type: "customer",
      tags: ["Partner"],
      workspaceId: "workspace-1",
      createdAt: "2026-01-10T09:00:00.000Z",
      updatedAt: "2026-01-14T09:00:00.000Z",
    },
  ] satisfies readonly ContactFixture[],
  notifications: [
    {
      id: "notification-1",
      subjectId: "contact-1",
      actorId: "user-1",
      createdAt: "2026-01-15T09:00:00.000Z",
      type: "action",
      subject: { name: "Jordan Lee" },
      metadata: { action: "created-contact" },
    },
    {
      id: "notification-2",
      subjectId: "contact-2",
      actorId: "user-1",
      createdAt: "2026-01-14T09:00:00.000Z",
      type: "action",
      subject: { name: "Sam Rivera" },
      metadata: { action: "created-contact" },
    },
  ],
  billing: {
    email: "alex@example.com",
    invoices: [
      {
        number: "INV-001",
        date: "2026-01-15T00:00:00.000Z",
        status: "paid",
        total: 2900,
        currency: "USD",
        url: null,
      },
    ],
  },
  navigation: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Contacts", to: "/contacts" },
    { label: "Reports", to: "/reports" },
    { label: "Settings", to: "/settings" },
  ] satisfies readonly NavigationFixture[],
} as const;

export type GoldenFixtures = typeof goldenFixtures;
