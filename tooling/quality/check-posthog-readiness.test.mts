import { describe, expect, it } from "vitest";
import { evaluateStaticCheck } from "./src/gate.mts";
import {
  expectDescriptorPassesAndFails,
  withTempRepo,
} from "./src/check-test-helpers.mts";
import {
  descriptor,
  descriptorForRepository,
} from "./check-posthog-readiness.mts";

const factoryOnlyFiles = new Set([
  "tooling/generators/src/index.ts",
  "tooling/generators/src/index.test.ts",
  "docs/template/effectification-status.md",
]);

function passingFiles(options?: {
  readonly includeFactoryFiles?: boolean;
}): Record<string, string> {
  return Object.fromEntries(
    descriptor.requirements
      .filter(
        ({ file }) =>
          options?.includeFactoryFiles !== false || !factoryOnlyFiles.has(file),
      )
      .map((requirement) => [
        requirement.file,
        `${(requirement.includes ?? []).join("\n")}\n`,
      ]),
  );
}

const generatedCustomerMarker = (schemaVersion: 1 | 2 = 2) =>
  `${JSON.stringify({
    schemaVersion,
    release: {
      version: "0.2.0-alpha.2",
      tag: "maestro-template-v0.2.0-alpha.2",
      sourceCommit: "0123456789abcdef",
    },
    blueprint: {
      id: "saas-application",
      provenance: "@maestro-template/generators/saas-application@1",
    },
  })}\n`;

describe("check:posthog-readiness", () => {
  it("passes and fails on its declared requirements", async () => {
    await expectDescriptorPassesAndFails(descriptor);
  });

  it("keeps every factory-only requirement in factory mode", async () => {
    await withTempRepo(
      passingFiles({ includeFactoryFiles: false }),
      async (repo) => {
        const result = await evaluateStaticCheck(
          repo,
          await descriptorForRepository(repo),
        );

        expect(result.ok).toBe(false);
        expect(result.failures).toEqual(
          expect.arrayContaining([
            expect.stringContaining("missing tooling/generators/src/index.ts"),
            expect.stringContaining(
              "missing tooling/generators/src/index.test.ts",
            ),
            expect.stringContaining(
              "missing docs/template/effectification-status.md",
            ),
          ]),
        );
      },
    );
  });

  it("omits only factory-only requirements for a generated customer", async () => {
    await withTempRepo(
      {
        ...passingFiles({ includeFactoryFiles: false }),
        "template-instance.json": generatedCustomerMarker(),
      },
      async (repo) => {
        const customerDescriptor = await descriptorForRepository(repo);
        const result = await evaluateStaticCheck(repo, customerDescriptor);

        expect(result.ok).toBe(true);
        expect(customerDescriptor.requirements).toHaveLength(
          descriptor.requirements.length - factoryOnlyFiles.size,
        );
      },
    );
  });

  it("continues to recognize legacy generated customers", async () => {
    await withTempRepo(
      {
        ...passingFiles({ includeFactoryFiles: false }),
        "template-instance.json": generatedCustomerMarker(1),
      },
      async (repo) => {
        const result = await evaluateStaticCheck(
          repo,
          await descriptorForRepository(repo),
        );

        expect(result.ok).toBe(true);
      },
    );
  });

  it("continues to enforce customer-shipped PostHog contracts", async () => {
    const files = passingFiles({ includeFactoryFiles: false });
    delete files["docs/template/integrations.md"];

    await withTempRepo(
      {
        ...files,
        "template-instance.json": generatedCustomerMarker(),
      },
      async (repo) => {
        const result = await evaluateStaticCheck(
          repo,
          await descriptorForRepository(repo),
        );

        expect(result.ok).toBe(false);
        expect(result.failures).toContain(
          "integrations docs must define PostHog backend Confect failure capture and query limitation: missing docs/template/integrations.md",
        );
      },
    );
  });

  it("does not treat a malformed instance marker as customer mode", async () => {
    await withTempRepo(
      {
        ...passingFiles({ includeFactoryFiles: false }),
        "template-instance.json": '{"schemaVersion":1,"blueprint":{}}\n',
      },
      async (repo) => {
        const result = await evaluateStaticCheck(
          repo,
          await descriptorForRepository(repo),
        );

        expect(result.ok).toBe(false);
        expect(result.failures).toEqual(
          expect.arrayContaining([
            expect.stringContaining("missing tooling/generators/src/index.ts"),
          ]),
        );
      },
    );
  });
});
