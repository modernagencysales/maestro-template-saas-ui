import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPrivatePackagePlan,
  executePrivatePackagePlan,
} from "./private-package";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "maestro-private-package-"));
  const fixturePath = join(root, "examples/generic-ai-ops");
  mkdirSync(join(fixturePath, "seed"), { recursive: true });
  writeFileSync(
    join(fixturePath, "template-package.json"),
    `${JSON.stringify({
      name: "generic-ai-ops",
      capabilities: ["summarizeSource"],
      workflows: ["sourceGroundedPlan"],
      docs: ["README.md"],
    })}\n`,
  );
  writeFileSync(join(fixturePath, "seed/secret.txt"), "must-not-be-read\n");
  return { root, fixturePath };
};

const request = (root: string, fixturePath: string) => ({
  fixturePath,
  fixtureArgument: "examples/generic-ai-ops",
  targetRoot: root,
  system: "knowledge-brain",
  disposition: "extend" as const,
});

describe("customer-safe private package import", () => {
  it("previews bounded privacy, collisions, fingerprint, and exact confirmation", () => {
    const { root, fixturePath } = fixture();
    try {
      const plan = buildPrivatePackagePlan(request(root, fixturePath));
      expect(plan).toMatchObject({
        mode: "dry-run",
        ok: true,
        collisions: [],
        privacy: {
          reads: ["template-package.json"],
          readsSeedData: false,
          readsSecrets: false,
          productionRegistrations: false,
        },
        previewFingerprint: expect.stringMatching(
          /^private_package_sha256:[0-9a-f]{64}$/,
        ),
      });
      expect(plan.confirmationCommand).toContain(
        `--preflight-fingerprint ${plan.previewFingerprint}`,
      );
      expect(existsSync(join(root, "private-packages"))).toBe(false);
      expect(JSON.stringify(plan)).not.toContain("must-not-be-read");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires the exact reviewed fingerprint before writing", () => {
    const { root, fixturePath } = fixture();
    try {
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
          preflightFingerprint: "private_package_sha256:stale",
        }),
      ).toThrow("fingerprint mismatch");
      expect(existsSync(join(root, "private-packages"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes exactly the reviewed files after confirmation", () => {
    const { root, fixturePath } = fixture();
    try {
      const preview = buildPrivatePackagePlan(request(root, fixturePath));
      const imported = executePrivatePackagePlan({
        ...request(root, fixturePath),
        mode: "import",
        write: true,
        preflightFingerprint: preview.previewFingerprint,
      });
      for (const file of imported.files) {
        expect(readFileSync(join(root, file.path), "utf8")).toBe(file.content);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses collisions without overwriting customer files", () => {
    const { root, fixturePath } = fixture();
    try {
      const occupied = join(
        root,
        "private-packages/generic-ai-ops/package-plan.json",
      );
      mkdirSync(dirname(occupied), { recursive: true });
      writeFileSync(occupied, "customer-owned\n");
      const preview = buildPrivatePackagePlan(request(root, fixturePath));
      expect(preview.collisions).toEqual([
        "private-packages/generic-ai-ops/package-plan.json",
      ]);
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
          preflightFingerprint: preview.previewFingerprint,
        }),
      ).toThrow("Refusing to overwrite");
      expect(readFileSync(occupied, "utf8")).toBe("customer-owned\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
