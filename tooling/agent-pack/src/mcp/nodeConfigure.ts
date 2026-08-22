import type { VerificationExecFile } from "../verificationRunner.js";
import type { McpConfigurationStore } from "./configure.js";
import { applyClaude, removeClaude } from "./nodeConfigureClaude.js";
import { applyCodex, removeCodex } from "./nodeConfigureCodex.js";
import {
  nodeMcpConfigurationFileSystem,
  type McpConfigurationFileSystem,
} from "./nodeConfigureIo.js";

export type { McpConfigurationFileSystem } from "./nodeConfigureIo.js";
export { readInstalledConvexMcpInventory } from "./nodeConfigureInventory.js";

export function createRepositoryLocalMcpConfigurationStore(input: {
  readonly execFile: VerificationExecFile;
  readonly fs?: McpConfigurationFileSystem;
}): McpConfigurationStore {
  const fs = input.fs ?? nodeMcpConfigurationFileSystem;
  return {
    apply: async (receipt) =>
      receipt.host === "claude-code"
        ? applyClaude(receipt, input.execFile, fs)
        : applyCodex(receipt, fs),
    remove: async (key) =>
      key.host === "claude-code"
        ? removeClaude(key, input.execFile, fs)
        : removeCodex(key, fs),
  };
}
