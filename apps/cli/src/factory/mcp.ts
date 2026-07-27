import type { Readable, Writable } from "node:stream";

export type McpCliStreams = {
  readonly stdin: Readable;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly cwd: string;
};

export type McpCliAdapter = {
  readonly serve: (input: McpCliStreams) => Promise<void>;
};

export function createMcpCliAdapter(
  serve: (input: McpCliStreams) => Promise<void>,
): McpCliAdapter {
  return { serve };
}

export async function runMcpCli(
  adapter: McpCliAdapter,
  streams: McpCliStreams,
): Promise<void> {
  await adapter.serve(streams);
}
