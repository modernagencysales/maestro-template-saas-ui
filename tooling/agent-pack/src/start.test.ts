import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
} from "./contracts.js";
import { createRepositoryContext } from "./repoContext.js";
import { projectProcessEnvironment } from "./processSupervisor.js";
import {
  createStartCommand,
  type StartDependencies,
  type StartPreflightResult,
} from "./start.js";

const context = {
  schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  invocation: "library" as const,
  repo: createRepositoryContext({ cwd: "/customer" }),
};
const ready: StartPreflightResult = {
  safeToStart: true,
  auth: "not-required",
  exitClass: "success",
  diagnostics: [],
};
const identity = JSON.stringify({
  personalization: {
    name: "My App",
    firstOutcome: "Track client requests",
  },
});

function fixture(preflight: StartPreflightResult = ready) {
  const dependencies: StartDependencies = {
    preflight: vi.fn(async () => preflight),
    readFile: vi.fn(async () => identity),
    ports: {
      available: vi.fn(async () => true),
    },
    readiness: { wait: vi.fn(async () => true) },
    supervise: vi.fn(async (_specs, readiness) => {
      if (await readiness.wait(new AbortController().signal))
        readiness.onReady();
      return { kind: "user-signal" as const, signal: "SIGINT" as const };
    }),
    announce: vi.fn(),
  };
  return dependencies;
}

describe("start command", () => {
  it("defaults to fake, runs shared preflight first, and starts only web", async () => {
    const dependencies = fixture();
    const result = await executeAgentPackCommand(
      createStartCommand(dependencies),
      {},
      context,
    );

    expect(dependencies.preflight).toHaveBeenCalledWith("fake", context);
    expect(vi.mocked(dependencies.supervise).mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        id: "web",
        command: "pnpm",
        args: [
          "--dir",
          "apps/web",
          "dev",
          "--",
          "--host",
          "127.0.0.1",
          "--port",
          "5173",
          "--strictPort",
        ],
        cwd: "/customer",
      }),
    ]);
    expect(result.exitClass).toBe("success");
    expect(result.data).toMatchObject({
      mode: "fake",
      app: { name: "My App", firstOutcome: "Track client requests" },
      url: "http://127.0.0.1:5173",
      readinessUrl: "http://127.0.0.1:5173/health",
    });
    expect(dependencies.announce).toHaveBeenCalledWith({
      name: "My App",
      firstOutcome: "Track client requests",
      url: "http://127.0.0.1:5173",
      readinessUrl: "http://127.0.0.1:5173/health",
    });
  });

  it("starts explicit local Convex, Confect, and web argv without production", async () => {
    const dependencies = fixture();
    await executeAgentPackCommand(
      createStartCommand(dependencies),
      { mode: "local" },
      context,
    );

    expect(dependencies.preflight).toHaveBeenCalledWith("test", context);
    const specs = vi.mocked(dependencies.supervise).mock.calls[0]?.[0];
    expect(specs?.map(({ id }) => id)).toEqual(["convex", "confect", "web"]);
    expect(specs?.[0]).toMatchObject({
      command: "pnpm",
      args: ["--dir", "packages/convex", "convex:dev", "--", "--local"],
      cwd: "/customer",
    });
    expect(JSON.stringify(specs)).not.toContain("production");
  });

  it("removes poisoned live Convex targets from fake and local children", async () => {
    const poisoned = {
      CONVEX_DEPLOYMENT: "prod:customer",
      CONVEX_URL: "https://prod.convex.cloud",
      VITE_CONVEX_URL: "https://prod.convex.cloud",
      SAFE_NAME: "kept",
    };
    for (const mode of ["fake", "local"] as const) {
      const dependencies = fixture();
      await executeAgentPackCommand(
        createStartCommand(dependencies),
        { mode },
        context,
      );
      const specs = vi.mocked(dependencies.supervise).mock.calls[0]?.[0] ?? [];
      for (const spec of specs) {
        const environment = projectProcessEnvironment(
          poisoned,
          spec.environment,
        );
        expect(JSON.stringify(environment)).not.toContain("prod.convex.cloud");
        expect(environment.CONVEX_DEPLOYMENT).toBe("");
        expect(environment.SAFE_NAME).toBe("kept");
        expect(environment.VITE_CONVEX_URL).toBe(
          mode === "local" && spec.id === "web" ? "http://127.0.0.1:3210" : "",
        );
      }
    }
  });

  it("requires authenticated personal dev posture before any spawn", async () => {
    const dependencies = fixture({
      safeToStart: true,
      auth: "cancelled",
      exitClass: "success",
      diagnostics: [],
    });
    const result = await executeAgentPackCommand(
      createStartCommand(dependencies),
      { mode: "dev" },
      context,
    );

    expect(dependencies.preflight).toHaveBeenCalledWith("live", context);
    expect(dependencies.ports.available).not.toHaveBeenCalled();
    expect(dependencies.supervise).not.toHaveBeenCalled();
    expect(result.exitClass).toBe("unavailableDependency");
    expect(result.diagnostics[0]?.code).toBe(
      "AGENT_PACK_START_DEV_AUTH_REQUIRED",
    );
  });

  it("starts only the reviewed dev backend and web fallback commands", async () => {
    const dependencies = fixture({
      safeToStart: true,
      auth: "connected",
      exitClass: "success",
      diagnostics: [],
    });
    await executeAgentPackCommand(
      createStartCommand(dependencies),
      { mode: "dev" },
      context,
    );

    const specs = vi.mocked(dependencies.supervise).mock.calls[0]?.[0];
    expect(
      specs?.map(({ id, command, args, cwd }) => ({
        id,
        command,
        args,
        cwd,
      })),
    ).toEqual([
      {
        id: "backend",
        command: "pnpm",
        args: ["dev:backend"],
        cwd: "/customer",
      },
      expect.objectContaining({ id: "web", command: "pnpm", cwd: "/customer" }),
    ]);
    expect(JSON.stringify(specs)).not.toContain("production");
  });

  it("rejects promotion modes and unknown input", async () => {
    const dependencies = fixture();
    for (const mode of ["preview", "staging", "production", "unknown"]) {
      const result = await executeAgentPackCommand(
        createStartCommand(dependencies),
        { mode },
        context,
      );
      expect(result.exitClass).toBe("invalidInvocation");
    }
    expect(dependencies.preflight).not.toHaveBeenCalled();
  });

  it("shows blocking preflight findings before probing or spawning", async () => {
    const dependencies = fixture({
      safeToStart: false,
      auth: "not-required",
      exitClass: "unavailableDependency",
      diagnostics: [
        {
          code: "AGENT_PACK_INSTALL_MISSING",
          severity: "error",
          message: "Dependencies are not installed.",
          safeToContinue: false,
          nextAction: "Install dependencies.",
          rerun: "pnpm maestro -- start",
        },
      ],
    });
    const result = await executeAgentPackCommand(
      createStartCommand(dependencies),
      {},
      context,
    );

    expect(result.exitClass).toBe("unavailableDependency");
    expect(result.diagnostics[0]?.code).toBe("AGENT_PACK_INSTALL_MISSING");
    expect(dependencies.readFile).not.toHaveBeenCalled();
    expect(dependencies.ports.available).not.toHaveBeenCalled();
    expect(dependencies.supervise).not.toHaveBeenCalled();
  });

  it("reports occupied ports and malformed identity without partial start", async () => {
    const occupied = fixture();
    vi.mocked(occupied.ports.available).mockResolvedValue(false);
    const collision = await executeAgentPackCommand(
      createStartCommand(occupied),
      {},
      context,
    );
    expect(collision.exitClass).toBe("blockedMutation");
    expect(collision.diagnostics[0]?.code).toBe(
      "AGENT_PACK_START_PORT_COLLISION",
    );
    expect(occupied.supervise).not.toHaveBeenCalled();

    const malformed = fixture();
    vi.mocked(malformed.readFile).mockResolvedValue("{}");
    const invalid = await executeAgentPackCommand(
      createStartCommand(malformed),
      {},
      context,
    );
    expect(invalid.exitClass).toBe("unavailableDependency");
    expect(invalid.diagnostics[0]?.code).toBe(
      "AGENT_PACK_START_INSTANCE_INVALID",
    );
    expect(malformed.supervise).not.toHaveBeenCalled();
  });

  it("preserves preflight exit class and withholds URLs on readiness failure", async () => {
    const blocked = fixture({
      safeToStart: false,
      auth: "not-required",
      exitClass: "findings",
      diagnostics: [
        {
          code: "AGENT_PACK_PREFLIGHT_WARNING",
          severity: "warning",
          message: "Review local posture.",
          safeToContinue: false,
          nextAction: "Repair preflight.",
          rerun: "pnpm maestro -- preflight",
        },
      ],
    });
    const preflight = await executeAgentPackCommand(
      createStartCommand(blocked),
      {},
      context,
    );
    expect(preflight.exitClass).toBe("findings");
    expect(preflight.diagnostics[0]?.severity).toBe("warning");

    const timeout = fixture();
    vi.mocked(timeout.supervise).mockResolvedValue({
      kind: "readiness-timeout",
    });
    const result = await executeAgentPackCommand(
      createStartCommand(timeout),
      {},
      context,
    );
    expect(result.exitClass).toBe("unavailableDependency");
    expect(result.diagnostics[0]?.code).toBe(
      "AGENT_PACK_START_READINESS_TIMEOUT",
    );
    expect(timeout.announce).not.toHaveBeenCalled();

    for (const supervision of [
      { kind: "spawn-failed" as const },
      {
        kind: "child-exit" as const,
        completion: { code: null, signal: "SIGTERM" },
      },
    ]) {
      const unavailable = fixture();
      vi.mocked(unavailable.supervise).mockResolvedValue(supervision);
      const failed = await executeAgentPackCommand(
        createStartCommand(unavailable),
        {},
        context,
      );
      expect(failed.exitClass).toBe("unavailableDependency");
      expect(unavailable.announce).not.toHaveBeenCalled();
    }
  });
});
