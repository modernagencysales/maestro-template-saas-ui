export type NoNetworkFactoryCase = {
  readonly id: string;
  readonly command: string;
  readonly argv: readonly string[];
};

export const NO_NETWORK_FACTORY_CASES: readonly NoNetworkFactoryCase[] = [
  {
    id: "create-preview",
    command: "create",
    argv: [
      "create",
      "<CUSTOMER_TARGET>",
      "--name",
      "Privacy Fixture",
      "--outcome",
      "Prove local behavior",
      "--json",
    ],
  },
  { id: "start-help", command: "start", argv: ["start", "--help"] },
  {
    id: "add-preview",
    command: "add",
    argv: [
      "add",
      "crud-business-entity",
      "--answer",
      "entityName=PrivacyRecord",
      "--json",
    ],
  },
  {
    id: "recipes-list",
    command: "recipes",
    argv: ["recipes", "list", "--json"],
  },
  {
    id: "doctor-fake",
    command: "doctor",
    argv: ["doctor", "convex", "--environment", "fake", "--json"],
  },
  {
    id: "preflight-fake",
    command: "preflight",
    argv: ["preflight", "--mode", "fake", "--json"],
  },
  {
    id: "verify-focused",
    command: "verify",
    argv: [
      "verify",
      "--scope",
      "focused",
      "--changed",
      "privacy-no-network-fixture",
      "--json",
    ],
  },
  {
    id: "check-fake-focused",
    command: "check",
    argv: [
      "check",
      "--mode",
      "fake",
      "--scope",
      "focused",
      "--changed",
      "privacy-no-network-fixture",
      "--json",
    ],
  },
  {
    id: "scaffold-preview",
    command: "scaffold",
    argv: [
      "scaffold",
      "--generator",
      "add-capability",
      "--args",
      '{"name":"privacyFixture","system":"knowledge-brain","disposition":"extend","exposure":"headless"}',
      "--json",
    ],
  },
  {
    id: "support-bundle-preview",
    command: "support-bundle",
    argv: ["support-bundle", "--json"],
  },
];
