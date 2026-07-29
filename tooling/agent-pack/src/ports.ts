import { createServer } from "node:net";

export type StartMode = "fake" | "local" | "dev";
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

export function startPortPlan(mode: StartMode): StartPortPlan {
  const web = 5173;
  const readinessPresenter = 4174;
  const required: readonly StartPort[] =
    mode === "local"
      ? [
          { id: "web", port: web },
          { id: "convex", port: 3210 },
          { id: "convex-site", port: 3211 },
          { id: "readiness-presenter", port: readinessPresenter },
        ]
      : [
          { id: "web", port: web },
          { id: "readiness-presenter", port: readinessPresenter },
        ];
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
  available: (port, _address) =>
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
