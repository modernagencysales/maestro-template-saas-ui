import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
  writeFileSync(
    join(fixturePath, "seed/secret.txt"),
    "customer-secret-canary-abc123\n",
  );
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
  it("previews bounded privacy, collisions, and the write-only confirmation", () => {
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
      });
      expect(plan.confirmationCommand).toBe(
        'pnpm template:private-package:import -- --fixture "examples/generic-ai-ops" --system "knowledge-brain" --disposition extend --write',
      );
      expect(existsSync(join(root, "private-packages"))).toBe(false);
      expect(JSON.stringify(plan)).not.toContain("customer-secret-canary");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recomputes the plan immediately before a write", () => {
    const { root, fixturePath } = fixture();
    try {
      buildPrivatePackagePlan(request(root, fixturePath));
      writeFileSync(
        join(fixturePath, "template-package.json"),
        `${JSON.stringify({
          name: "generic-ai-ops",
          capabilities: ["summarizeSource", "draftPlan"],
          workflows: ["sourceGroundedPlan"],
        })}\n`,
      );
      const imported = executePrivatePackagePlan({
        ...request(root, fixturePath),
        mode: "import",
        write: true,
      });
      expect(imported.files).toContainEqual(
        expect.objectContaining({
          path: "private-packages/generic-ai-ops/src/capabilities/draftPlan/draftPlan.contract.json",
        }),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes exactly the reviewed files after confirmation", () => {
    const { root, fixturePath } = fixture();
    try {
      const imported = executePrivatePackagePlan({
        ...request(root, fixturePath),
        mode: "import",
        write: true,
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
        }),
      ).toThrow("Refusing to overwrite");
      expect(readFileSync(occupied, "utf8")).toBe("customer-owned\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a malformed manifest before writing", () => {
    const { root, fixturePath } = fixture();
    try {
      writeFileSync(join(fixturePath, "template-package.json"), "{ bad json\n");
      const plan = buildPrivatePackagePlan(request(root, fixturePath));
      expect(plan).toMatchObject({ ok: false });
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow("not safe to write");
      expect(existsSync(join(root, "private-packages"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses traversal declarations before writing", () => {
    const { root, fixturePath } = fixture();
    try {
      writeFileSync(
        join(fixturePath, "template-package.json"),
        `${JSON.stringify({
          name: "generic-ai-ops",
          capabilities: ["../escape"],
        })}\n`,
      );
      const plan = buildPrivatePackagePlan(request(root, fixturePath));
      expect(plan).toMatchObject({ ok: false });
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow("not safe to write");
      expect(existsSync(join(root, "private-packages"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a symlinked target ancestor before writing", () => {
    const { root, fixturePath } = fixture();
    const outside = mkdtempSync(join(tmpdir(), "maestro-private-outside-"));
    try {
      symlinkSync(outside, join(root, "private-packages"));
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow("symlinked target ancestor");
      expect(existsSync(join(outside, "generic-ai-ops"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses a dangling final destination before writing", () => {
    const { root, fixturePath } = fixture();
    try {
      const destination = join(
        root,
        "private-packages/generic-ai-ops/package-plan.json",
      );
      mkdirSync(dirname(destination), { recursive: true });
      symlinkSync(join(root, "missing-package-plan.json"), destination);
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow("Refusing to overwrite");
      expect(
        existsSync(join(root, "private-packages/generic-ai-ops/README.md")),
      ).toBe(false);
      expect(existsSync(join(root, "docs/template/generated/provenance"))).toBe(
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a dangling target ancestor before writing", () => {
    const { root, fixturePath } = fixture();
    try {
      symlinkSync(
        join(root, "missing-private-packages"),
        join(root, "private-packages"),
      );
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow("symlinked target ancestor");
      expect(existsSync(join(root, "docs/template/generated/provenance"))).toBe(
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports newly created paths if an exclusive write fails mid-import", () => {
    const { root, fixturePath } = fixture();
    try {
      const blocked = join(root, "private-packages/generic-ai-ops/src");
      mkdirSync(dirname(blocked), { recursive: true });
      writeFileSync(blocked, "blocked\n");
      expect(() =>
        executePrivatePackagePlan({
          ...request(root, fixturePath),
          mode: "import",
          write: true,
        }),
      ).toThrow(
        "newly created paths: private-packages/generic-ai-ops/package-plan.json, private-packages/generic-ai-ops/README.md",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
