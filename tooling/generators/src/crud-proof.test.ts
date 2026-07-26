import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseCrudProofArgs, runCrudProof } from "./crud-proof";

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
      create: {
        statusCode: 201,
        record: { id: "record_0001", synthetic: false },
      },
      read: {
        statusCode: 200,
        record: { id: "record_0001", synthetic: false },
      },
      statuses: { create: 201, read: 200 },
      record: { id: "record_0001", sameBody: true, synthetic: false },
    });
    expect(report.record.readBodyHash).toBe(report.record.createBodyHash);
    expect(report.read.record).toEqual(report.create.record);
  });

  it("exposes the validated read through a live-runtime callback", async () => {
    let liveUrl: string | undefined;
    const report = await runCrudProof({
      cwd: fixture(),
      adapterModulePath: resolve(
        import.meta.dirname,
        "../../..",
        "examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
      ),
      withLiveRuntime: async (runtime) => {
        liveUrl = runtime.url;
        const response = await fetch(runtime.url);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          id: runtime.proof.record.id,
          workspaceId: "workspace_crud_proof",
        });
        expect(runtime.proof.read.record.synthetic).toBe(false);
      },
    });

    expect(liveUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/api\/records\/record_0001\?/u,
    );
    expect(report.read.record).toEqual(report.create.record);
    await expect(fetch(liveUrl as string)).rejects.toThrow();
  });

  it("closes the live runtime when its callback fails", async () => {
    let liveUrl: string | undefined;
    await expect(
      runCrudProof({
        cwd: fixture(),
        adapterModulePath: resolve(
          import.meta.dirname,
          "../../..",
          "examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts",
        ),
        withLiveRuntime: async (runtime) => {
          liveUrl = runtime.url;
          expect((await fetch(runtime.url)).status).toBe(200);
          throw new Error("consumer-failed");
        },
      }),
    ).rejects.toThrow("consumer-failed");

    expect(liveUrl).toBeDefined();
    await expect(fetch(liveUrl as string)).rejects.toThrow();
  });

  it("accepts the optional JSON compatibility flag in either position", () => {
    expect(parseCrudProofArgs(["--json"])).toEqual({
      mode: "fake",
      json: true,
    });
    expect(parseCrudProofArgs(["--mode", "fake", "--json"])).toEqual({
      mode: "fake",
      json: true,
    });
    expect(parseCrudProofArgs(["--mode", "fake", "--", "--json"])).toEqual({
      mode: "fake",
      json: true,
    });
    expect(parseCrudProofArgs(["--json", "--mode", "fake"])).toEqual({
      mode: "fake",
      json: true,
    });
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
