const sharedHelp = Object.freeze({
  workflow:
    "maestro-template workflow run [--workflow <id>] [--workspace <slug>] [--idempotency-key <key>] [--mode <mode>] [--input <json>]\n",
  operations:
    "maestro-template operations list\nmaestro-template operations get <id>\n",
  api: "maestro-template api catalog\nmaestro-template api openapi\n",
  mcp: "maestro-template mcp tools\nmaestro-template mcp call <toolName>\n",
  capability:
    "maestro-template capability run <id> --workspace <slug> --input <json> --idempotency-key <key>\n",
  integrations: "maestro-template integrations report [fake|test|live]\n",
} as const);

export function helpForSharedCommand(command: string): string | undefined {
  return sharedHelp[command as keyof typeof sharedHelp];
}
