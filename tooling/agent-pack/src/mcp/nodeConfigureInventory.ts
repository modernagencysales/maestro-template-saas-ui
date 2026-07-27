import type { RepositoryContext } from "../repoContext.js";
import type { VerificationExecFile } from "../verificationRunner.js";
import { MAX_CONFIG_BYTES } from "./nodeConfigureShared.js";

export async function readInstalledConvexMcpInventory(input: {
  readonly execFile: VerificationExecFile;
  readonly repo: RepositoryContext;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
}): Promise<readonly string[]> {
  const result = await input.execFile(
    "pnpm",
    ["exec", "convex", "mcp", "start", "--help"],
    {
      cwd: input.repo.sourceRoot,
      timeoutMs: input.timeoutMs ?? 10_000,
      maxBufferBytes: input.maxBufferBytes ?? MAX_CONFIG_BYTES,
    },
  );
  const match =
    result.exitCode === 0
      ? result.stdout.match(
          /--disable-tools <tool-names>[^\n]*\(options: ([A-Za-z, ]+)\)/,
        )
      : null;
  const tools = match?.[1]?.split(",").map((tool) => tool.trim()) ?? [];
  if (
    tools.length === 0 ||
    tools.some((tool) => tool.length === 0) ||
    new Set(tools).size !== tools.length
  ) {
    throw new Error("installed Convex MCP inventory unavailable");
  }
  return tools;
}
