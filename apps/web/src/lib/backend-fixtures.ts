export const demoUser = {
  id: "parity-user",
  name: "Demo User",
  email: "parity@saas-ui.dev",
  image: null,
  workspaces: [
    {
      id: "awesome-inc",
      slug: "awesome-inc",
      name: "Awesome Inc.",
      logo: null,
    },
  ],
};

export const demoWorkspace = {
  id: "awesome-inc",
  slug: "awesome-inc",
  name: "Awesome Inc.",
  logo: null,
  tags: [],
  members: [{ id: demoUser.id, roles: ["admin"] }],
  subscription: { status: "active", planId: "free@1" },
};
