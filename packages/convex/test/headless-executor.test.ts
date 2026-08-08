import { afterEach, describe, expect, it, vi } from "vitest";
import { confectManifest } from "@maestro-template/template-core/generated/confectManifest";
import {
  executeHeadlessOperation,
  findHeadlessOperation,
  type HeadlessExecutionAdapter,
  type HeadlessSurface,
} from "../confect/manifest/executor";

const externalSurfaces = ["api", "cli", "mcp"] as const;

const guardedWrites = confectManifest.functions.filter(
  (operation) =>
    operation.idempotent === false &&
    (operation.kind === "mutation" || operation.kind === "action") &&
    operation.surfaces.some((surface) =>
      externalSurfaces.includes(surface as HeadlessSurface),
    ),
);

const firstExternalSurface = (operation: (typeof guardedWrites)[number]) => {
  const surface = operation.surfaces.find((candidate) =>
    externalSurfaces.includes(candidate as HeadlessSurface),
  );
  if (surface === undefined) {
    throw new Error(`${operation.operationId} has no external surface.`);
  }
  return surface as HeadlessSurface;
};

const createAdapter = (
  overrides: Partial<HeadlessExecutionAdapter> = {},
): HeadlessExecutionAdapter => ({
  refs: {
    "brain.pages.createMarkdown": "brain.pages.createMarkdown.ref",
    "ops.email.dispatchBroadcast": "ops.email.dispatchBroadcast.ref",
  },
  runQuery: async () => {
    throw new Error("runQuery should not be called");
  },
  runMutation: async () => "brainPage_123",
  runAction: async () => {
    throw new Error("runAction should not be called");
  },
  ...overrides,
});

describe("headless executor", () => {
  it("does not expose web-only operations on headless API surfaces", () => {
    expect(findHeadlessOperation("brain.pages.list", "api")).toBeUndefined();
  });

  it("requires idempotency keys for non-idempotent headless writes", async () => {
    const result = await executeHeadlessOperation(createAdapter(), {
      operationId: "brain.pages.createMarkdown",
      surface: "api",
      input: { title: "A note" },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown requires a nonblank idempotencyKey.",
      },
    });
  });

  it("requires an idempotency key before dispatching a broadcast", async () => {
    const result = await executeHeadlessOperation(createAdapter(), {
      operationId: "ops.email.dispatchBroadcast",
      surface: "api",
      input: { confirmation: "SEND" },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation ops.email.dispatchBroadcast requires a nonblank idempotencyKey.",
      },
    });
  });

  it.each(guardedWrites)(
    "rejects missing idempotency for $operationId",
    async (operation) => {
      const dispatched = vi.fn(async () => ({ id: "unexpected" }));
      const result = await executeHeadlessOperation(
        createAdapter({
          refs: { [operation.operationId]: `${operation.operationId}.ref` },
          runMutation: dispatched,
          runAction: dispatched,
        }),
        {
          operationId: operation.operationId,
          surface: firstExternalSurface(operation),
          input: {},
        },
      );

      expect(dispatched).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ok: false,
        error: { _tag: "ValidationFailed" },
      });
    },
  );

  it("rejects padded and non-URL-safe idempotency keys before dispatch", async () => {
    const adapter = createAdapter({
      runMutation: async () => {
        throw new Error("runMutation should not be called");
      },
    });

    await expect(
      executeHeadlessOperation(adapter, {
        operationId: "brain.pages.createMarkdown",
        surface: "api",
        input: { title: "A note" },
        idempotencyKey: " idem_123 ",
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown received invalid idempotencyKey: idempotencyKey must not have leading or trailing whitespace.",
      },
    });
    await expect(
      executeHeadlessOperation(adapter, {
        operationId: "brain.pages.createMarkdown",
        surface: "api",
        input: { title: "A note" },
        idempotencyKey: "idem/123",
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown received invalid idempotencyKey: idempotencyKey must contain only URL-safe letters, numbers, '.', '_', '~', or '-'.",
      },
    });
  });

  it("dispatches exposed writes through the adapter ref with idempotency input", async () => {
    const calls: unknown[] = [];
    const adapter = createAdapter({
      runMutation: async (ref, input) => {
        calls.push([ref, input]);
        return { id: "brainPage_123" };
      },
    });

    const result = await executeHeadlessOperation(adapter, {
      operationId: "brain.pages.createMarkdown",
      surface: "api",
      input: { title: "A note" },
      idempotencyKey: "idem_123",
    });

    expect(calls).toEqual([
      [
        "brain.pages.createMarkdown.ref",
        { title: "A note", idempotencyKey: "idem_123" },
      ],
    ]);
    expect(result).toEqual({
      ok: true,
      operationId: "brain.pages.createMarkdown",
      result: { id: "brainPage_123" },
    });
  });

  it("fails when an exposed operation has no adapter ref", async () => {
    const result = await executeHeadlessOperation(createAdapter({ refs: {} }), {
      operationId: "brain.pages.createMarkdown",
      surface: "api",
      input: {},
      idempotencyKey: "idem_123",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        _tag: "NotFound",
        message:
          "No generated function ref registered for operation brain.pages.createMarkdown.",
      },
    });
  });

  it("rejects non-JSON-safe adapter results", async () => {
    const result = await executeHeadlessOperation(
      createAdapter({
        runMutation: async () => undefined,
      }),
      {
        operationId: "brain.pages.createMarkdown",
        surface: "api",
        input: {},
        idempotencyKey: "idem_123",
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown returned a non-JSON-safe result.",
      },
    });
  });

  it("rejects non-JSON-safe request input before adapter execution", async () => {
    const adapter = createAdapter({
      runMutation: async () => {
        throw new Error("runMutation should not be called");
      },
    });

    await expect(
      executeHeadlessOperation(adapter, {
        operationId: "brain.pages.createMarkdown",
        surface: "api",
        input: { createdAt: new Date("2026-07-03T00:00:00.000Z") } as never,
        idempotencyKey: "idem_123",
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown received non-JSON-safe input.",
      },
    });
  });

  it("rejects unsupported manifest operation kinds instead of dispatching them as actions", async () => {
    vi.resetModules();
    vi.doMock(
      "@maestro-template/template-core/generated/confectManifest",
      () => ({
        confectManifest: {
          version: 1,
          generatedAt: "1970-01-01T00:00:00.000Z",
          functions: [
            {
              namespace: "brain.pages",
              name: "createMarkdown",
              operationId: "brain.pages.createMarkdown",
              kind: "future",
              surfaces: ["api"],
              typedErrors: [],
              idempotent: true,
              argsSchemaName: "brain.pages.createMarkdown.args",
              returnsSchemaName: "brain.pages.createMarkdown.returns",
            },
          ],
        },
      }),
    );

    const { executeHeadlessOperation: executeWithMockedManifest } =
      await import("../confect/manifest/executor");

    await expect(
      executeWithMockedManifest(createAdapter(), {
        operationId: "brain.pages.createMarkdown",
        surface: "api",
        input: {},
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        _tag: "ValidationFailed",
        message:
          "Operation brain.pages.createMarkdown has unsupported kind future.",
      },
    });
  });
});

afterEach(() => {
  vi.doUnmock("@maestro-template/template-core/generated/confectManifest");
});
