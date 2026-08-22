import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { BuildReadinessView } from "./presenter.js";

const LOOPBACK = "127.0.0.1";

export type ReadinessServerSession = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

export async function openNodeReadinessServer(input: {
  readonly view: BuildReadinessView;
  readonly port: number;
}): Promise<ReadinessServerSession> {
  const html = renderReadinessHtml(input.view);
  const server = createServer((request, response) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'",
    );
    response.setHeader("x-content-type-options", "nosniff");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    if (request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : html);
  });
  await listen(server, input.port);
  const address = server.address() as AddressInfo;
  let closed = false;
  return {
    url: `http://${LOOPBACK}:${address.port}/`,
    close: async () => {
      if (closed) return;
      closed = true;
      await close(server);
    },
  };
}

export function renderReadinessHtml(view: BuildReadinessView): string {
  const summary = Object.entries(view.summary)
    .map(
      ([label, value]) =>
        `<article><h3>${escapeHtml(title(label))}</h3><p>${escapeHtml(value)}</p></article>`,
    )
    .join("");
  const actions = view.nextActions
    .map((action) => `<li><code>${escapeHtml(action)}</code></li>`)
    .join("");
  const surfaces = view.details.surfaces
    .map(
      ({ id, status }) => `<li>${escapeHtml(id)}: <code>${status}</code></li>`,
    )
    .join("");
  const providers = view.details.providers
    .map(
      ({ id, posture }) =>
        `<li>${escapeHtml(id)}: <code>${posture}</code></li>`,
    )
    .join("");
  const providerEnvironments = view.details.providerEnvironments
    .map(
      ({ environment, providers: environmentProviders }) =>
        `<li>${escapeHtml(environment)}: ${environmentProviders
          .map(
            ({ id, state }) =>
              `${escapeHtml(id)}=<code>${escapeHtml(state)}</code>`,
          )
          .join(", ")}</li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(view.title)}</title><style>${styles}</style></head>
<body><main><header><p class="eyebrow">Local operator view</p><h1>${escapeHtml(view.title)}</h1><p>${escapeHtml(view.firstOutcome)}</p></header>
<section><h2>What works now</h2><p>${escapeHtml(view.whatWorksNow)}</p></section>
<section><h2>What is demo-only</h2><p>${escapeHtml(view.whatIsDemoOnly)}</p></section>
<section><h2>App summary</h2><div class="grid">${summary}</div></section>
<section><h2>Selected build</h2><p>Blueprint: ${escapeHtml(view.selection.blueprint)}</p><p>Recipe: ${escapeHtml(view.selection.recipe)}</p></section>
<section><h2>Latest verification</h2><p>${escapeHtml(view.receipt.status)} — ${escapeHtml(view.receipt.subject)}</p>${view.receipt.detail ? `<p>${escapeHtml(view.receipt.detail)}</p>` : ""}</section>
<section><h2>Next action</h2><ol>${actions}</ol></section>
<details><summary>Technical details</summary><p>Preflight: <code>${view.details.preflight}</code></p><h3>Surfaces</h3><ul>${surfaces}</ul><h3>Providers</h3><ul>${providers}</ul><h3>Provider environments</h3><ul>${providerEnvironments}</ul></details>
</main></body></html>`;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: LOOPBACK, port, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function title(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = `:root{color-scheme:light dark;font:16px/1.5 system-ui}body{margin:0;background:#101820;color:#f4f7f8}main{max-width:880px;margin:auto;padding:3rem 1.25rem}header,section,details{background:#172631;border:1px solid #34505e;border-radius:14px;margin:1rem 0;padding:1.25rem}h1,h2,h3{line-height:1.15}.eyebrow{color:#76d7c4;text-transform:uppercase;letter-spacing:.08em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}article{background:#203744;border-radius:10px;padding:.75rem}code{color:#8ce8d5;overflow-wrap:anywhere}`;
