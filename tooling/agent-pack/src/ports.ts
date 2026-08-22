import { createServer } from "node:net";

export type StartMode = "fake" | "local" | "dev";
export type StartPortOverrides = {
  readonly web?: number;
  readonly convex?: number;
  readonly convexSite?: number;
  readonly readinessPresenter?: number;
};
export type StartPort = {
  readonly id: "web" | "convex" | "convex-site" | "readiness-presenter";
  readonly port: number;
};
export type StartPortPlan = {
  readonly web: number;
  readonly readinessPresenter: number;
  readonly required: readonly StartPort[];
  readonly url: string;
  readonly readinessUrl: string;
  readonly buildReadinessUrl: string;
};
export type StartPortProbe = {
  readonly available: (port: number, host: string) => Promise<boolean>;
};

const host = "127.0.0.1";
const collisionProbeHost = "0.0.0.0";

export function startPortPlan(
  mode: StartMode,
  overrides: StartPortOverrides = {},
): StartPortPlan {
  for (const port of Object.values(overrides)) {
    if (!Number.isInteger(port) || port < 1024 || port > 65_535)
      throw new Error("Start ports must be integers from 1024 through 65535.");
  }
  const web = overrides.web ?? 5173;
  const convex = overrides.convex ?? 3210;
  const convexSite = overrides.convexSite ?? 3211;
  const readinessPresenter = overrides.readinessPresenter ?? 4174;
  const required: readonly StartPort[] =
    mode === "local"
      ? [
          { id: "web", port: web },
          { id: "convex", port: convex },
          { id: "convex-site", port: convexSite },
          { id: "readiness-presenter", port: readinessPresenter },
        ]
      : [
          { id: "web", port: web },
          { id: "readiness-presenter", port: readinessPresenter },
        ];
  if (new Set(required.map(({ port }) => port)).size !== required.length)
    throw new Error("Start ports must be unique within the selected mode.");
  const url = `http://${host}:${web}`;
  return {
    web,
    readinessPresenter,
    required,
    url,
    readinessUrl: `${url}/health`,
    buildReadinessUrl: `http://${host}:${readinessPresenter}/`,
  };
}

export async function inspectStartPorts(
  plan: StartPortPlan,
  probe: StartPortProbe,
): Promise<
  | { readonly ok: true; readonly collisions: readonly [] }
  | { readonly ok: false; readonly collisions: readonly StartPort[] }
> {
  const checks = await Promise.all(
    plan.required.map(async (candidate) => ({
      candidate,
      available: await probe.available(candidate.port, host),
    })),
  );
  const collisions = checks
    .filter(({ available }) => !available)
    .map(({ candidate }) => candidate);
  return collisions.length === 0
    ? { ok: true, collisions: [] }
    : { ok: false, collisions };
}

export const nodeStartPortProbe: StartPortProbe = {
  available: (port) =>
    new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once("error", () => resolve(false));
      // Probe the wildcard address so an existing server bound to any local
      // interface cannot satisfy this launcher's later readiness request.
      server.listen({ port, host: collisionProbeHost, exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    }),
};
