import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCrudProof } from "./crud-proof";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "maestro-crud-proof-"));
  roots.push(root);
  writeFileSync(
    join(root, "template-instance.json"),
    JSON.stringify({
      blueprint: { id: "saas-application" },
      personalization: { demoOnly: true },
    }),
  );
  return root;
};

describe("generated customer CRUD proof", () => {
  it("creates and reads the same real fake-adapter record", async () => {
    const report = await runCrudProof({
      cwd: fixture(),
      adapterModulePath: resolve(
        import.meta.dirname,
        "../../..",
        "examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
      ),
    });
    expect(report).toMatchObject({
      ok: true,
      url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      statuses: { create: 201, read: 200 },
      record: { id: "record_0001", sameBody: true, synthetic: false },
    });
    expect(report.record.readBodyHash).toBe(report.record.createBodyHash);
  });

  it("rejects production before loading the adapter", async () => {
    await expect(
      runCrudProof({
        cwd: fixture(),
        environment: { NODE_ENV: "production" },
        adapterModulePath: "/unreachable/adapter.ts",
      }),
    ).rejects.toThrow("unavailable in a production environment");
  });
});
