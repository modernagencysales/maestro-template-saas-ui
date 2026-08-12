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
};

export type TagFixture = {
  id: string;
  name: string;
  color: string;
};

export type ContactFixture = {
  id: string;
  name: string;
  email: string;
  company: string;
  status: "active" | "inactive";
};

export type NavigationFixture = {
  label: string;
  to: string;
};

export type SearchResultFixture = NavigationFixture & {
  description: string;
};

const tags = [
  { id: "tag-1", name: "Priority", color: "red" },
  { id: "tag-2", name: "Partner", color: "blue" },
] as const satisfies readonly TagFixture[];

const workspace = {
  id: "workspace-1",
  slug: "acme",
  name: "Acme Inc.",
  label: "Acme Inc.",
  logo: undefined,
  tags,
} satisfies WorkspaceFixture;

export const goldenFixtures = {
  currentWorkspace: workspace,
  workspaces: [workspace],
  currentUser: {
    id: "user-1",
    name: "Alex Morgan",
    email: "alex@example.com",
    image: undefined,
    avatar: undefined,
    workspaces: [workspace],
  } satisfies UserFixture,
  contacts: [
    {
      id: "contact-1",
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Northstar Labs",
      status: "active",
    },
    {
      id: "contact-2",
      name: "Sam Rivera",
      email: "sam@example.com",
      company: "Acme Inc.",
      status: "inactive",
    },
  ] satisfies readonly ContactFixture[],
  navigation: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Contacts", to: "/contacts" },
    { label: "Reports", to: "/reports" },
    { label: "Settings", to: "/settings" },
  ] satisfies readonly NavigationFixture[],
} as const;

export type GoldenFixtures = typeof goldenFixtures;
