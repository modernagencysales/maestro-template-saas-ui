import { Readable, Writable } from "node:stream";
import { createFactoryCliComposition } from "./composition";

const targetRoot = process.argv[2];
if (targetRoot === undefined)
  throw new Error("Support bundle MCP fixture requires a target root.");

const frames = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      clientInfo: { name: "no-network-fixture", version: "1" },
      capabilities: {},
    },
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "maestro_support_bundle_preview", arguments: {} },
  },
];

const stdout = new Writable({
  write(chunk, _encoding, callback) {
    process.stdout.write(chunk, callback);
  },
});
const stderr = new Writable({
  write(chunk, _encoding, callback) {
    process.stderr.write(chunk, callback);
  },
});

await createFactoryCliComposition(() => ({})).mcp.serve({
  stdin: Readable.from(frames.map((frame) => `${JSON.stringify(frame)}\n`)),
  stdout,
  stderr,
  cwd: targetRoot,
});
