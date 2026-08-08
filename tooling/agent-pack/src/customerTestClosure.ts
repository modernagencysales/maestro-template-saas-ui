export const AGENT_PACK_CUSTOMER_TEST_PATHS = [
  "tooling/agent-pack/src/check.test.ts",
  "tooling/agent-pack/src/contracts.test.ts",
  "tooling/agent-pack/src/create.test.ts",
  "tooling/agent-pack/src/customerTestClosure.test.ts",
  "tooling/agent-pack/src/diagnostics.test.ts",
  "tooling/agent-pack/src/mcp/projection.test.ts",
  "tooling/agent-pack/src/mcp/protocol.test.ts",
  "tooling/agent-pack/src/mcp/server.test.ts",
  "tooling/agent-pack/src/nodeAdapters.test.ts",
  "tooling/agent-pack/src/ports.test.ts",
  "tooling/agent-pack/src/preflight.test.ts",
  "tooling/agent-pack/src/preflightProbe.test.ts",
  "tooling/agent-pack/src/privacy/privacy.canaries.test.ts",
  "tooling/agent-pack/src/privacy/privacy.supportBundle.test.ts",
  "tooling/agent-pack/src/privacy/privacy.test.ts",
  "tooling/agent-pack/src/processSupervisor.test.ts",
  "tooling/agent-pack/src/providers/convex.test.ts",
  "tooling/agent-pack/src/readiness/artifacts.test.ts",
  "tooling/agent-pack/src/readiness/presenter.test.ts",
  "tooling/agent-pack/src/readiness/readiness-visual.test.ts",
  "tooling/agent-pack/src/receipt.test.ts",
  "tooling/agent-pack/src/receiptExport.test.ts",
  "tooling/agent-pack/src/receiptWriter.test.ts",
  "tooling/agent-pack/src/repoContext.test.ts",
  "tooling/agent-pack/src/scaffold.test.ts",
  "tooling/agent-pack/src/start.test.ts",
  "tooling/agent-pack/src/verificationRunner.test.ts",
  "tooling/agent-pack/src/verify.test.ts",
] as const;

export const AGENT_PACK_FACTORY_AUTHORITY_TEST_PATHS = [
  "tooling/agent-pack/src/claudeInstall.native.test.ts",
  "tooling/agent-pack/src/claudeInstall.test.ts",
  "tooling/agent-pack/src/codexInstall.native.test.ts",
  "tooling/agent-pack/src/codexInstall.test.ts",
  "tooling/agent-pack/src/convexAiFiles.test.ts",
  "tooling/agent-pack/src/convexPlugin.test.ts",
  "tooling/agent-pack/src/hostInstall.test.ts",
  "tooling/agent-pack/src/hostProjectionLifecycle.test.ts",
  "tooling/agent-pack/src/mcp/hostDeclarations.test.ts",
  "tooling/agent-pack/src/nodeAdapters.factory.test.ts",
  "tooling/agent-pack/src/syncSkills.test.ts",
] as const;

const customerTestPaths = new Set<string>(AGENT_PACK_CUSTOMER_TEST_PATHS);

export const isCustomerAgentPackTestPath = (path: string): boolean =>
  customerTestPaths.has(path);
