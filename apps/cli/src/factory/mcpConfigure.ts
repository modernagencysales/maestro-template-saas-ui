import { cliSuccess } from "../result";
import type { CliResult } from "../types";
import type { FactoryCliRenderMode } from "./router";

export const MCP_CONFIGURE_HELP =
  "maestro mcp configure --host <claude-code|codex> [--profile <inspect|dev-power>] [--write --privacy-reviewed|--remove] [--human|--details|--json]\n";

type McpConfigureRunner = (
  input: unknown,
  cwd: string,
  renderMode: FactoryCliRenderMode,
) => Promise<CliResult>;

export function createMcpConfigureCliAdapter(run: McpConfigureRunner) {
  return {
    run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
      argv.length === 2 && argv[1] === "--help"
        ? Promise.resolve(cliSuccess(MCP_CONFIGURE_HELP))
        : runMcpConfigureCli(run, argv, cwd),
  };
}

async function runMcpConfigureCli(
  run: McpConfigureRunner,
  argv: readonly string[],
  cwd: string,
): Promise<CliResult> {
  const parsed = parseMcpConfigureCli(argv.slice(1));
  return run(parsed.input, cwd, parsed.renderMode);
}

function parseMcpConfigureCli(argv: readonly string[]): {
  readonly input: unknown;
  readonly renderMode: FactoryCliRenderMode;
} {
  let host: "claude-code" | "codex" | undefined;
  let profile: "inspect" | "dev-power" = "inspect";
  let profileSeen = false;
  let write = false;
  let remove = false;
  let privacyReviewed = false;
  let renderMode: FactoryCliRenderMode = "human";
  let renderSeen = false;
  let valid = true;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write" || token === "--remove") {
      if ((token === "--write" && write) || (token === "--remove" && remove)) {
        valid = false;
      }
      write = write || token === "--write";
      remove = remove || token === "--remove";
      continue;
    }
    if (token === "--privacy-reviewed") {
      if (privacyReviewed) valid = false;
      privacyReviewed = true;
      continue;
    }
    const selected = renderModeFor(token);
    if (selected !== undefined) {
      if (renderSeen) valid = false;
      renderMode = selected;
      renderSeen = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      valid = false;
      continue;
    }
    index += 1;
    if (token === "--host" && host === undefined) {
      if (value === "claude-code" || value === "codex") host = value;
      else valid = false;
    } else if (token === "--profile" && !profileSeen) {
      profileSeen = true;
      if (value === "inspect" || value === "dev-power") profile = value;
      else valid = false;
    } else valid = false;
  }
  if (
    host === undefined ||
    (write && remove) ||
    (remove && profileSeen) ||
    (write && !privacyReviewed) ||
    (!write && privacyReviewed)
  )
    valid = false;
  return {
    input: valid
      ? remove
        ? { host, remove: true }
        : {
            host,
            profile,
            ...(write ? { write: true, privacyReviewed: true } : {}),
          }
      : {},
    renderMode,
  };
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}
