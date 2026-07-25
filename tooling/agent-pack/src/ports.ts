import { createServer } from "node:net";

export type StartMode = "fake" | "local" | "dev";
export type StartPort = {
  readonly id: "web" | "convex" | "convex-site";
  readonly port: number;
};
export type StartPortPlan = {
  readonly web: number;
  readonly required: readonly StartPort[];
  readonly url: string;
  readonly readinessUrl: string;
};
export type StartPortProbe = {
  readonly available: (port: number, host: string) => Promise<boolean>;
};

const host = "127.0.0.1";

export function startPortPlan(mode: StartMode): StartPortPlan {
  const web = 5173;
  const required: readonly StartPort[] =
    mode === "local"
      ? [
          { id: "web", port: web },
          { id: "convex", port: 3210 },
          { id: "convex-site", port: 3211 },
        ]
      : [{ id: "web", port: web }];
  const url = `http://${host}:${web}`;
  return { web, required, url, readinessUrl: `${url}/health` };
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
  available: (port, address) =>
    new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once("error", () => resolve(false));
      server.listen({ port, host: address, exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    }),
};
