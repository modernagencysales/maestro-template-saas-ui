import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AGENT_PACK_CUSTOMER_TEST_PATHS,
  AGENT_PACK_FACTORY_AUTHORITY_TEST_PATHS,
  isCustomerAgentPackTestPath,
} from "./customerTestClosure.js";

describe("Agent Pack customer test closure", () => {
  it("binds the package customer test script to the reviewed closure", () => {
    const packageManifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { readonly scripts: Readonly<Record<string, string>> };
    const script = packageManifest.scripts["test:customer"];
    expect(script).toBeDefined();
    for (const path of AGENT_PACK_CUSTOMER_TEST_PATHS) {
      expect(script, path).toContain(path.replace("tooling/agent-pack/", ""));
    }
    for (const path of AGENT_PACK_FACTORY_AUTHORITY_TEST_PATHS) {
      expect(script, path).not.toContain(
        path.replace("tooling/agent-pack/", ""),
      );
    }
  });

  it("keeps customer-owned runtime tests in the generated repository", () => {
    for (const path of [
      "tooling/agent-pack/src/contracts.test.ts",
      "tooling/agent-pack/src/nodeAdapters.test.ts",
      "tooling/agent-pack/src/privacy/privacy.supportBundle.test.ts",
      "tooling/agent-pack/src/readiness/artifacts.test.ts",
      "tooling/agent-pack/src/start.test.ts",
      "tooling/agent-pack/src/verify.test.ts",
    ]) {
      expect(isCustomerAgentPackTestPath(path), path).toBe(true);
    }
  });

  it("keeps factory distribution authorities out of customer test composition", () => {
    for (const path of AGENT_PACK_FACTORY_AUTHORITY_TEST_PATHS) {
      expect(isCustomerAgentPackTestPath(path), path).toBe(false);
    }
    expect(
      isCustomerAgentPackTestPath(
        "tooling/agent-pack/evals/forward/forward-runner.test.ts",
      ),
    ).toBe(false);
    expect(
      isCustomerAgentPackTestPath(
        "tooling/agent-pack/evals/walking-skeleton/walking-skeleton.test.ts",
      ),
    ).toBe(false);
  });

  it("does not classify runtime sources or another package's tests", () => {
    expect(
      isCustomerAgentPackTestPath("tooling/agent-pack/src/verify.ts"),
    ).toBe(false);
    expect(
      isCustomerAgentPackTestPath("tooling/quality/check-agent-pack.test.mts"),
    ).toBe(false);
  });
});
