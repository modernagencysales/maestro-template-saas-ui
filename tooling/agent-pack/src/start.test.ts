import { describe, expect, it, vi } from "vitest";
import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  executeAgentPackCommand,
} from "./contracts.js";
import { createRepositoryContext } from "./repoContext.js";
import {
  projectProcessEnvironment,
  type StartProcessSpec,
} from "./processSupervisor.js";
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
  readiness: {
    worksNow: "Fake records work now.",
    demoOnly: "Live connections are demo-only.",
    blueprint: "saas-application",
    providers: [{ id: "convex", posture: "sample" }],
  },
};
const identity = JSON.stringify({
  personalization: {
    name: "My App",
    firstOutcome: "Track client requests",
  },
});

function fixture(preflight: Partial<StartPreflightResult> = ready) {
  const preflightResult = { ...ready, ...preflight };
  const dependencies: StartDependencies = {
    preflight: vi.fn(async () => preflightResult),
    readFile: vi.fn(async () => identity),
    ports: {
      available: vi.fn(async () => true),
    },
    readiness: { wait: vi.fn(async () => true) },
    readinessSurface: {
      open: vi.fn(async () => ({
        url: "http://127.0.0.1:4174/",
        close: vi.fn(async () => undefined),
      })),
    },
    supervise: vi.fn(async (_specs, readiness) => {
      if (await readiness.wait(new AbortController().signal))
        readiness.onReady();
      return { kind: "user-signal" as const, signal: "SIGINT" as const };
    }),
    announce: vi.fn(),
  };
  return dependencies;
}

function requiredProcess(
  specs: readonly StartProcessSpec[],
  id: string,
): StartProcessSpec {
  const spec = specs.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`Missing ${id} process fixture.`);
  return spec;
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
          "exec",
          "vite",
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
      buildReadinessUrl: "http://127.0.0.1:4174/",
    });
    expect(dependencies.announce).toHaveBeenCalledWith({
      name: "My App",
      firstOutcome: "Track client requests",
      url: "http://127.0.0.1:5173",
      readinessUrl: "http://127.0.0.1:5173/health",
      buildReadinessUrl: "http://127.0.0.1:4174/",
    });
    expect(dependencies.readinessSurface.open).toHaveBeenCalledWith({
      mode: "fake",
      port: 4174,
      repo: context.repo,
      preflight: ready,
    });
    const readinessOpenOrder = vi.mocked(dependencies.readinessSurface.open)
      .mock.invocationCallOrder[0];
    const superviseOrder = vi.mocked(dependencies.supervise).mock
      .invocationCallOrder[0];
    if (readinessOpenOrder === undefined || superviseOrder === undefined) {
      throw new Error("Expected readiness and supervision to both run.");
    }
    expect(readinessOpenOrder).toBeLessThan(superviseOrder);
  });

  it("starts explicit local Convex, Confect, and web argv without production", async () => {
    const dependencies = fixture();
    await executeAgentPackCommand(
      createStartCommand(dependencies),
      { mode: "local" },
      context,
    );

    expect(dependencies.preflight).toHaveBeenCalledWith("fake", context);
    const specs = vi.mocked(dependencies.supervise).mock.calls[0]?.[0];
    expect(specs?.map(({ id }) => id)).toEqual(["convex", "confect", "web"]);
    expect(specs?.[0]).toMatchObject({
      command: "pnpm",
      args: [
        "--dir",
        "packages/convex",
        "convex:dev",
        "--local-cloud-port",
        "3210",
        "--local-site-port",
        "3211",
        "--typecheck",
        "disable",
      ],
      cwd: "/customer",
    });
    expect(specs?.[0]?.environment?.set.CONVEX_AGENT_MODE).toBe("anonymous");
    expect(JSON.stringify(specs)).not.toContain("production");
  });

  it("threads validated port overrides through probes, children, and URLs", async () => {
    const dependencies = fixture();
    vi.mocked(dependencies.readinessSurface.open).mockResolvedValue({
      url: "http://127.0.0.1:6174/",
      close: vi.fn(async () => undefined),
    });
    const result = await executeAgentPackCommand(
      createStartCommand(dependencies),
      {
        mode: "local",
        ports: {
          web: 6173,
          convex: 4210,
          convexSite: 4211,
          readinessPresenter: 6174,
        },
      },
      context,
    );

    expect(dependencies.ports.available).toHaveBeenCalledTimes(4);
    expect(dependencies.ports.available).toHaveBeenCalledWith(
      6173,
      "127.0.0.1",
    );
    expect(dependencies.ports.available).toHaveBeenCalledWith(
      4210,
      "127.0.0.1",
    );
    expect(dependencies.ports.available).toHaveBeenCalledWith(
      4211,
      "127.0.0.1",
    );
    expect(dependencies.ports.available).toHaveBeenCalledWith(
      6174,
      "127.0.0.1",
    );
    expect(dependencies.readinessSurface.open).toHaveBeenCalledWith(
      expect.objectContaining({ port: 6174 }),
    );
    const specs = vi.mocked(dependencies.supervise).mock.calls[0]?.[0] ?? [];
    expect(specs[0]?.args).toEqual([
      "--dir",
      "packages/convex",
      "convex:dev",
      "--local-cloud-port",
      "4210",
      "--local-site-port",
      "4211",
      "--typecheck",
      "disable",
    ]);
    expect(specs[2]?.args).toContain("6173");
    expect(specs[2]?.environment?.set.VITE_CONVEX_URL).toBe(
      "http://127.0.0.1:4210",
    );
    expect(result.data).toMatchObject({
      url: "http://127.0.0.1:6173",
      readinessUrl: "http://127.0.0.1:6173/health",
      buildReadinessUrl: "http://127.0.0.1:6174/",
      ports: [
        { id: "web", port: 6173 },
        { id: "convex", port: 4210 },
        { id: "convex-site", port: 4211 },
        { id: "readiness-presenter", port: 6174 },
      ],
    });
  });

  it("removes poisoned live Convex targets from fake and local children", async () => {
    const poisoned = {
      CONVEX_DEPLOYMENT: "prod:customer",
      CONVEX_DEPLOY_KEY: "prod-deploy-key",
      TEMPLATE_CONVEX_DEPLOY_KEY: "prod-cluster-deploy-key",
      CONVEX_URL: "https://prod.convex.cloud",
      CONVEX_SITE_URL: "https://prod.convex.site",
      CONVEX_SELF_HOSTED_URL: "https://prod.self-hosted.example",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "prod-admin-key",
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
        expect(JSON.stringify(environment)).not.toMatch(
          /prod|deploy-key|admin-key/,
        );
        expect(environment.CONVEX_DEPLOYMENT).toBe("");
        expect(environment.CONVEX_DEPLOY_KEY).toBe("");
        expect(environment.TEMPLATE_CONVEX_DEPLOY_KEY).toBe("");
        expect(environment.SAFE_NAME).toBe("kept");
        expect(environment.VITE_CONVEX_URL).toBe(
          mode === "local" && spec.id === "web" ? "http://127.0.0.1:3210" : "",
        );
      }
      const webSpec = requiredProcess(specs, "web");
      const webEnvironment = projectProcessEnvironment(
        poisoned,
        webSpec.environment,
      );
      expect(webEnvironment.APP_PROVIDER_MODE).toBe("fake");
      expect(webEnvironment.VITE_MAESTRO_AUTH_MODE).toBe("fixture");
    }

    const dev = fixture({
      safeToStart: true,
      auth: "connected",
      exitClass: "success",
      diagnostics: [],
    });
    await executeAgentPackCommand(
      createStartCommand(dev),
      { mode: "dev" },
      context,
    );
    const devSpecs = vi.mocked(dev.supervise).mock.calls[0]?.[0] ?? [];
    const personalDev = {
      CONVEX_DEPLOYMENT: "dev:personal",
      CONVEX_DEPLOY_KEY: "personal-dev-key",
      VITE_CONVEX_URL: "https://personal-dev.convex.cloud",
    };
    for (const spec of devSpecs) {
      expect(projectProcessEnvironment(personalDev, spec.environment)).toEqual(
        personalDev,
      );
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

  it("rejects invalid and duplicate ports before preflight", async () => {
    const dependencies = fixture();
    for (const ports of [
      { web: 1023 },
      { web: 5173.5 },
      { web: 6173, readinessPresenter: 6173 },
    ]) {
      const result = await executeAgentPackCommand(
        createStartCommand(dependencies),
        { mode: "fake", ports },
        context,
      );
      expect(result.exitClass).toBe("invalidInvocation");
      expect(result.diagnostics[0]?.code).toBe(
        "AGENT_PACK_START_INVALID_PORTS",
      );
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
    expect(collision.diagnostics[0]?.rerun).toBe(
      "pnpm maestro -- start --mode fake --web-port 15173 --readiness-port 14174",
    );
    expect(collision.data).toEqual({
      collisions: [
        { id: "web", port: 5173 },
        { id: "readiness-presenter", port: 4174 },
      ],
      rerun:
        "pnpm maestro -- start --mode fake --web-port 15173 --readiness-port 14174",
    });
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
    const readinessSession = await timeout.readinessSurface.open({
      mode: "fake",
      port: 4174,
      repo: context.repo,
      preflight: ready,
    });
    vi.mocked(timeout.readinessSurface.open).mockResolvedValue(
      readinessSession,
    );
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
    expect(readinessSession.close).toHaveBeenCalledOnce();

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
